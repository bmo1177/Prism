import type {
  AgentInfo,
  CommandInfo,
  HistoryMessage,
  McpConfig,
  McpServer,
  OAuthAuthorization,
  OpenCodeClientOptions,
  OpenCodeRawEvent,
  PermissionReply,
  ProviderAuthMethod,
  ProviderCatalogEntry,
  ProviderInfo,
  QuestionAskedEvent,
  PermissionAskedEvent,
  SessionMeta,
  SessionPage,
  SessionQuery,
  SkillInfo,
  ToolCallStatus,
} from "./types";
import { DEFAULT_OPENCODE_URL } from "./types";
import type { AgentRuntime } from "./runtime";
import { BaseAgentRuntime } from "./base-runtime";

const LEGACY_BLIND_CONTEXT = 128_000;

/** Host UI contract for present_artifact tool. */
const ARTIFACT_PRESENTATION_SYSTEM = `This host can display workspace files through the present_artifact tool. To show a file inline in the conversation, call present_artifact with display="inline". To open it in a dedicated panel, call present_artifact with display="panel" and placement="right" or placement="bottom". Use target="new-screen" to open the artifact in a new pane, or target="new-session" to present it in a dedicated session. Never claim an artifact is displayed unless you have actually called present_artifact for it.`;

type CustomProviderConfig = Record<
  string,
  {
    models?: Record<string, { name?: string; limit?: { context: number; output: number } }>;
    [key: string]: unknown;
  }
>;

/** Map OpenCode tool status to our interface. */
function mapToolStatus(status: string): ToolCallStatus {
  switch (status) {
    case "running": return "running";
    case "completed": return "success";
    case "error": return "failed";
    default: return "pending";
  }
}

/** Extract readable error message. */
function errorText(error: unknown): string | undefined {
  const err = error as { name?: string; message?: string; data?: { message?: string } } | undefined;
  const full = err?.data?.message ?? err?.message ?? err?.name;
  return typeof full === "string" && full ? full.split("\n")[0] : undefined;
}

/** Parse "provider/model" string. */
function parseModel(model?: string | null): { providerID: string; modelID: string } | undefined {
  if (!model) return undefined;
  const i = model.indexOf("/");
  if (i <= 0 || i >= model.length - 1) return undefined;
  return { providerID: model.slice(0, i), modelID: model.slice(i + 1) };
}

/** Order for reasoning effort variants. */
const VARIANT_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
function orderVariants(names: string[]): string[] {
  const rank = (n: string) => {
    const i = VARIANT_ORDER.indexOf(n);
    return i === -1 ? VARIANT_ORDER.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || names.indexOf(a) - names.indexOf(b));
}

/** Session page size. */
const SESSION_PAGE = 200;

/** Recent window size for sidebar. */
const RECENT_WINDOW = 200;

/** Max pages to walk for recent sessions. */
const RECENT_MAX_PAGES = 5;

/** Min fetch size. */
const MIN_FETCH = 50;

/** Metadata namespace for the app. */
const META_NS = "ai4s";

/**
 * Core OpenCode client with unified status handling and health checks.
 * Provides a stable interface for the agent runtime.
 */
export class OpenCodeClient extends BaseAgentRuntime implements AgentRuntime {
  // Configuration
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly authHeader: string | null;
  private readonly authToken: string | null;
  private readonly directory: string | null;
  private readonly connectTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly customFetch: boolean;

  // Connection state
  private closed = false;
  private abort: AbortController | null = null;
  private es: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Accumulated delta text per part, so streamed deltas emit the running value.
  private readonly deltaText = new Map<string, string>();
  private readonly deltaReasoning = new Map<string, string>();

  // Connection management
  constructor(opts: OpenCodeClientOptions = {}) {
    super();
    this.baseUrl = (opts.baseUrl ?? DEFAULT_OPENCODE_URL).replace(/\/$/, "");
    this.customFetch = Boolean(opts.fetchImpl);
    this.fetchImpl = (opts.fetchImpl ?? globalThis.fetch).bind(globalThis);
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 5000;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30000;
    this.directory = opts.directory ?? null;

    const user = opts.username ?? "opencode";
    const pass = opts.password;
    if (pass) {
      const raw = `${user}:${pass}`;
      const b64 = typeof btoa === "function" ? btoa(raw) : Buffer.from(raw).toString("base64");
      this.authHeader = `Basic ${b64}`;
      this.authToken = b64;
    } else {
      this.authHeader = null;
      this.authToken = null;
    }
  }

  /** Get connection health status. */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        headers: { "Content-Type": "application/json" },
      }, 2000);
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Reset connection to attempt recovery. */
  async reset(): Promise<void> {
    this.close();
    await this.connect();
  }

  /** Event stream for SSE integration. */
  get eventStream(): EventSource | null {
    return this.es;
  }

  /** Build request headers. */
  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h["Content-Type"] = "application/json";
    if (this.authHeader) h["Authorization"] = this.authHeader;
    return h;
  }

  /** Fetch with timeout. */
  private async fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = this.requestTimeoutMs): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(input, { ...init, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) throw new Error("Timed out waiting for OpenCode");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Build event URL with auth and directory params. */
  private eventUrl(): string {
    const params = new URLSearchParams();
    if (this.directory) params.set("directory", this.directory);
    if (this.authToken) params.set("auth_token", this.authToken);
    const q = params.toString();
    return `${this.baseUrl}/event${q ? `?${q}` : ""}`;
  }

  /** Build directory query param. */
  private dirQuery(): string {
    return this.directory ? `?directory=${encodeURIComponent(this.directory)}` : "";
  }

  /** Open SSE event stream. */
  connect(): Promise<void> {
    this.closed = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus("connecting");

    const canUseEventSource = this.isBrowserEventSourceAvailable();
    if (canUseEventSource) {
      return this.connectViaEventSource();
    }

    return this.connectViaFetch();
  }

  /** Check if EventSource is available and suitable. */
  private isBrowserEventSourceAvailable(): boolean {
    if (this.customFetch) return false;
    if (typeof EventSource === "undefined") return false;

    const isBrowser = typeof window !== "undefined";
    const isTestEventSource = typeof EventSource !== "undefined" && 
      !EventSource.toString().includes("[native code]");

    return isBrowser || isTestEventSource;
  }

  /** Connect using EventSource (preferred for browsers). */
  private connectViaEventSource(): Promise<void> {
    return new Promise((resolve, reject) => {
      let opened = false;
      let finished = false;

      const es = new EventSource(this.eventUrl());
      this.es = es;

      const timer = setTimeout(() => {
        if (opened || finished) return;
        finished = true;
        this.setStatus("error");
        es.close();
        if (this.es === es) this.es = null;
        reject(new Error("Timed out opening OpenCode event stream"));
      }, this.connectTimeoutMs);

      es.onopen = () => {
        if (finished) return;
        opened = true;
        finished = true;
        clearTimeout(timer);
        this.setStatus("ready");
        resolve();
      };

      const handleMessage = (ev: MessageEvent) => {
        try {
          this.normalize(JSON.parse(ev.data) as OpenCodeRawEvent);
        } catch {
          /* ignore malformed frames */
        }
      };

      es.onmessage = handleMessage;
      if (typeof es.addEventListener === "function") {
        es.addEventListener("message", handleMessage);
      }

      es.onerror = () => {
        if (!opened) {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          this.setStatus("error");
          es.close();
          this.es = null;
          reject(new Error("Could not open OpenCode event stream"));
        } else {
          es.close();
          if (this.es === es) {
            this.es = null;
            this.reconnectSoon();
          }
        }
      };
    });
  }

  /** Connect using fetch (fallback for Node/tests). */
  private connectViaFetch(): Promise<void> {
    this.abort = new AbortController();
    return new Promise((resolve, reject) => {
      let opened = false;
      const abort = this.abort!;
      const timer = setTimeout(() => {
        if (!opened) abort.abort(new Error("Timed out opening OpenCode event stream"));
      }, this.connectTimeoutMs);

      this.fetchImpl(this.eventUrl(), {
        headers: { Accept: "text/event-stream", ...this.headers() },
        signal: abort.signal,
      })
        .then(async (res) => {
          clearTimeout(timer);
          if (!res.ok || !res.body) {
            this.setStatus("error");
            reject(new Error(`OpenCode /event returned ${res.status}`));
            return;
          }
          this.setStatus("ready");
          opened = true;
          resolve();
          await this.readStream(res.body);
        })
        .catch((err) => {
          clearTimeout(timer);
          if (!opened) {
            this.setStatus("error");
            reject(err instanceof Error ? err : new Error(String(err)));
          } else {
            this.setStatus("offline");
          }
        });
    });
  }

  /** Reopen event stream after failure with backoff. */
  private reconnectSoon(attempt = 0): void {
    if (this.closed || this.reconnectTimer) return;
    this.setStatus("connecting");
    const delay = attempt === 0 ? 250 : Math.min(1000 * attempt, 3000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closed) return;
      this.connect().catch(() => {
        if (attempt + 1 < 8) this.reconnectSoon(attempt + 1);
        else this.setStatus("error");
      });
    }, delay);
  }

  /** Create a new agent session. */
  async createSession(title?: string): Promise<string> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/session${this.dirQuery()}`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(title ? { title } : {}),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to create session");
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  /** List recent sessions for sidebar. */
  async listSessions(): Promise<SessionMeta[]> {
    const page = await this.querySessions({ limit: RECENT_WINDOW });
    return page.sessions.slice(0, RECENT_WINDOW);
  }

  /** Query session history with search and pagination. */
  async querySessions(query: SessionQuery = {}): Promise<SessionPage> {
    const limit = query.limit ?? SESSION_PAGE;
    const out: SessionMeta[] = [];
    const seen = new Set<string>();
    let cursor = query.cursor ?? null;

    for (let attempt = 0; attempt < RECENT_MAX_PAGES; attempt++) {
      const raw = await this.rawSessionPage({
        ...query,
        limit: Math.max(limit, MIN_FETCH),
        cursor,
      });

      const fresh = raw.sessions.filter((s) => !seen.has(s.id));
      fresh.forEach((s) => seen.add(s.id));
      out.push(...(query.archived ? fresh : fresh.filter((s) => s.archived == null)));

      cursor = raw.nextCursor;
      if (cursor === null || out.length >= limit || fresh.length === 0) break;
    }

    return { sessions: out, nextCursor: cursor };
  }

  /** Raw session page from server. */
  private async rawSessionPage(query: SessionQuery): Promise<SessionPage> {
    const limit = query.limit ?? SESSION_PAGE;
    const params = new URLSearchParams({ limit: String(limit) });
    if (query.cursor != null) params.set("cursor", String(query.cursor));
    if (query.search) params.set("search", query.search);

    let res = await this.fetchWithTimeout(`${this.baseUrl}/experimental/session?${params}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      if (query.cursor != null) return { sessions: [], nextCursor: null };
      res = await this.fetchWithTimeout(`${this.baseUrl}/session`, { headers: this.headers() });
    }

    if (!res.ok) throw await this.apiError(res, "Failed to list sessions");

    const arr = (await res.json()) as Array<{
      id: string;
      title?: string;
      slug?: string;
      directory?: string;
      parentID?: string | null;
      metadata?: Record<string, unknown>;
      time?: { created?: number; updated?: number };
    }>;

    const sessions = arr.map((s) => {
      const mine = (s.metadata?.[META_NS] ?? {}) as { archived?: number };
      return {
        id: s.id,
        title: s.title ?? "Untitled",
        slug: s.slug,
        directory: s.directory,
        parentId: s.parentID ?? undefined,
        created: s.time?.created,
        updated: s.time?.updated,
        ...(typeof mine.archived === "number" ? { archived: mine.archived } : {}),
        ...(s.metadata ? { metadata: s.metadata } : {}),
      } satisfies SessionMeta;
    });

    const last = sessions[sessions.length - 1]?.updated;
    const nextCursor = sessions.length < limit || last == null ? null : last + 1;
    return { sessions, nextCursor };
  }

  /** Archive or restore a session. */
  async setSessionArchived(sessionId: string, archived: boolean): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to read the session");

    const current = (await res.json()) as { metadata?: Record<string, unknown> };
    const metadata: Record<string, unknown> = { ...(current.metadata ?? {}) };
    const mine = { ...((metadata[META_NS] as Record<string, unknown>) ?? {}) };

    if (archived) mine.archived = Date.now();
    else delete mine.archived;

    if (Object.keys(mine).length > 0) metadata[META_NS] = mine;
    else delete metadata[META_NS];

    const patch = await this.fetchWithTimeout(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}`,
      { method: "PATCH", headers: this.headers(true), body: JSON.stringify({ metadata }) },
    );
    if (!patch.ok) throw await this.apiError(patch, "Failed to archive the session");
  }

  /** Rename a session. */
  async renameSession(sessionId: string, title: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}`,
      {
        method: "PATCH",
        headers: this.headers(true),
        body: JSON.stringify({ title }),
      },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to rename session");
  }

  /** Move session to different workspace. */
  async moveSession(sessionId: string, directory: string): Promise<void> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/experimental/control-plane/move-session`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ sessionID: sessionId, destination: { directory }, moveChanges: false }),
      },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to move session");
  }

  /** Delete a session. */
  async deleteSession(sessionId: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/session/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to delete session");
  }

  /** Load session messages. */
  async getMessages(sessionId: string): Promise<HistoryMessage[]> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/message`,
      { headers: this.headers() },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to load messages");

    const arr = (await res.json()) as Array<{
      info: {
        id?: string;
        role: "user" | "assistant";
        time?: { completed?: number };
        error?: unknown;
        agent?: string;
      };
      parts: HistoryMessage["parts"];
    }>;

    return arr.map((m) => {
      const error = errorText(m.info.error);
      return {
        role: m.info.role,
        ...(m.info.id ? { id: m.info.id } : {}),
        completed: m.info.time?.completed,
        ...(error ? { error } : {}),
        ...(m.info.agent ? { agent: m.info.agent } : {}),
        parts: m.parts ?? [],
      };
    });
  }

  /** Revert session to a specific message. */
  async revert(sessionId: string, messageID: string, partID?: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/revert`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ messageID, ...(partID ? { partID } : {}) }),
      },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to revert the message");
  }

  /** Restore reverted messages. */
  async unrevert(sessionId: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/unrevert`,
      { method: "POST", headers: this.headers(true), body: "{}" },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to restore the reverted messages");
  }

  /** Interrupt current session. */
  async abortSession(sessionId: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/abort`,
      { method: "POST", headers: this.headers(true), body: "{}" },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to interrupt the session");
  }

  /** List available skills. */
  async listSkills(): Promise<SkillInfo[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/skill${this.dirQuery()}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to list skills");

    const body = (await res.json()) as SkillInfo[] | { data?: SkillInfo[] };
    const skills = Array.isArray(body) ? body : body.data ?? [];
    return [...skills].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** List available slash commands. */
  async listCommands(): Promise<CommandInfo[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/command${this.dirQuery()}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to list commands");

    const body = (await res.json()) as CommandInfo[] | { data?: CommandInfo[] };
    return Array.isArray(body) ? body : body.data ?? [];
  }

  /** Get default model. */
  async getDefaultModel(): Promise<string | null> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, { headers: this.headers() });
    if (!res.ok) throw await this.apiError(res, "Failed to read config");
    const cfg = (await res.json()) as { model?: string };
    return cfg.model ?? null;
  }

  /** Set default model. */
  async setDefaultModel(model: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, {
      method: "PATCH",
      headers: this.headers(true),
      body: JSON.stringify({ model }),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to set model");
  }

  /** List providers. */
  async listProviders(): Promise<ProviderInfo[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/config/providers`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to list providers");

    const body = (await res.json()) as {
      providers?: Array<{
        id: string;
        name?: string;
        models?: Record<string, { name?: string; variants?: Record<string, unknown> }>;
      }>;
    };

    return (body.providers ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? p.id,
      models: Object.entries(p.models ?? {}).map(([id, m]) => ({
        id,
        name: m.name ?? id,
        variants: orderVariants(Object.keys(m.variants ?? {})),
      })),
    }));
  }

  /** Add custom provider. */
  async addCustomProvider(
    id: string,
    opts: {
      name: string;
      npm: string;
      baseURL: string;
      apiKey?: string;
      models: string[];
      contexts?: Record<string, number>;
    },
  ): Promise<void> {
    const existing = await this.customProviderModelLimits(id);
    const models = Object.fromEntries(
      opts.models.map((m) => {
        const context = opts.contexts?.[m];
        const limit = context && context > 0 ? { context, output: existing[m]?.output ?? 0 } : existing[m];
        return [m, limit ? { name: m, limit } : { name: m }];
      }),
    );

    const provider = {
      [id]: {
        name: opts.name,
        npm: opts.npm,
        options: { baseURL: opts.baseURL, ...(opts.apiKey ? { apiKey: opts.apiKey } : {}) },
        models,
      },
    };

    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, {
      method: "PATCH",
      headers: this.headers(true),
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to add the provider");
  }

  /** List custom provider IDs. */
  async listCustomProviderIds(): Promise<string[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, { headers: this.headers() });
    if (!res.ok) return [];
    const cfg = (await res.json()) as { provider?: Record<string, unknown> };
    return Object.keys(cfg.provider ?? {});
  }

  /** Clear default custom model context limits. */
  async clearDefaultCustomModelContextLimits(): Promise<void> {
    const isBlindDefault = (limit?: { context: number; output: number }) =>
      limit != null && limit.context === LEGACY_BLIND_CONTEXT && limit.output === 0;

    const cfg = await this.customProviderConfig();
    const patch: CustomProviderConfig = {};
    for (const [pid, entry] of Object.entries(cfg)) {
      const models = entry.models ?? {};
      if (!Object.values(models).some((m) => isBlindDefault(m.limit))) continue;
      patch[pid] = {
        ...entry,
        models: Object.fromEntries(
          Object.entries(models).map(([mid, m]) =>
            isBlindDefault(m.limit) ? [mid, { ...m, limit: { context: 0, output: 0 } }] : [mid, m],
          ),
        ),
      };
    }

    if (Object.keys(patch).length === 0) return;

    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, {
      method: "PATCH",
      headers: this.headers(true),
      body: JSON.stringify({ provider: patch }),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to reset default model context limits");
  }

  /** Get custom provider model limits. */
  private async customProviderModelLimits(
    id: string,
  ): Promise<Record<string, { context: number; output: number }>> {
    const cfg = await this.customProviderConfig();
    const out: Record<string, { context: number; output: number }> = {};
    for (const [model, m] of Object.entries(cfg[id]?.models ?? {})) {
      if (m.limit && m.limit.context > 0) out[model] = m.limit;
    }
    return out;
  }

  /** Get custom provider config. */
  private async customProviderConfig(): Promise<CustomProviderConfig> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, { headers: this.headers() });
    if (!res.ok) return {};
    const cfg = (await res.json()) as { provider?: CustomProviderConfig };
    return cfg.provider ?? {};
  }

  /** List MCP servers. */
  async listMcpServers(): Promise<McpServer[]> {
    const [statusRes, cfgRes] = await Promise.all([
      this.fetchImpl(`${this.baseUrl}/mcp`, { headers: this.headers() }),
      this.fetchImpl(`${this.baseUrl}/global/config`, { headers: this.headers() }),
    ]);

    if (!statusRes.ok) throw await this.apiError(statusRes, "Failed to list MCP servers");
    const status = (await statusRes.json()) as Record<string, { status?: string }>;
    const cfg = cfgRes.ok
      ? ((await cfgRes.json()) as { mcp?: Record<string, McpConfig> })
      : { mcp: {} };

    const names = new Set([...Object.keys(status), ...Object.keys(cfg.mcp ?? {})]);
    return [...names].sort().map((name) => ({
      name,
      status: status[name]?.status ?? "pending",
      config: cfg.mcp?.[name],
    }));
  }

  /** Add MCP server. */
  async addMcpServer(name: string, config: McpConfig): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, {
      method: "PATCH",
      headers: this.headers(true),
      body: JSON.stringify({ mcp: { [name]: config } }),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to add the MCP server");
  }

  /** List provider catalog. */
  async listProviderCatalog(): Promise<{ all: ProviderCatalogEntry[]; connected: string[] }> {
    const res = await this.fetchImpl(`${this.baseUrl}/provider`, { headers: this.headers() });
    if (!res.ok) throw await this.apiError(res, "Failed to list the provider catalog");

    const body = (await res.json()) as {
      all?: Array<{ id: string; name?: string; env?: string[] }>;
      connected?: string[];
    };

    return {
      all: (body.all ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id, env: p.env ?? [] })),
      connected: body.connected ?? [],
    };
  }

  /** List auth methods. */
  async listAuthMethods(): Promise<Record<string, ProviderAuthMethod[]>> {
    const res = await this.fetchImpl(`${this.baseUrl}/provider/auth`, { headers: this.headers() });
    if (!res.ok) throw await this.apiError(res, "Failed to list auth methods");
    return (await res.json()) as Record<string, ProviderAuthMethod[]>;
  }

  /** Set provider API key. */
  async setProviderApiKey(providerID: string, key: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/auth/${encodeURIComponent(providerID)}`, {
      method: "PUT",
      headers: this.headers(true),
      body: JSON.stringify({ type: "api", key }),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to save the key");
    await this.disposeInstance();
  }

  /** Get provider region. */
  async getProviderRegion(providerID: string): Promise<string | null> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, { headers: this.headers() });
    if (!res.ok) throw await this.apiError(res, "Failed to read provider region");
    const cfg = (await res.json()) as {
      provider?: Record<string, { options?: { region?: unknown } }>;
    };
    const region = cfg.provider?.[providerID]?.options?.region;
    return typeof region === "string" && region ? region : null;
  }

  /** Set provider region. */
  async setProviderRegion(providerID: string, region: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/global/config`, {
      method: "PATCH",
      headers: this.headers(true),
      body: JSON.stringify({ provider: { [providerID]: { options: { region } } } }),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to set provider region");
  }

  /** Remove provider auth. */
  async removeProviderAuth(providerID: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/auth/${encodeURIComponent(providerID)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw await this.apiError(res, "Failed to disconnect");
    await this.disposeInstance();
  }

  /** OAuth authorization start. */
  async oauthAuthorize(
    providerID: string,
    method: number,
    inputs?: Record<string, string>,
  ): Promise<OAuthAuthorization> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/provider/${encodeURIComponent(providerID)}/oauth/authorize`,
      { method: "POST", headers: this.headers(true), body: JSON.stringify({ method, inputs }) },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to start the login");
    return (await res.json()) as OAuthAuthorization;
  }

  /** OAuth callback. */
  async oauthCallback(
    providerID: string,
    method: number,
    code?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/provider/${encodeURIComponent(providerID)}/oauth/callback`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ method, code }),
        signal,
      },
    );
    if (!res.ok) throw await this.apiError(res, "Login did not complete");
    await this.disposeInstance();
  }

  /** Refresh provider cache. */
  async refreshProviderCache(): Promise<void> {
    await this.disposeInstance();
  }

  /** Dispose instances across all scopes. */
  private async disposeInstance(): Promise<void> {
    for (const q of new Set(["", this.dirQuery()])) {
      await this.fetchImpl(`${this.baseUrl}/instance/dispose${q}`, {
        method: "POST",
        headers: this.headers(true),
        body: "{}",
      }).catch(() => undefined);
    }
  }

  /** Send slash command. */
  async runCommand(sessionId: string, command: string, args?: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/command`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ command, ...(args ? { arguments: args } : {}) }),
      },
    );
    if (!res.ok) throw await this.apiError(res, `Failed to run /${command}`);
  }

  /** Run shell command. */
  async runShell(sessionId: string, command: string, agent = "build"): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/shell`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ agent, command }),
      },
    );
    if (!res.ok) throw await this.apiError(res, "Command failed to run");
  }

  /** Send prompt to session. */
  async sendPrompt(
    sessionId: string,
    text: string,
    agent?: string,
    model?: string | null,
    variant?: string | null,
  ): Promise<void> {
    const m = parseModel(model);
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}/session/${encodeURIComponent(sessionId)}/prompt_async`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({
          parts: [{ type: "text", text }],
          ...(agent ? { agent } : {}),
          ...(m ? { model: m } : {}),
          system: ARTIFACT_PRESENTATION_SYSTEM,
          ...(variant ? { variant } : {}),
        }),
      },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to send prompt");
  }

  /** List questions. */
  async listQuestions(_sessionId?: string): Promise<QuestionAskedEvent[]> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/question${this.dirQuery()}`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    const arr = (await res.json()) as Array<{
      id: string;
      sessionID: string;
      questions?: QuestionAskedEvent["questions"];
    }>;
    return arr.map((q) => ({
      type: "question.asked" as const,
      sessionId: q.sessionID,
      requestId: q.id,
      questions: q.questions ?? [],
    }));
  }

  /** Answer a question. */
  async answerQuestion(requestId: string, answers: string[][]): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/question/${encodeURIComponent(requestId)}/reply${this.dirQuery()}`,
      { method: "POST", headers: this.headers(true), body: JSON.stringify({ answers }) },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to answer the question");
  }

  /** Reject a question. */
  async rejectQuestion(requestId: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/question/${encodeURIComponent(requestId)}/reject${this.dirQuery()}`,
      { method: "POST", headers: this.headers(true), body: "{}" },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to reject the question");
  }

  /** List permissions. */
  async listPermissions(_sessionId?: string): Promise<PermissionAskedEvent[]> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/permission${this.dirQuery()}`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    const arr = (await res.json()) as Array<{
      id: string;
      sessionID: string;
      permission?: string;
      patterns?: string[];
      action?: string;
      resources?: string[];
    }>;
    return arr.map((p) => ({
      type: "permission.asked" as const,
      sessionId: p.sessionID,
      requestId: p.id,
      action: p.permission ?? p.action ?? "action",
      resources: p.patterns ?? p.resources ?? [],
    }));
  }

  /** Reply to permission. */
  async replyPermission(requestId: string, reply: PermissionReply): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/permission/${encodeURIComponent(requestId)}/reply${this.dirQuery()}`,
      { method: "POST", headers: this.headers(true), body: JSON.stringify({ reply }) },
    );
    if (!res.ok) throw await this.apiError(res, "Failed to reply to permission");
  }

  /** List agents. */
  async listAgents(): Promise<AgentInfo[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/agent`, { headers: this.headers() });
    if (!res.ok) throw await this.apiError(res, "Failed to list agents");
    return (await res.json()) as AgentInfo[];
  }

  /** Create session with error handling. */
  async createSessionWithRetry(title?: string, retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.createSession(title);
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
    throw new Error("Failed to create session after retries");
  }

  /** Close connection. */
  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.es?.close();
    this.es = null;
    this.abort?.abort();
    this.abort = null;
    this.setStatus("offline");
  }

  /** API error handler. */
  private async apiError(res: Response, what: string): Promise<Error> {
    let detail = "";
    try {
      const body = (await res.json()) as { data?: { message?: string }; message?: string };
      detail = body.data?.message ?? body.message ?? "";
    } catch {
      /* not JSON */
    }
    return new Error(`${what} (${res.status}${detail ? `: ${detail}` : ""})`);
  }

  /** Normalize OpenCode raw events. */
  private normalize(event: OpenCodeRawEvent): void {
    const p = event.properties ?? {};
    const sessionId = String(p.sessionID ?? p.sessionId ?? "");
    switch (event.type) {
      case "message.part.updated": {
        const part = p.part as
          | {
              id?: string;
              type?: string;
              text?: string;
              callID?: string;
              tool?: string;
              state?: Record<string, unknown>;
            }
          | undefined;
        if (!part) break;
        if (part.type === "text" && typeof part.text === "string") {
          this.deltaText.set(String(part.id ?? ""), part.text);
          this.emit({ type: "text.updated", sessionId, partId: String(part.id ?? ""), text: part.text });
        } else if (part.type === "reasoning" && typeof part.text === "string") {
          this.deltaReasoning.set(String(part.id ?? ""), part.text);
          this.emit({ type: "reasoning.updated", sessionId, partId: String(part.id ?? ""), text: part.text });
        } else if (part.type === "tool") {
          const st = (part.state ?? {}) as Record<string, unknown>;
          const meta = (st.metadata ?? {}) as Record<string, unknown>;
          const time = (st.time ?? {}) as Record<string, unknown>;
          this.emit({
            type: "tool.updated",
            sessionId,
            callId: String(part.callID ?? part.id ?? ""),
            tool: String(part.tool ?? ""),
            status: mapToolStatus(String(st.status ?? "pending")),
            title: typeof st.title === "string" ? st.title : undefined,
            input:
              typeof st.input === "object" && st.input !== null
                ? (st.input as Record<string, unknown>)
                : undefined,
            output: typeof st.output === "string" ? st.output : undefined,
            partialOutput: typeof meta.output === "string" ? meta.output : undefined,
            diff: typeof meta.diff === "string" ? meta.diff : undefined,
            startedAt: typeof time.start === "number" ? time.start : undefined,
            endedAt: typeof time.end === "number" ? time.end : undefined,
            childSessionId: typeof st.childSessionId === "string" ? st.childSessionId : undefined,
          });
        }
        break;
      }
      case "message.part.delta": {
        const partId = String(p.partID ?? "");
        const field = String(p.field ?? "text");
        const delta = String(p.delta ?? "");
        if (field === "reasoning") {
          const next = (this.deltaReasoning.get(partId) ?? "") + delta;
          this.deltaReasoning.set(partId, next);
          this.emit({ type: "reasoning.updated", sessionId, partId, text: next });
        } else {
          const next = (this.deltaText.get(partId) ?? "") + delta;
          this.deltaText.set(partId, next);
          this.emit({ type: "text.updated", sessionId, partId, text: next });
        }
        break;
      }
      case "session.idle": {
        this.emit({ type: "session.idle", sessionId });
        break;
      }
      case "session.status": {
        const st = p.status as { type?: string; attempt?: number; message?: string; next?: number } | undefined;
        if (st?.type === "retry") {
          this.emit({
            type: "session.retry",
            sessionId,
            attempt: st.attempt ?? 1,
            message: String(st.message ?? ""),
            nextAt: st.next ?? Date.now(),
          });
        }
        break;
      }
      case "session.error": {
        const err = p.error as { message?: string; data?: { message?: string } } | undefined;
        const message = err?.data?.message ?? err?.message ?? String(p.error ?? "");
        this.emit({ type: "error", sessionId, message });
        break;
      }
      case "session.step":
      case "step-start": {
        const step = typeof p.step === "number" ? p.step : Number(p.step ?? 1);
        if (Number.isFinite(step)) this.emit({ type: "step.updated", sessionId, step });
        break;
      }
      case "session.compacted": {
        this.emit({
          type: "session.compacted",
          sessionId,
          auto: p.auto !== false,
          overflow: typeof p.overflow === "boolean" ? p.overflow : undefined,
        });
        break;
      }
      case "question.asked": {
        const requestId = String(p.requestID ?? p.requestId ?? "");
        const raw = p.question ?? p.questions;
        const questions = Array.isArray(raw) ? raw : raw ? [raw] : [];
        this.emit({
          type: "question.asked",
          sessionId,
          requestId,
          questions: questions.map((q) => {
            const item = q as Record<string, unknown>;
            return {
              question: String(item.question ?? ""),
              header: String(item.header ?? ""),
              options: Array.isArray(item.options)
                ? (item.options as Array<Record<string, unknown>>).map((o) => ({
                    label: String(o.label ?? ""),
                    description: typeof o.description === "string" ? o.description : undefined,
                  }))
                : [],
              multiple: Boolean(item.multiple),
              custom: Boolean(item.custom),
            };
          }),
        });
        break;
      }
      case "question.resolved": {
        this.emit({
          type: "question.resolved",
          sessionId,
          requestId: String(p.requestID ?? p.requestId ?? ""),
        });
        break;
      }
      case "permission.asked": {
        this.emit({
          type: "permission.asked",
          sessionId,
          requestId: String(p.requestID ?? p.requestId ?? ""),
          action: String(p.action ?? "unknown"),
          resources: Array.isArray(p.resources) ? p.resources.map(String) : [String(p.resource ?? "")].filter(Boolean),
        });
        break;
      }
      case "permission.resolved": {
        this.emit({
          type: "permission.resolved",
          sessionId,
          requestId: String(p.requestID ?? p.requestId ?? ""),
        });
        break;
      }
      case "message.updated":
      case "message.agent": {
        this.emit({
          type: "message.agent",
          sessionId,
          messageID: typeof p.messageID === "string" ? p.messageID : undefined,
          agent: typeof p.agent === "string" ? p.agent : undefined,
        });
        break;
      }
      default:
        break;
    }
  }

  /** Read event stream. */
  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line; each frame's `data:` line
        // holds one JSON payload (multi-line data is joined by the server).
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLines = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart());
          if (dataLines.length === 0) continue;
          const payload = dataLines.join("\n");
          try {
            this.normalize(JSON.parse(payload) as OpenCodeRawEvent);
          } catch {
            /* ignore malformed frames */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
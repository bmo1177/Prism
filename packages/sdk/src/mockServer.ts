// A minimal OpenCode-protocol server for tests and local dev. Node-only.
// Implements the endpoints the app uses (POST /session, POST /session/:id/prompt_async,
// GET /event SSE) and streams an OpenCode-shaped agent turn. Also serves the
// /v1 gateway contract (whoami, runs, provenance, health) the SDK services hit.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface MockOpenCode {
  port: number;
  /** Every request seen, as "METHOD /path" — lets tests assert call order. */
  requests: string[];
  /** Parsed prompt_async bodies, in order — lets tests assert the wire shape
   *  (e.g. the optional agent field is present exactly when passed). */
  promptBodies: unknown[];
  close: () => Promise<void>;
}

export function startMockOpenCode(port = 0): Promise<MockOpenCode> {
  const clients = new Set<ServerResponse>();
  const requests: string[] = [];
  const promptBodies: unknown[] = [];

  const send = (res: ServerResponse, obj: unknown) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    (res as unknown as { flush?: () => void }).flush?.();
  };

  const messages: Record<string, Array<{ info: unknown; parts: unknown[] }>> = {};

  // ---- canned /v1 gateway data (RunService / ProvenanceService / whoami) ----
  const mockRuns = [
    { runId: "run_mock1", ts: 1700000100, sessionId: "ses_mock", command: "python train.py --lr 3e-4", status: "ok", surface: "local", logHash: "hash1", wallMs: 1234 },
    { runId: "run_mock2", ts: 1699999000, command: "julia solve.jl", status: "failed", surface: "local", logHash: "hash2" },
    { runId: "run_mock3", ts: 1699998000, command: "sbatch job.sh", status: "ok", surface: "hpc" },
  ];
  const mockLogs: Record<string, string> = {
    hash1: "Training loss: 0.31\nEpoch 5/5 done.\n",
    hash2: "Error: dimension mismatch\n",
  };
  const mockProvenance = [
    { path: "data/notes.md", version: 1, ts: 1700000000, tool: "write", sessionId: "ses_mock", log: "draft notes" },
    { path: "data/notes.md", version: 2, ts: 1700000100, tool: "edit", sessionId: "ses_mock", diff: "-draft\n+revised" },
  ];

  const streamTurn = (sessionID: string) => {
    const push = (obj: unknown) => clients.forEach((c) => send(c, obj));
    const P = (part: Record<string, unknown>) =>
      push({ type: "message.part.updated", properties: { part: { sessionID, ...part } } });
    // Real OpenCode streams text as an empty part at text-start, per-token
    // message.part.delta events, then the full part again at text-end.
    const D = (partID: string, delta: string) =>
      push({ type: "message.part.delta", properties: { sessionID, messageID: "m1", partID, field: "text", delta } });
    P({ id: "p1", type: "text", text: "" });
    D("p1", "Planning ");
    D("p1", "the analysis. ");
    P({ id: "p1", type: "text", text: "Planning the analysis. " });
    P({ id: "c1", type: "tool", callID: "c1", tool: "literature-search", state: { status: "running", title: "literature-search (OpenAlex)" } });
    P({ id: "c1", type: "tool", callID: "c1", tool: "literature-search", state: { status: "completed", title: "literature-search (OpenAlex, PubMed)" } });
    P({ id: "p2", type: "text", text: "Wrote data/corpus.csv and drafted report.md." });
    push({ type: "session.idle", properties: { sessionID } });
    messages[sessionID] = [
      { info: { role: "user" }, parts: [{ type: "text", text: "run a literature review" }] },
      { info: { role: "assistant", time: { created: 1, completed: 2 } }, parts: [{ type: "text", text: "Planning the analysis. Wrote data/corpus.csv." }] },
    ];
  };

  // A turn whose model call fails: the server announces the retry via
  // session.status, gives up with session.error, and the stored assistant
  // message carries the error (that is all a reloaded history has to show).
  const streamFlakyTurn = (sessionID: string) => {
    const push = (obj: unknown) => clients.forEach((c) => send(c, obj));
    const error = { name: "APICallError", data: { message: "no channel available for this model" } };
    push({
      type: "session.status",
      properties: { sessionID, status: { type: "retry", attempt: 2, message: error.data.message, next: 1234 } },
    });
    push({ type: "session.error", properties: { sessionID, error } });
    push({ type: "session.idle", properties: { sessionID } });
    messages[sessionID] = [
      { info: { role: "user" }, parts: [{ type: "text", text: "flaky" }] },
      { info: { role: "assistant", time: { created: 1, completed: 2 }, error }, parts: [] },
    ];
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    requests.push(`${req.method} ${url}`);
    if (req.method === "POST" && url.split("?")[0] === "/instance/dispose") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("true");
      return;
    }
    // A provider whose key the server rejects — carries a diagnostic message.
    if (req.method === "PUT" && url === "/auth/bad") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ name: "InvalidKey", data: { message: "invalid key format" } }));
      return;
    }
    if (req.method === "POST" && url === "/provider/slow/oauth/callback") {
      // Never answers — like a real "auto" flow waiting on the browser
      // redirect. Lets tests exercise cancelling the pending login.
      return;
    }
    if (req.method === "POST" && /^\/provider\/[^/]+\/oauth\/callback$/.test(url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("true");
      return;
    }
    if (req.method === "GET" && url.startsWith("/event")) {
      req.socket.setNoDelay(true);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      send(res, { type: "server.connected", properties: {} });
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "POST" && /^\/session\/?$/.test(url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "ses_mock", title: "New session", slug: "mock" }));
      return;
    }
    if (req.method === "GET" && /^\/session\/?$/.test(url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ id: "ses_mock", title: "New session", slug: "mock" }]));
      return;
    }
    if (req.method === "DELETE" && /^\/session\/[^/]+$/.test(url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("true");
      return;
    }
    if (req.method === "POST" && /^\/session\/[^/]+\/abort$/.test(url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("true");
      return;
    }
    if (req.method === "POST" && /^\/session\/[^/]+\/(un)?revert$/.test(url)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    const mm = url.match(/^\/session\/([^/]+)\/message/);
    if (req.method === "GET" && mm) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(messages[decodeURIComponent(mm[1])] ?? []));
      return;
    }
    // v1 shape: a bare array, unsorted (OpenCode returns discovery order).
    if (req.method === "GET" && url.startsWith("/skill")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          { name: "home-skill", description: "From ~/.claude/skills.", location: "/home/u/.claude/skills/home-skill/SKILL.md" },
          { name: "customize-opencode", description: "Configure OpenCode.", location: "<built-in>" },
        ]),
      );
      return;
    }
    if (req.method === "GET" && url === "/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ model: "mock/mock-model" }));
      return;
    }
    if (req.method === "PATCH" && (url === "/config" || url === "/global/config")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    if (req.method === "GET" && url === "/config/providers") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          providers: [
            { id: "mock", name: "Mock Provider", models: { "mock-model": { name: "Mock Model" } } },
          ],
        }),
      );
      return;
    }
    if (req.method === "GET" && url === "/provider") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          all: [
            { id: "mock", name: "Mock Provider", env: ["MOCK_API_KEY"] },
            { id: "anthropic", name: "Anthropic", env: ["ANTHROPIC_API_KEY"] },
          ],
          connected: ["mock"],
        }),
      );
      return;
    }
    if (req.method === "GET" && url === "/provider/auth") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ mock: [{ type: "api", label: "Manually enter API Key" }] }));
      return;
    }
    if ((req.method === "PUT" || req.method === "DELETE") && url.startsWith("/auth/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("true");
      return;
    }
    if (req.method === "GET" && (url === "/agent" || url === "/api/agent")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ name: "build", description: "Default agent.", mode: "primary" }]));
      return;
    }
    if (req.method === "GET" && url.startsWith("/command")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          { name: "init", description: "guided AGENTS.md setup", source: "command" },
          { name: "analyze-data", description: "Analyze a dataset end to end.", source: "skill" },
        ]),
      );
      return;
    }
    const sh = url.match(/^\/session\/([^/]+)\/shell/);
    if (req.method === "POST" && sh) {
      const sessionID = decodeURIComponent(sh[1]);
      const push = (obj: unknown) => clients.forEach((c) => send(c, obj));
      push({
        type: "message.part.updated",
        properties: {
          part: {
            sessionID,
            id: "psh",
            type: "tool",
            callID: "csh",
            tool: "bash",
            state: { status: "completed", title: "pwd", input: { command: "pwd" }, output: "/ws/mock\n" },
          },
        },
      });
      push({ type: "session.idle", properties: { sessionID } });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ info: { role: "assistant" }, parts: [] }));
      return;
    }
    const cm = url.match(/^\/session\/([^/]+)\/command/);
    if (req.method === "POST" && cm) {
      const sessionID = decodeURIComponent(cm[1]);
      streamTurn(sessionID);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ info: { role: "assistant" }, parts: [] }));
      return;
    }
    const m = url.match(/^\/session\/([^/]+)\/prompt_async/);
    if (req.method === "POST" && m) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          promptBodies.push(JSON.parse(body));
        } catch {
          promptBodies.push(body);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
        const turn = body.includes("flaky") ? streamFlakyTurn : streamTurn;
        setTimeout(() => turn(decodeURIComponent(m[1])), 5);
      });
      return;
    }
    // ---- /v1 gateway contract (RunService / ProvenanceService / whoami) ----
    const pathOnly = url.split("?")[0];
    const params = new URLSearchParams(url.split("?")[1] ?? "");

    if (req.method === "GET" && pathOnly === "/v1/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "craft-gateway" }));
      return;
    }
    if (req.method === "GET" && pathOnly === "/v1/whoami") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ mode: "full", directory: "/mock/workspace" }));
      return;
    }
    if (req.method === "GET" && pathOnly === "/v1/runs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockRuns));
      return;
    }
    if (req.method === "GET" && pathOnly === "/v1/runs/query") {
      let q: { search?: string; status?: string; surface?: string };
      try {
        q = JSON.parse(params.get("q") ?? "{}") as typeof q;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad query" }));
        return;
      }
      const rows = mockRuns.filter((r) => {
        if (q.search && !r.command.includes(q.search)) return false;
        if (q.status && r.status !== q.status) return false;
        if (q.surface && r.surface !== q.surface) return false;
        return true;
      });
      const facet = (field: "status" | "surface") => {
        const counts = new Map<string, number>();
        for (const r of rows) {
          if (!r[field]) continue;
          counts.set(r[field], (counts.get(r[field]) ?? 0) + 1);
        }
        return [...counts.entries()].map(([value, count]) => ({ value, count }));
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rows, total: rows.length, facets: { status: facet("status"), surface: facet("surface") } }));
      return;
    }
    if (req.method === "GET" && pathOnly === "/v1/runs/log") {
      const log = mockLogs[params.get("hash") ?? ""];
      if (log === undefined) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(log);
      return;
    }
    if (req.method === "GET" && pathOnly === "/v1/provenance/query") {
      let q: { search?: string; sessionId?: string; limit?: number };
      try {
        q = JSON.parse(params.get("q") ?? "{}") as typeof q;
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad query" }));
        return;
      }
      const rows = mockProvenance.filter((p) => {
        if (q.search && !(p.path + (p.log ?? "")).includes(q.search)) return false;
        if (q.sessionId && p.sessionId !== q.sessionId) return false;
        return true;
      });
      const total = rows.length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rows: q.limit ? rows.slice(0, q.limit) : rows, total }));
      return;
    }
    if (req.method === "GET" && pathOnly === "/v1/provenance") {
      const path = params.get("path") ?? "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockProvenance.filter((p) => p.path === path)));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        port: actualPort,
        requests,
        promptBodies,
        close: () =>
          new Promise((r) => {
            for (const c of clients) c.end();
            clients.clear();
            server.close(() => r());
          }),
      });
    });
  });
}

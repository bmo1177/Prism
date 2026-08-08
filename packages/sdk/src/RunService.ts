import type { RunConfig, RunFilters, RunPage, RunRecord } from "./types";

/** Retry an async fetch call a few times with a short backoff, so transient
 *  service restarts don't fail a user action. */
async function withRetry<T>(attempt: () => Promise<T>, tries = 3, delayMs = 250): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      if (i < tries - 1) await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

/**
 * Run service for starting, listing, and stopping runs.
 * Provides unified run operations with retry logic.
 */
export class RunService {
  constructor(private runUrl: string) {}

  /** Start a new run. */
  async startRun(config: RunConfig): Promise<RunRecord> {
    return withRetry(async () => {
      const response = await fetch(`${this.runUrl}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start run: ${response.status} ${await response.text()}`);
      }
      
      return response.json();
    });
  }

  /** Get a run by id. */
  async getRun(runId: string): Promise<RunRecord> {
    const response = await fetch(`${this.runUrl}/api/runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get run: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** List runs with pagination and filtering. */
  async listRuns(filters?: RunFilters): Promise<RunPage> {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.surface) params.set("surface", filters.surface);
    if (filters?.sessionId) params.set("sessionId", filters.sessionId);
    if (filters?.sinceTs) params.set("sinceTs", filters.sinceTs.toString());
    if (filters?.beforeTs) params.set("beforeTs", filters.beforeTs.toString());
    if (filters?.beforeRowid) params.set("beforeRowid", filters.beforeRowid.toString());
    if (filters?.limit) params.set("limit", filters.limit.toString());
    
    const queryString = params.toString();
    const response = await fetch(`${this.runUrl}/api/runs?${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list runs: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Stop a running run. */
  async stopRun(runId: string): Promise<void> {
    return withRetry(async () => {
      const response = await fetch(`${this.runUrl}/api/runs/${encodeURIComponent(runId)}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to stop run: ${response.status} ${await response.text()}`);
      }
    });
  }

  /** Health check for run service. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.runUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

import type { RunQuery, RunPage, RunRecord } from "./types";

/**
 * Run service for listing and querying runs.
 * Talks to the desktop gateway's /v1/runs contract.
 */
export class RunService {
  constructor(
    private baseUrl: string,
    private password?: string,
  ) {}

  /** Request headers, with the gateway bearer token when configured. */
  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.password) h["Authorization"] = `Bearer ${this.password}`;
    return h;
  }

  /** All recorded runs, newest first. */
  async listRuns(): Promise<RunRecord[]> {
    const response = await fetch(`${this.baseUrl}/v1/runs`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list runs: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  /** Query the runs index with search, filters, facets, and keyset paging. */
  async queryRuns(query: RunQuery): Promise<RunPage> {
    const q = encodeURIComponent(JSON.stringify(query));
    const response = await fetch(`${this.baseUrl}/v1/runs/query?q=${q}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to query runs: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  /** A run's captured stdout/stderr by its log hash. */
  async readRunLog(hash: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/runs/log?hash=${encodeURIComponent(hash)}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to read run log: ${response.status} ${await response.text()}`);
    }

    return response.text();
  }

  /** Health check for the run service. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/health`, {
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

import type { ProvenanceQuery, ProvenancePage, ProvenanceRecord } from "./types";

/**
 * Provenance service for artifact history with search and pagination.
 * Talks to the desktop gateway's /v1/provenance contract.
 */
export class ProvenanceService {
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

  /** Query provenance records with search and keyset pagination. */
  async queryProvenance(query: ProvenanceQuery): Promise<ProvenancePage> {
    const q = encodeURIComponent(JSON.stringify(query));
    const response = await fetch(`${this.baseUrl}/v1/provenance/query?q=${q}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to query provenance: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  /** All recorded versions of one artifact, oldest first. */
  async listProvenance(path: string): Promise<ProvenanceRecord[]> {
    const response = await fetch(`${this.baseUrl}/v1/provenance?path=${encodeURIComponent(path)}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      throw new Error(`Failed to list provenance: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  /** Health check for the provenance service. */
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

import type { ProvenanceQuery, ProvenancePage, ProvenanceRecord, RunRecord, RunFilters, RunPage } from "./types";

/**
 * Provenance service for artifact history with search and pagination.
 * Provides unified access to all recorded versions of files across all sessions.
 */
export class ProvenanceService {
  constructor(private provenanceUrl: string) {}

  /** List provenance records with advanced filtering. */
  async listProvenance(query?: ProvenanceQuery): Promise<ProvenancePage> {
    const params = new URLSearchParams();
    if (query?.sessionId) params.set("sessionId", query.sessionId);
    if (query?.search) params.set("search", query.search);
    if (query?.beforeIndex) params.set("beforeIndex", query.beforeIndex.toString());
    if (query?.limit) params.set("limit", query.limit.toString());
    
    const queryString = params.toString();
    const response = await fetch(`${this.provenanceUrl}/api/provenance?${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list provenance: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get specific provenance record by path and version. */
  async getProvenance(path: string, version: number): Promise<ProvenanceRecord> {
    const response = await fetch(`${this.provenanceUrl}/api/provenance/${encodeURIComponent(path)}/${version}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get provenance: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Record a new provenance entry (artifact version). */
  async recordProvenance(record: ProvenanceRecord): Promise<void> {
    const response = await fetch(`${this.provenanceUrl}/api/provenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to record provenance: ${response.status} ${await response.text()}`);
    }
  }

  /** Delete a specific provenance record. */
  async deleteProvenance(path: string, version: number): Promise<void> {
    const response = await fetch(`${this.provenanceUrl}/api/provenance/${encodeURIComponent(path)}/${version}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete provenance: ${response.status} ${await response.text()}`);
    }
  }

  /** Get all science skills from the provenance store. */
  async listScienceSkills(): Promise<any[]> {
    const response = await fetch(`${this.provenanceUrl}/api/provenance/science-skills`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list science skills: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Record a new run with full environment snapshot. */
  async recordRun(run: RunRecord): Promise<string> {
    const response = await fetch(`${this.provenanceUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to record run: ${response.status} ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.runId;
  }

  /** Get run by ID with environment and command. */
  async getRun(runId: string): Promise<RunRecord> {
    const response = await fetch(`${this.provenanceUrl}/api/runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get run: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** List all runs with pagination and filtering. */
  async listRuns(query?: RunFilters): Promise<RunPage> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.status) params.set("status", query.status);
    if (query?.surface) params.set("surface", query.surface);
    if (query?.sessionId) params.set("sessionId", query.sessionId);
    if (query?.sinceTs) params.set("sinceTs", query.sinceTs.toString());
    if (query?.beforeTs) params.set("beforeTs", query.beforeTs.toString());
    if (query?.beforeRowid) params.set("beforeRowid", query.beforeRowid.toString());
    if (query?.limit) params.set("limit", query.limit.toString());
    
    const queryString = params.toString();
    const response = await fetch(`${this.provenanceUrl}/api/runs?${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list runs: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Execute a command and capture its output as a run. */
  async executeCommand(command: string, sessionId?: string): Promise<RunRecord> {
    const response = await fetch(`${this.provenanceUrl}/api/runs/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, sessionId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to execute command: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get health status of the provenance service. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.provenanceUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
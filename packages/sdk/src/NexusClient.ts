import type { OpenCodeClient } from "./OpenCodeClient";
import { RunService } from "./RunService";
import { ProvenanceService } from "./ProvenanceService";
import { EnvironmentService } from "./EnvironmentService";
import { GitService } from "./GitService";
import { SkillDiscoveryService } from "./SkillDiscoveryService";
import { ConfigurationService } from "./ConfigurationService";
import { MonitoringService } from "./MonitoringService";
import type { HealthCheckResult, MonitoringMetrics } from "./types";

/** Endpoint configuration for every platform service. */
export interface NexusServicesConfig {
  openCodeUrl?: string;
  openCode?: OpenCodeClient;
  runUrl?: string;
  provenanceUrl?: string;
  environmentUrl?: string;
  gitUrl?: string;
  skillDiscoveryUrl?: string;
  configurationUrl?: string;
  monitoringUrl?: string;
}

/**
 * NexusClient orchestrates all platform services and provides unified API.
 * Manages connections, health checks, and cross-service operations.
 */
export class NexusClient {
  private openCodeClient?: OpenCodeClient;
  private runService?: RunService;
  private provenanceService?: ProvenanceService;
  private environmentService?: EnvironmentService;
  private gitService?: GitService;
  private skillDiscoveryService?: SkillDiscoveryService;
  private configurationService?: ConfigurationService;
  private monitoringService?: MonitoringService;

  constructor(private services: NexusServicesConfig) {
    this.initializeServices();
  }

  private initializeServices(): void {
    if (this.services.openCode) this.openCodeClient = this.services.openCode;
    if (this.services.runUrl) this.runService = new RunService(this.services.runUrl);
    if (this.services.provenanceUrl) this.provenanceService = new ProvenanceService(this.services.provenanceUrl);
    if (this.services.environmentUrl) this.environmentService = new EnvironmentService(this.services.environmentUrl);
    if (this.services.gitUrl) this.gitService = new GitService(this.services.gitUrl);
    if (this.services.skillDiscoveryUrl) {
      this.skillDiscoveryService = new SkillDiscoveryService(this.services.skillDiscoveryUrl);
    }
    if (this.services.configurationUrl) {
      this.configurationService = new ConfigurationService(this.services.configurationUrl);
    }
    if (this.services.monitoringUrl) {
      this.monitoringService = new MonitoringService(this.services.monitoringUrl);
    }
  }

  /** Accessors for individual services. */
  getOpenCodeClient(): OpenCodeClient | undefined {
    return this.openCodeClient;
  }

  getRunService(): RunService | undefined {
    return this.runService;
  }

  getProvenanceService(): ProvenanceService | undefined {
    return this.provenanceService;
  }

  getEnvironmentService(): EnvironmentService | undefined {
    return this.environmentService;
  }

  getGitService(): GitService | undefined {
    return this.gitService;
  }

  getSkillDiscoveryService(): SkillDiscoveryService | undefined {
    return this.skillDiscoveryService;
  }

  getConfigurationService(): ConfigurationService | undefined {
    return this.configurationService;
  }

  getMonitoringService(): MonitoringService | undefined {
    return this.monitoringService;
  }

  // Connection management
  async connectAll(): Promise<void> {
    await Promise.all([
      this.openCodeClient?.connect(),
      this.runService?.healthCheck(),
      this.provenanceService?.healthCheck(),
      this.environmentService?.healthCheck(),
      this.gitService?.healthCheck(),
      this.skillDiscoveryService?.healthCheck(),
      this.configurationService?.healthCheck(),
      this.monitoringService?.healthCheck(),
    ]);
  }

  async disconnectAll(): Promise<void> {
    this.openCodeClient?.close();
    await Promise.all([
      this.runService?.healthCheck(),
      this.provenanceService?.healthCheck(),
      this.environmentService?.healthCheck(),
      this.gitService?.healthCheck(),
      this.skillDiscoveryService?.healthCheck(),
      this.configurationService?.healthCheck(),
      this.monitoringService?.healthCheck(),
    ]);
  }

  async reset(): Promise<void> {
    await this.openCodeClient?.reset();
  }

  // Unified session management
  async createSession(title?: string): Promise<string> {
    return (await this.openCodeClient?.createSession(title)) ?? "";
  }

  async listSessions(): Promise<any[]> {
    return (await this.openCodeClient?.listSessions()) ?? [];
  }

  // Unified skill discovery
  async discoverSkills(): Promise<any[]> {
    return (await this.skillDiscoveryService?.discoverSkills()) ?? [];
  }

  // Unified provenance operations
  async getProvenance(query?: any): Promise<any> {
    return this.provenanceService?.listProvenance(query);
  }

  // Unified environment operations
  async getEnvironment(): Promise<any> {
    return this.environmentService?.getEnvironment();
  }

  // Unified run operations
  async startRun(config: any): Promise<any> {
    return this.runService?.startRun(config);
  }

  async listRuns(filters?: any): Promise<any> {
    return this.runService?.listRuns(filters);
  }

  async stopRun(runId: string): Promise<void> {
    return this.runService?.stopRun(runId);
  }

  // Unified git operations
  async cloneRepository(url: string, options?: any): Promise<any> {
    return this.gitService?.cloneRepository(url, options);
  }

  async getRepositoryStatus(path: string): Promise<any> {
    return this.gitService?.getRepositoryStatus(path);
  }

  // Unified configuration operations
  async getConfig(): Promise<any> {
    return this.configurationService?.getConfig();
  }

  async updateConfig(config: any): Promise<void> {
    return this.configurationService?.updateConfig(config);
  }

  // Unified monitoring operations
  async getMetrics(): Promise<MonitoringMetrics | undefined> {
    return this.monitoringService?.getMetrics();
  }

  async getHealthChecks(): Promise<HealthCheckResult[] | undefined> {
    return this.monitoringService?.getHealthChecks();
  }

  // Health checks for all services
  async healthCheck(): Promise<any> {
    const results = await Promise.allSettled([
      this.openCodeClient?.healthCheck(),
      this.runService?.healthCheck(),
      this.provenanceService?.healthCheck(),
      this.environmentService?.healthCheck(),
      this.gitService?.healthCheck(),
      this.skillDiscoveryService?.healthCheck(),
      this.configurationService?.healthCheck(),
      this.monitoringService?.healthCheck(),
    ]);

    return {
      openCode: results[0].status === "fulfilled" ? results[0].value : false,
      run: results[1].status === "fulfilled" ? results[1].value : false,
      provenance: results[2].status === "fulfilled" ? results[2].value : false,
      environment: results[3].status === "fulfilled" ? results[3].value : false,
      git: results[4].status === "fulfilled" ? results[4].value : false,
      skillDiscovery: results[5].status === "fulfilled" ? results[5].value : false,
      configuration: results[6].status === "fulfilled" ? results[6].value : false,
      monitoring: results[7].status === "fulfilled" ? results[7].value : false,
    };
  }

  // Utility methods
  getStatus(): string {
    return this.openCodeClient?.getStatus() ?? "offline";
  }

  // Event listeners
  onStatusChange(listener: (status: string) => void): () => void {
    if (!this.openCodeClient) return () => {};
    return this.openCodeClient.onStatus((status) => listener(status));
  }
}

/**
 * Default NexusClient factory function.
 */
export function createNexusClient(config?: NexusServicesConfig): NexusClient {
  return new NexusClient(config || {});
}

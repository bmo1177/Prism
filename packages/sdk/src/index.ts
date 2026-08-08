import type { OpenCodeClient } from "./OpenCodeClient";
import type { ProvenanceClient } from "./ProvenanceClient";
import type { EnvironmentClient } from "./EnvironmentClient";

export type { OpenCodeClientOptions } from "./OpenCodeClient";

/** Core Nexus client that unifies access to all backend services. */
export { OpenCodeClient } from "./OpenCodeClient";

/** Run operations service (start/list/stop runs with retry logic). */
export { RunService } from "./RunService";

/** Provenance service (artifact history with search/paging). */
export { ProvenanceService } from "./ProvenanceService";

/** Environment service (detect and cache Python/packages/system). */
export { EnvironmentService } from "./EnvironmentService";

/** Git service (repository operations). */
export { GitService } from "./GitService";

/** Skill discovery (unified skill registry across bundles). */
export { SkillDiscoveryService } from "./SkillDiscoveryService";

/** Configuration service (centralized platform settings). */
export { ConfigurationService } from "./ConfigurationService";

/** Monitoring & observability (logging/metrics/health checks). */
export { MonitoringService } from "./MonitoringService";

/** Type definitions for all platform services. */
export type {
  SessionMeta,
  SessionPage,
  SessionQuery,
  RunConfig,
  RunFilters,
  RunPage,
  RunFacet,
  RunRecord,
  ProvenanceRecord,
  ProvenanceQuery,
  ProvenancePage,
  EnvironmentInfo,
  EnvironmentSnapshot,
  GitStatus,
  GitLogEntry,
  SkillInfo,
  SkillMetadata,
  PlatformProfile,
  MonitoringMetrics,
  HealthCheckResult,
  LogEntry,
  PlatformConfig,
  ConfigurationChange,
} from "./types";
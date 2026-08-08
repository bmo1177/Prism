import type { LogEntry, HealthCheckResult, MonitoringMetrics } from "./types";

/**
 * Monitoring service for logging, metrics, and health checks.
 * Provides comprehensive monitoring capabilities.
 */
export class MonitoringService {
  constructor(private monitoringUrl: string) {}

  /** Log a message. */
  async log(level: string, message: string, context?: any): Promise<void> {
    const response = await fetch(`${this.monitoringUrl}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, message, context }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to log: ${response.status} ${await response.text()}`);
    }
  }

  /** Get metrics. */
  async getMetrics(): Promise<MonitoringMetrics> {
    const response = await fetch(`${this.monitoringUrl}/api/metrics`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get metrics: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get health check results. */
  async getHealthChecks(): Promise<HealthCheckResult[]> {
    const response = await fetch(`${this.monitoringUrl}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get health checks: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Perform health check. */
  async performHealthCheck(service: string): Promise<HealthCheckResult> {
    const response = await fetch(`${this.monitoringUrl}/api/health/${encodeURIComponent(service)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to perform health check: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get log entries. */
  async getLogEntries(level?: string, limit?: number, offset?: number, startTime?: string, endTime?: string): Promise<LogEntry[]> {
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (limit) params.set("limit", limit.toString());
    if (offset) params.set("offset", offset.toString());
    if (startTime) params.set("startTime", startTime);
    if (endTime) params.set("endTime", endTime);
    
    const query = params.toString();
    const response = await fetch(`${this.monitoringUrl}/api/logs?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get log entries: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Search log entries. */
  async searchLogs(query: string, options?: any): Promise<LogEntry[]> {
    const params = new URLSearchParams();
    params.set("query", query);
    if (options?.level) params.set("level", options.level);
    if (options?.startTime) params.set("startTime", options.startTime);
    if (options?.endTime) params.set("endTime", options.endTime);
    if (options?.limit) params.set("limit", options.limit.toString());
    
    const queryString = params.toString();
    const response = await fetch(`${this.monitoringUrl}/api/logs/search?${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search logs: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get analytics data. */
  async getAnalytics(metrics?: any): Promise<any> {
    const response = await fetch(`${this.monitoringUrl}/api/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get analytics: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get system metrics. */
  async getSystemMetrics(): Promise<any> {
    const response = await fetch(`${this.monitoringUrl}/api/metrics/system`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get system metrics: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Aggregate metrics. */
  async getAggregateMetrics(timeRange?: any): Promise<any> {
    const response = await fetch(`${this.monitoringUrl}/api/metrics/aggregate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeRange }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get aggregate metrics: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get error rate. */
  async getErrorRate(timeRange?: any): Promise<number> {
    const response = await fetch(`${this.monitoringUrl}/api/metrics/error-rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeRange }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get error rate: ${response.status} ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.errorRate;
  }

  /** Get performance metrics. */
  async getPerformanceMetrics(): Promise<any> {
    const response = await fetch(`${this.monitoringUrl}/api/metrics/performance`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get performance metrics: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Health check for monitoring service. */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(`${this.monitoringUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      
      if (!response.ok) {
        return { status: "unhealthy", error: `HTTP ${response.status}` };
      }
      
      const health = await response.json();
      return {
        status: health.status || "healthy",
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return { status: "unhealthy", error: String(error) };
    }
  }
}

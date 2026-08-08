import type { EnvironmentInfo, HardwareInfo, PackageSnapshot } from "./types";

/**
 * Environment service for detecting and caching Python/packages/system environment.
 * Provides comprehensive environment detection and analysis.
 */
export class EnvironmentService {
  constructor(private environmentUrl: string) {}

  /** Get complete environment snapshot. */
  async getEnvironment(): Promise<EnvironmentInfo> {
    const response = await fetch(`${this.environmentUrl}/api/environment/snapshot`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get environment snapshot: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Update environment with new snapshot. */
  async updateEnvironment(env: EnvironmentInfo): Promise<void> {
    const response = await fetch(`${this.environmentUrl}/api/environment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(env),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update environment: ${response.status} ${await response.text()}`);
    }
  }

  /** Get cached Python packages. */
  async getPythonPackages(): Promise<PackageSnapshot> {
    const response = await fetch(`${this.environmentUrl}/api/environment/python-packages`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get Python packages: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get system hardware information. */
  async getHardwareInfo(): Promise<HardwareInfo> {
    const response = await fetch(`${this.environmentUrl}/api/environment/hardware`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get hardware info: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get Python version. */
  async getPythonVersion(): Promise<string> {
    const response = await fetch(`${this.environmentUrl}/api/environment/python-version`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get Python version: ${response.status} ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.version;
  }

  /** Get operating system information. */
  async getOSInfo(): Promise<any> {
    const response = await fetch(`${this.environmentUrl}/api/environment/os`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get OS info: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get environment compatibility status. */
  async getCompatibility(): Promise<any> {
    const response = await fetch(`${this.environmentUrl}/api/environment/compatibility`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get compatibility: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Cache environment snapshot for offline use. */
  async cacheEnvironment(env: EnvironmentInfo, ttl?: number): Promise<void> {
    const response = await fetch(`${this.environmentUrl}/api/environment/cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ env, ttl }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to cache environment: ${response.status} ${await response.text()}`);
    }
  }

  /** Get cached environment by version. */
  async getCachedEnvironment(version: string): Promise<EnvironmentInfo> {
    const response = await fetch(`${this.environmentUrl}/api/environment/cache/${encodeURIComponent(version)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get cached environment: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** List all cached environments. */
  async listCachedEnvironments(): Promise<string[]> {
    const response = await fetch(`${this.environmentUrl}/api/environment/cache`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list cached environments: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Health check for environment service. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.environmentUrl}/api/health`, {
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

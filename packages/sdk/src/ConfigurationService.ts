import type {
  PlatformProfile,
  ConfigurationChange,
  HealthCheckResult,
} from "./types";

/**
 * Configuration service for centralized platform settings and profiles.
 * Provides unified interface for platform configuration management.
 */
export class ConfigurationService {
  constructor(private configUrl: string) {}

  /** Get all platform configuration. */
  async getConfig(): Promise<any> {
    const response = await fetch(`${this.configUrl}/api/config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get config: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Update platform configuration. */
  async updateConfig(config: any): Promise<void> {
    const response = await fetch(`${this.configUrl}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update config: ${response.status} ${await response.text()}`);
    }
  }

  /** Get configuration by key. */
  async getConfigByKey(key: string): Promise<any> {
    const response = await fetch(`${this.configUrl}/api/config/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get config by key: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Set configuration by key. */
  async setConfigByKey(key: string, value: any): Promise<void> {
    const response = await fetch(`${this.configUrl}/api/config/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to set config by key: ${response.status} ${await response.text()}`);
    }
  }

  /** Get all configuration profiles. */
  async getConfigProfiles(): Promise<PlatformProfile[]> {
    const response = await fetch(`${this.configUrl}/api/config/profiles`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get config profiles: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Create a new configuration profile. */
  async createConfigProfile(profile: PlatformProfile): Promise<void> {
    const response = await fetch(`${this.configUrl}/api/config/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create config profile: ${response.status} ${await response.text()}`);
    }
  }

  /** Get profile by ID. */
  async getProfileById(profileId: string): Promise<PlatformProfile> {
    const response = await fetch(`${this.configUrl}/api/config/profiles/${encodeURIComponent(profileId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get profile by id: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Update profile. */
  async updateProfile(profileId: string, profile: PlatformProfile): Promise<void> {
    const response = await fetch(`${this.configUrl}/api/config/profiles/${encodeURIComponent(profileId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update profile: ${response.status} ${await response.text()}`);
    }
  }

  /** Delete profile. */
  async deleteProfile(profileId: string): Promise<void> {
    const response = await fetch(`${this.configUrl}/api/config/profiles/${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete profile: ${response.status} ${await response.text()}`);
    }
  }

  /** Get configuration schema. */
  async getConfigSchema(): Promise<any> {
    const response = await fetch(`${this.configUrl}/api/config/schema`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get config schema: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Validate configuration. */
  async validateConfig(config: any): Promise<any> {
    const response = await fetch(`${this.configUrl}/api/config/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to validate config: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Export configuration. */
  async exportConfig(format?: string): Promise<any> {
    const params = new URLSearchParams();
    if (format) params.set("format", format);
    
    const query = params.toString();
    const response = await fetch(`${this.configUrl}/api/config/export?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to export config: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Import configuration. */
  async importConfig(config: any, format?: string): Promise<void> {
    const params = new URLSearchParams();
    if (format) params.set("format", format);
    
    const query = params.toString();
    const response = await fetch(`${this.configUrl}/api/config/import?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to import config: ${response.status} ${await response.text()}`);
    }
  }

  /** Get configuration changes. */
  async getConfigurationChanges(since?: number): Promise<ConfigurationChange[]> {
    const params = new URLSearchParams();
    if (since) params.set("since", since.toString());
    
    const query = params.toString();
    const response = await fetch(`${this.configUrl}/api/config/changes?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get configuration changes: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get configuration diff. */
  async getConfigDiff(version1: string, version2: string): Promise<any> {
    const response = await fetch(`${this.configUrl}/api/config/diff/${encodeURIComponent(version1)}/${encodeURIComponent(version2)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get config diff: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Health check for configuration service. */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(`${this.configUrl}/api/health`, {
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

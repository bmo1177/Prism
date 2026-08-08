/**
 * Skill discovery service for unified skill registry across bundles.
 */
export class SkillDiscoveryService {
  constructor(private skillDiscoveryUrl: string) {}

  /** Discover all available skills. */
  async discoverSkills(): Promise<any[]> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/discover`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to discover skills: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get skill metadata by ID. */
  async getSkillMetadata(skillId: string): Promise<any> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/${encodeURIComponent(skillId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get skill metadata: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Search for skills by query. */
  async searchSkills(query: string, filters?: any): Promise<any[]> {
    const params = new URLSearchParams();
    params.set("query", query);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.tags) params.set("tags", filters.tags.join(","));
    if (filters?.language) params.set("language", filters.language);
    if (filters?.type) params.set("type", filters.type);
    
    const queryString = params.toString();
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/search?${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search skills: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get skill categories. */
  async getSkillCategories(): Promise<any[]> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/categories`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get skill categories: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get skill tags. */
  async getSkillTags(): Promise<string[]> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get skill tags: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get recommended skills based on context. */
  async getRecommendedSkills(context?: any): Promise<any[]> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get recommendations: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Rate a skill. */
  async rateSkill(skillId: string, rating: number, feedback?: string): Promise<void> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/${encodeURIComponent(skillId)}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, feedback }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to rate skill: ${response.status} ${await response.text()}`);
    }
  }

  /** Get skill usage statistics. */
  async getSkillStats(skillId: string): Promise<any> {
    const response = await fetch(`${this.skillDiscoveryUrl}/api/skills/${encodeURIComponent(skillId)}/stats`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get skill stats: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Health check for skill discovery service. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.skillDiscoveryUrl}/api/health`, {
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

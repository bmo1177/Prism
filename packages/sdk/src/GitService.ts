/**
 * Git service for repository operations and version control integration.
 */
export class GitService {
  constructor(private gitUrl: string) {}

  /** Clone a remote repository. */
  async cloneRepository(url: string, options?: any): Promise<{ repoPath: string; cloneId: string }> {
    const response = await fetch(`${this.gitUrl}/api/repos/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, ...options }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clone repository: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Create a git repository locally. */
  async initRepository(path: string, options?: any): Promise<{ repoPath: string }> {
    const response = await fetch(`${this.gitUrl}/api/repos/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, ...options }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to init repository: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get repository status. */
  async getRepositoryStatus(path: string): Promise<any> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get repository status: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get git log. */
  async getGitLog(path: string, options?: any): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.since) params.set("since", options.since);
    if (options?.author) params.set("author", options.author);
    
    const query = params.toString();
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/log?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get git log: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get branches. */
  async getBranches(path: string): Promise<any[]> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/branches`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get branches: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Create a branch. */
  async createBranch(path: string, branch: string, source?: string): Promise<any> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch, source }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create branch: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Checkout a branch. */
  async checkoutBranch(path: string, branch: string): Promise<any> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to checkout branch: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get tag list. */
  async getTags(path: string): Promise<any[]> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get tags: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Create a tag. */
  async createTag(path: string, tag: string, commit: string): Promise<any> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, commit }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create tag: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get remote repositories. */
  async getRemotes(path: string): Promise<any[]> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/remotes`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get remotes: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Add remote repository. */
  async addRemote(path: string, name: string, url: string): Promise<any> {
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/remotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add remote: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Get list of files in repository. */
  async listFiles(path: string, options?: any): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.pattern) params.set("pattern", options.pattern);
    if (options?.recursive) params.set("recursive", options.recursive.toString());
    
    const query = params.toString();
    const response = await fetch(`${this.gitUrl}/api/repos/${encodeURIComponent(path)}/files?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.status} ${await response.text()}`);
    }
    
    return response.json();
  }

  /** Health check for git service. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.gitUrl}/api/health`, {
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

import { describe, expect, it, vi } from "vitest";
import { NexusClient, createNexusClient } from "../NexusClient";
import { OpenCodeClient } from "../OpenCodeClient";

describe("NexusClient", () => {
  it("builds its own OpenCode client from a URL (hosted-platform shape)", () => {
    const nexus = new NexusClient({ openCodeUrl: "http://127.0.0.1:4096" });
    expect(nexus.getOpenCodeClient()).toBeInstanceOf(OpenCodeClient);
  });

  it("prefers an injected OpenCode client over the URL", () => {
    const injected = new OpenCodeClient({
      fetchImpl: (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch,
    });
    const nexus = new NexusClient({ openCode: injected, openCodeUrl: "http://127.0.0.1:4096" });
    expect(nexus.getOpenCodeClient()).toBe(injected);
  });

  it("delegates skill discovery to the live OpenCode registry", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ name: "review" }],
      text: async () => "[]",
    }));
    const nexus = new NexusClient({
      openCode: new OpenCodeClient({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    });
    await expect(nexus.discoverSkills()).resolves.toEqual([{ name: "review" }]);
  });

  it("returns empty skill/run lists when no service is configured", async () => {
    const nexus = new NexusClient({});
    await expect(nexus.discoverSkills()).resolves.toEqual([]);
    await expect(nexus.listRuns()).resolves.toEqual([]);
    await expect(nexus.listSessions()).resolves.toEqual([]);
    expect(nexus.getStatus()).toBe("offline");
  });

  it("healthCheck reports per-service results without throwing", async () => {
    const nexus = new NexusClient({});
    const health = await nexus.healthCheck();
    for (const key of [
      "openCode",
      "run",
      "provenance",
      "environment",
      "git",
      "skillDiscovery",
      "configuration",
      "monitoring",
    ]) {
      expect(health).toHaveProperty(key);
    }
  });

  it("createNexusClient factory defaults to an empty config", () => {
    expect(createNexusClient()).toBeInstanceOf(NexusClient);
    expect(createNexusClient().getOpenCodeClient()).toBeUndefined();
  });
});

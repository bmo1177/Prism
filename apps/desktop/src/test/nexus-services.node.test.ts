// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenCodeClient, ProvenanceService, RunService, createNexusClient } from "@ai4s/sdk";
import { startMockOpenCode, type MockOpenCode } from "@ai4s/sdk/mock-server";

let server: MockOpenCode;

beforeEach(async () => {
  server = await startMockOpenCode(0);
});
afterEach(async () => {
  await server.close();
});

describe("OpenCodeClient whoami", () => {
  it("returns the gateway identity", async () => {
    const client = new OpenCodeClient({ baseUrl: `http://127.0.0.1:${server.port}` });
    await expect(client.whoami()).resolves.toEqual({
      mode: "full",
      directory: "/mock/workspace",
    });
  });

  it("returns null when the gateway is unreachable", async () => {
    const client = new OpenCodeClient({ baseUrl: "http://127.0.0.1:1" });
    await expect(client.whoami()).resolves.toBeNull();
  });
});

describe("RunService against the /v1/runs contract", () => {
  it("lists all recorded runs, newest first", async () => {
    const svc = new RunService(`http://127.0.0.1:${server.port}`);
    const runs = await svc.listRuns();
    expect(runs).toHaveLength(3);
    expect(runs[0]).toMatchObject({ runId: "run_mock1", status: "ok", command: "python train.py --lr 3e-4" });
    expect(runs[2]).toMatchObject({ runId: "run_mock3", surface: "hpc" });
  });

  it("queries the runs index with filters, facets, and paging", async () => {
    const svc = new RunService(`http://127.0.0.1:${server.port}`);
    const page = await svc.queryRuns({ status: "failed" });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].runId).toBe("run_mock2");
    expect(page.total).toBe(1);
    expect(page.next).toBeUndefined();
    expect(page.facets.status).toContainEqual({ value: "failed", count: 1 });

    const all = await svc.queryRuns({});
    expect(all.rows).toHaveLength(3);
    expect(all.facets.surface).toContainEqual({ value: "hpc", count: 1 });
  });

  it("reads a run log by hash and throws on an unknown hash", async () => {
    const svc = new RunService(`http://127.0.0.1:${server.port}`);
    await expect(svc.readRunLog("hash1")).resolves.toContain("Training loss: 0.31");
    await expect(svc.readRunLog("nope")).rejects.toThrow(/404/);
  });

  it("sends the gateway bearer token when a password is configured", async () => {
    const seen: (string | undefined)[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((input, init) => {
      seen.push((init?.headers as Record<string, string> | undefined)?.["Authorization"]);
      return original(input, init);
    }) as typeof fetch;
    try {
      const runs = new RunService(`http://127.0.0.1:${server.port}`, "tok-secret");
      await runs.listRuns();
      const provenance = new ProvenanceService(`http://127.0.0.1:${server.port}`, "tok-secret");
      await provenance.listProvenance("data/notes.md");
      expect(seen).toEqual(["Bearer tok-secret", "Bearer tok-secret"]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("ProvenanceService against the /v1/provenance contract", () => {
  it("queries provenance records with paging", async () => {
    const svc = new ProvenanceService(`http://127.0.0.1:${server.port}`);
    const page = await svc.queryProvenance({});
    expect(page.total).toBe(2);
    expect(page.rows.map((r) => r.version)).toEqual([1, 2]);

    const limited = await svc.queryProvenance({ limit: 1 });
    expect(limited.rows).toHaveLength(1);
    expect(limited.total).toBe(2); // the limit pages the rows, it does not change the count
  });

  it("lists an artifact's versions by path, oldest first", async () => {
    const svc = new ProvenanceService(`http://127.0.0.1:${server.port}`);
    const records = await svc.listProvenance("data/notes.md");
    expect(records.map((r) => r.version)).toEqual([1, 2]);
    expect(records[0]).toMatchObject({ path: "data/notes.md", tool: "write" });
    await expect(svc.listProvenance("data/other.md")).resolves.toEqual([]);
  });
});

describe("gateway health checks", () => {
  it("reports healthy when the gateway answers", async () => {
    const url = `http://127.0.0.1:${server.port}`;
    await expect(new RunService(url).healthCheck()).resolves.toBe(true);
    await expect(new ProvenanceService(url).healthCheck()).resolves.toBe(true);
  });

  it("reports unhealthy when the gateway is unreachable", async () => {
    await expect(new RunService("http://127.0.0.1:1").healthCheck()).resolves.toBe(false);
    await expect(new ProvenanceService("http://127.0.0.1:1").healthCheck()).resolves.toBe(false);
  });
});

describe("NexusClient URL-only construction", () => {
  it("builds its own OpenCode client from openCodeUrl and serves discovery from it", async () => {
    const nexus = createNexusClient({
      openCodeUrl: `http://127.0.0.1:${server.port}`,
      password: "tok",
    });
    const skills = await nexus.discoverSkills();
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.map((s) => s.name)).toContain("home-skill");
  });
});

import { describe, expect, it, vi } from "vitest";
import { OpenCodeClient } from "../OpenCodeClient";
import { DEFAULT_OPENCODE_URL } from "../types";

function mockFetch(handler: (url: unknown, init?: unknown) => unknown) {
  return vi.fn(async (url: unknown, init?: unknown) => handler(url, init));
}

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("OpenCodeClient construction", () => {
  it("defaults to the pinned OpenCode URL", async () => {
    const fetchImpl = mockFetch(() => okJson({}));
    const client = new OpenCodeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(client.getStatus()).toBe("offline");
    await client.healthCheck();
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(`${DEFAULT_OPENCODE_URL}/health`);
  });

  it("trims a trailing slash from baseUrl", async () => {
    const fetchImpl = mockFetch(() => okJson({}));
    const client = new OpenCodeClient({
      baseUrl: "http://127.0.0.1:4096/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.healthCheck();
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:4096/health");
  });

  it("sends basic-auth headers when a password is configured", async () => {
    let seen: Record<string, string> = {};
    const fetchImpl = mockFetch((_url: unknown, init?: unknown) => {
      seen = (init as { headers?: Record<string, string> })?.headers ?? {};
      return okJson({ directory: "/tmp/ws", mode: "manual" });
    });
    const client = new OpenCodeClient({
      password: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.whoami();
    expect(seen["Authorization"] ?? "").toMatch(/^Basic /);
  });

  it("sends no Authorization header without a password", async () => {
    let seen: Record<string, string> = {};
    const fetchImpl = mockFetch((_url: unknown, init?: unknown) => {
      seen = (init as { headers?: Record<string, string> })?.headers ?? {};
      return okJson({ directory: null });
    });
    const client = new OpenCodeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.whoami();
    expect(seen["Authorization"]).toBeUndefined();
  });
});

describe("OpenCodeClient requests", () => {
  it("healthCheck is true on ok, false on network failure", async () => {
    const good = new OpenCodeClient({
      fetchImpl: mockFetch(() => okJson({})) as unknown as typeof fetch,
    });
    await expect(good.healthCheck()).resolves.toBe(true);

    const bad = new OpenCodeClient({
      fetchImpl: mockFetch(() => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    });
    await expect(bad.healthCheck()).resolves.toBe(false);
  });

  it("whoami returns null on non-ok or unreachable", async () => {
    const nonOk = new OpenCodeClient({
      fetchImpl: mockFetch(() => ({ ok: false, status: 401 })) as unknown as typeof fetch,
    });
    await expect(nonOk.whoami()).resolves.toBeNull();

    const down = new OpenCodeClient({
      fetchImpl: mockFetch(() => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    });
    await expect(down.whoami()).resolves.toBeNull();
  });

  it("listSkills sorts by name and unwraps the {data} envelope", async () => {
    const fetchImpl = mockFetch(() => okJson({ data: [{ name: "zeta" }, { name: "alpha" }] }));
    const client = new OpenCodeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const skills = await client.listSkills();
    expect(skills.map((s) => s.name)).toEqual(["alpha", "zeta"]);
  });

  it("listCommands passes through array bodies", async () => {
    const fetchImpl = mockFetch(() => okJson([{ name: "plan" }, { name: "review" }]));
    const client = new OpenCodeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const commands = await client.listCommands();
    expect(commands).toHaveLength(2);
  });

  it("setDirectory scopes skill discovery to the workspace", async () => {
    const fetchImpl = mockFetch(() => okJson([]));
    const client = new OpenCodeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    client.setDirectory("/tmp/my workspace");
    await client.listSkills();
    const [url] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/skill?directory=");
    expect(String(url)).toContain(encodeURIComponent("/tmp/my workspace"));
  });
});

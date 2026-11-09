#!/usr/bin/env node
/**
 * agy bridge — a tiny local OpenAI-compatible server that fronts the `agy`
 * (Google Antigravity) CLI, so its models can be used from Prism (and any
 * OpenAI-compatible client) as a custom provider.
 *
 *   node bridge.mjs [--port 45678] [--agy /path/to/agy]
 *
 * Endpoints:
 *   GET  /health               → { ok: true }
 *   GET  /v1/models            → { data: [{ id, object: "model", owned_by: "agy" }] }
 *   POST /v1/chat/completions  → OpenAI chat response (streaming via SSE when
 *                                the request asks for it)
 *
 * Each request runs one `agy --print` turn (its own agent loop) and returns
 * the final text. That makes this a chat-only bridge: agy's internal tool
 * use is its own, so OpenCode tool-calls over this provider are limited to
 * what agy answers in text. Zero dependencies — Node stdlib only.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argOf("--port", process.env.AGY_BRIDGE_PORT ?? "45678"));
const AGY = argOf("--agy", process.env.AGY_BIN ?? "agy");
const TIMEOUT_MS = 300_000;

function runAgy(argv, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(AGY, argv, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("agy timed out"));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || stdout.trim() || `agy exited with code ${code}`));
    });
  });
}

async function listModels() {
  const out = await runAgy(["models"], 30_000);
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Fetching"))
    .map((l) => {
      const [id = "", ...rest] = l.split(/\t|\s{2,}/);
      return { id: id.trim(), name: rest.join(" ").trim() || id.trim() };
    })
    .filter((m) => m.id);
}

/** Flatten OpenAI messages into one prompt agy can run. */
function buildPrompt(messages) {
  return messages
    .map((m) => {
      const role = typeof m.role === "string" ? m.role.toUpperCase() : "USER";
      const text = Array.isArray(m.content)
        ? m.content.map((c) => (typeof c === "string" ? c : c.text ?? "")).join(" ")
        : (m.content ?? "");
      return `${role}:\n${text}`;
    })
    .join("\n\n");
}

function completionBody(model, text) {
  return {
    id: `chatcmpl-agy-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function sendSse(res, model, text) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const id = `chatcmpl-agy-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (!w) continue;
    res.write(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: { role: "assistant", content: w }, finish_reason: null }],
      })}\n\n`,
    );
  }
  res.write(
    `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    })}\n\n`,
  );
  res.write("data: [DONE]\n\n");
  res.end();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (d) => (buf += d));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/models") {
      const models = await listModels();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          object: "list",
          data: models.map((m) => ({ id: m.id, object: "model", owned_by: "agy" })),
        }),
      );
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      const body = await readJson(req);
      const model = body.model ?? "";
      const prompt = buildPrompt(body.messages ?? []);
      if (!prompt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "no prompt given", type: "invalid_request" } }));
        return;
      }
      const text = await runAgy([
        ...(model ? ["--model", model] : []),
        "--output-format",
        "text",
        `--print=${prompt}`,
      ]);
      if (body.stream) {
        sendSse(res, model || "agy", text);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(completionBody(model || "agy", text)));
      }
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "not found", type: "not_found" } }));
  } catch (e) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: String(e?.message ?? e), type: "agy_error" } }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`agy bridge listening on http://127.0.0.1:${PORT}/v1 (agy: ${AGY})`);
});

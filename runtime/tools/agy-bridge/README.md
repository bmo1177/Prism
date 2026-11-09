# agy bridge

Exposes the [`agy`](https://github.com/google/antigravity-cli) CLI's models
to Prism (and any OpenAI-compatible client) over a local HTTP endpoint.

## Why

`agy` is a full agent — its models run inside agy's own loop, not a plain
inference API — so it cannot be registered as a Prism provider directly.
This bridge translates OpenAI `chat/completions` calls into
`agy --print` turns (one turn per request) and returns the final text.

Prism's Settings → Models → agy card starts this bridge automatically and
registers it in OpenCode as provider `agy`. Or run it by hand:

```bash
node bridge.mjs --port 45678            # --agy <path> overrides the binary
```

Then add a custom provider anywhere with
`@ai-sdk/openai-compatible` and baseURL `http://127.0.0.1:45678/v1`.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/v1/models` | Model list from `agy models` |
| POST | `/v1/chat/completions` | Chat (SSE when `"stream": true`) |

## Limits

- One `agy --print` turn per request; the response is plain final text, so
  OpenCode sees a chat-only model (no OpenCode tool-calls over this
  provider). agy's internal tool use still works inside each turn.
- No auth: it binds loopback-only.

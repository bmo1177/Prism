# `prism agent` — Headless CLI & Agent API

`prism agent` is the script-friendly command-line interface for driving a running
Prism desktop application. It speaks directly to Prism's Remote Access Gateway,
enabling external tools, autonomous agents, and CI scripts to inspect state,
send prompts, query provenance, and manage scheduled tasks.

---

## Prerequisites

1. **Prism must be running.** The CLI communicates with the active application instance.
2. **Remote Access must be enabled.** In Prism, navigate to **Settings → Remote Access**
   and toggle Remote Access on.

By default, Prism binds the gateway to `127.0.0.1:4098` (or an ephemeral loopback port
if 4098 is occupied) and generates a secure random token stored locally at:
- **Linux**: `~/.local/share/com.prism.desktop/runtime/gateway.txt`
- **macOS**: `~/Library/Application Support/com.prism.desktop/runtime/gateway.txt`
- **Windows**: `%APPDATA%\com.prism.desktop\runtime\gateway.txt`

The CLI automatically reads the token and port from this file (the gateway
persists the bound port — including ephemeral ones — so restarts are seamless).
You can also explicitly override them using `--url` and `--token`.

---

## Command Syntax

```bash
prism agent <command> [options]
```

On Windows, the executable is `Prism.exe`:
```cmd
Prism.exe agent <command> [options]
```

---

## Output Contract & Exit Codes

- **JSON on stdout by default**: suitable for pipes (`jq`, Python, agent tools).
- **Readable tables with `--human`**: human-friendly summaries for terminal use.
- **Errors on stdout**: structured JSON envelope even on failure:
  ```json
  {
    "error": {
      "code": "app_not_running",
      "message": "Prism gateway is not running",
      "hint": "start Prism so the gateway is up, then retry"
    }
  }
  ```
  `hint` is always present and tells the caller the one action that resolves it.
- **Exit codes** (stable, machine-readable):
  - `0`: success.
  - `1`: user error — bad args (`user_error`), `gateway_disabled`, `no_token`,
    `unknown_command`, `unknown_flag`; also HTTP 4xx that isn't not-found
    (e.g. `forbidden` when the gateway is in read-only mode).
  - `2`: transport — `app_not_running` (gateway down or unreachable), or other
    network errors during the call.
  - `3`: not-found — the session or task id does not exist.

Handle it like this:

```bash
if ! out=$(prism agent status); then
  echo "$out" >&2
  exit 1
fi
```

---

## Commands

### 1. `status`
Check gateway connectivity, access mode, and the active workspace directory.

```bash
prism agent status
prism agent status --human
```

Output:
```json
{
  "ok": true,
  "url": "http://127.0.0.1:4098",
  "mode": "full",
  "directory": "/home/user/my-project"
}
```

### 2. `sessions list`
List active sessions.

```bash
prism agent sessions list
prism agent sessions list --human
```

Output: a JSON array of session objects (`id`, `title`, `directory`, `time_created`).

### 3. `sessions show <id>`
Inspect the messages within a session.

```bash
prism agent sessions show ses_abc123
```

### 4. `prompt <session> "<text>"`
Send a prompt to an existing session. Returns once the agent has accepted it —
poll with `sessions show` for a finished turn.

```bash
prism agent prompt ses_abc123 "Run data cleaning and generate a summary plot"
```

### 5. `provenance list [--session <id>]`
List artifact file mutations and versions recorded by the provenance tracker,
newest first.

```bash
prism agent provenance list
prism agent provenance list --session ses_abc123 --human
```

### 6. `jobs list`
List scheduled tasks.

```bash
prism agent jobs list
prism agent jobs list --human
```

### 7. `jobs create`
Create a new scheduled task.

Flags:
- `--title <title>`: short task title.
- `--prompt <prompt>`: the instruction prompt executed when triggered.
- `--kind <kind>`: schedule kind (`daily`, `weekday`, `every`, `cron`, `at`, `event`).
- `--value <value>`: kind-specific value (e.g. `"08:00"` for daily, `3600` for
  every, `"0 8 * * *"` for cron).

```bash
prism agent jobs create \
  --title "Daily Digest" \
  --prompt "Summarize workspace changes" \
  --kind daily \
  --value "08:00"
```

### 8. `jobs run <id>`
Trigger an immediate run of a scheduled task.

```bash
prism agent jobs run job_xyz789
```

---

## Global Options

| Option | Description |
| --- | --- |
| `--human` | Output formatted human-readable text instead of JSON. |
| `--url <url>` | Override gateway URL (e.g. `http://127.0.0.1:4098`). |
| `--token <token>` | Override gateway bearer token. |
| `--help`, `-h` | Display help text and exit with code 0. |

---

## Security notes

- The gateway is **loopback by default**. Keep it there unless you need LAN
  access (Settings → Remote Access → LAN). When on LAN, treat `--token` as a
  password and keep it out of shared terminals.
- Put the app in **read-only mode** when scripting an agent that only needs to
  read. Mutations (`prompt`, `jobs create`, `jobs run`) then fail with
  `code: "forbidden"` (exit 1).
- Never commit the token. It is read from
  `<data_dir>/com.prism.desktop/runtime/gateway.txt` (owner-only permissions).
  Pass it from a secret store with `--token` when the CLI runs without the app.

---

## Scripting Examples

### Bash / jq
```bash
# Check if Prism is running
if ! status=$(prism agent status 2>/dev/null); then
  echo "Prism is offline"
  exit 1
fi
workspace=$(echo "$status" | jq -r '.directory')
echo "Active workspace: $workspace"

# List sessions
prism agent sessions list | jq -r '.[].id'
```

### Python
```python
import subprocess, json

res = subprocess.run(["prism", "agent", "status"], capture_output=True, text=True)
data = json.loads(res.stdout)
if "error" in data:
    print(f"Error [{data['error']['code']}]: {data['error']['message']}")
else:
    print(f"Connected to {data['url']} in workspace {data['directory']}")
```

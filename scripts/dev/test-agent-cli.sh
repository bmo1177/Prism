#!/usr/bin/env bash
# Headless smoke test for `prism agent` CLI.
# Boots nothing, verifies exit codes and structured JSON output contracts.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="${CRAFT_BIN:-"$REPO_ROOT/apps/desktop/src-tauri/target/debug/craft"}"

if [[ ! -x "$BIN" ]]; then
  echo "Binary not found at $BIN; building..."
  nix-shell "$REPO_ROOT/shell.nix" --run "cd '$REPO_ROOT/apps/desktop/src-tauri' && cargo build --bin craft"
fi

echo "Testing $BIN agent..."

# 1. Bare invocation prints help and exits 0
echo "  [1/6] bare 'prism agent' prints help (exit 0)"
set +e
OUT=$("$BIN" agent 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 0 ]]; then
  echo "FAILED: expected exit 0, got $EXIT_CODE"
  exit 1
fi
if [[ "$OUT" != *"prism agent — drive a running Prism app"* ]]; then
  echo "FAILED: help text not found in output"
  exit 1
fi

# 2. --help flag exits 0
echo "  [2/6] 'prism agent --help' exits 0"
set +e
OUT=$("$BIN" agent --help 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 0 ]]; then
  echo "FAILED: expected exit 0, got $EXIT_CODE"
  exit 1
fi

# 3. Unknown flag exits 1 with user_error envelope
echo "  [3/6] unknown flag yields user_error (exit 1)"
set +e
OUT=$("$BIN" agent status --invalid-flag-xyz 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 1 ]]; then
  echo "FAILED: expected exit 1, got $EXIT_CODE"
  exit 1
fi
if [[ "$OUT" != *'"code":"user_error"'* ]]; then
  echo "FAILED: expected 'user_error' in output, got: $OUT"
  exit 1
fi

# 4. --url without --token exits 1
echo "  [4/6] --url without --token yields user_error (exit 1)"
set +e
OUT=$("$BIN" agent status --url http://127.0.0.1:54321 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 1 ]]; then
  echo "FAILED: expected exit 1, got $EXIT_CODE"
  exit 1
fi
if [[ "$OUT" != *'"code":"user_error"'* ]]; then
  echo "FAILED: expected 'user_error' in output, got: $OUT"
  exit 1
fi

# 5. Connection refused yields app_not_running (exit 2)
echo "  [5/6] unreachable gateway yields app_not_running (exit 2)"
set +e
OUT=$("$BIN" agent status --url http://127.0.0.1:59999 --token test-token 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 2 ]]; then
  echo "FAILED: expected exit 2, got $EXIT_CODE"
  exit 1
fi
if [[ "$OUT" != *'"code":"app_not_running"'* ]]; then
  echo "FAILED: expected 'app_not_running' in output, got: $OUT"
  exit 1
fi

# 6. jobs create missing required flags yields user_error (exit 1)
echo "  [6/6] jobs create missing flags yields user_error (exit 1)"
set +e
OUT=$("$BIN" agent jobs create --title "Only Title" --url http://127.0.0.1:59999 --token test 2>&1)
EXIT_CODE=$?
set -e
if [[ $EXIT_CODE -ne 1 ]]; then
  echo "FAILED: expected exit 1, got $EXIT_CODE"
  exit 1
fi
if [[ "$OUT" != *'"code":"user_error"'* ]]; then
  echo "FAILED: expected 'user_error' in output, got: $OUT"
  exit 1
fi

echo "All 6 CLI smoke tests passed successfully!"

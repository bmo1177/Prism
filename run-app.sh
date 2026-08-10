#!/usr/bin/env bash
# Launch Prism with hot-reload CSS (Vite dev server + Tauri binary)
set -e

cd "$(dirname "$0")/apps/desktop"

# Build frontend (embeds fresh CSS into dist/)
echo "⚡ Building frontend..."
npx vite build > /dev/null 2>&1

# Start Vite dev server
echo "🌊 Starting Vite dev server..."
npx vite --port 5173 --strictPort > /tmp/prism-vite.log 2>&1 &
VITE_PID=$!

# Wait for Vite
sleep 3

# Launch the Tauri binary in dev mode
echo "🚀 Launching Prism..."
cd src-tauri
export TAURI_DEV=1
exec nix-shell ../../shell.nix --run "./target/debug/craft"

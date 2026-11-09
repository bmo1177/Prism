#!/usr/bin/env bash
# Build a Linux AppImage from the Tauri .deb bundle — WITHOUT linuxdeploy.
#
# Why not Tauri's built-in AppImage target? Tauri's AppImage bundler drives
# linuxdeploy, which runs `ldd` on every bundled ELF. The Bun-built OpenCode
# sidecar is effectively a static binary, and `ldd` exits 1 on it — aborting
# the whole bundle (tauri-apps/tauri#8929). appimagetool does not run ldd on
# the payload the same way, so extracting the .deb into an AppDir and feeding
# it to appimagetool produces a working AppImage.
#
# Usage:
#   bash scripts/release/build-appimage.sh <deb-path> <output-appimage>
#
# The .deb is expected at:
#   apps/desktop/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/*.deb
# The script:
#   1. extracts the deb into a temp dir
#   2. wraps the extracted binary + desktop file + icon into an AppDir
#   3. downloads appimagetool (x86_64) once and bundles the AppImage
set -euo pipefail

DEB="${1:?usage: build-appimage.sh <deb-path> <output-appimage>}"
OUT="${2:?usage: build-appimage.sh <deb-path> <output-appimage>}"

APPIMAGETOOL_URL="https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
ICON_SRC="$(cd "$(dirname "$0")/../.." && pwd)/apps/desktop/src-tauri/icons/icon.png"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Extracting $DEB"
dpkg-deb -x "$DEB" "$TMP/deb"

APPDIR="$TMP/Prism.AppDir"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/applications" "$APPDIR/usr/share/icons/hicolor/512x512/apps"

# The deb ships the binary at usr/bin/prism (productName "Prism", tauri.conf).
BIN="$(find "$TMP/deb" -type f -name prism -o -name Prism | head -1)"
if [ -z "$BIN" ]; then
  echo "::error::No prism binary found in deb" >&2
  exit 1
fi
cp "$BIN" "$APPDIR/prism"
cp "$BIN" "$APPDIR/usr/bin/prism"
chmod +x "$APPDIR/prism" "$APPDIR/usr/bin/prism"

# Desktop entry + icon
cat > "$APPDIR/prism.desktop" <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Prism
Comment=Light bent into work — local-first AI workspace
Exec=prism
Icon=prism
Categories=Development;
Terminal=false
DESKTOP
cp "$APPDIR/prism.desktop" "$APPDIR/usr/share/applications/prism.desktop"
cp "$ICON_SRC" "$APPDIR/prism.png" 2>/dev/null || true
cp "$ICON_SRC" "$APPDIR/usr/share/icons/hicolor/512x512/apps/prism.png" 2>/dev/null || true

echo "Bundling AppImage with appimagetool"
TOOL="$TMP/appimagetool"
curl -fsSL -o "$TOOL" "$APPIMAGETOOL_URL"
chmod +x "$TOOL"

mkdir -p "$(dirname "$OUT")"
# --appimage-extract-and-run is required in containers/CI without FUSE.
ARCH=x86_64 "$TOOL" --appimage-extract-and-run "$APPDIR" "$OUT"

echo "Built $OUT"

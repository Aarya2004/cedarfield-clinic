#!/bin/sh
# Copy packages/bridge into the Docker build context (Docker cannot COPY from a parent directory).
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/../../packages/bridge"
DST="$HERE/container/bridge"
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/bin" "$SRC/src" "$SRC/shims" "$SRC/package.json" "$DST/"
# Rokan wheels (built from a scratch copy of ~/dev/Rokan by `uv build --wheel`; source stays in Rokan)
mkdir -p "$HERE/container/vendor" && cp "$HERE/../../vendor/"*.whl "$HERE/container/vendor/" 2>/dev/null || true
# lockfile-free install inside the image; keep the dependency pins from package.json
echo "synced $(ls "$DST" | tr '\n' ' ')"

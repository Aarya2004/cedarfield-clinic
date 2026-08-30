#!/bin/sh
# Rebuild the three Rokan wheels from ~/dev/Rokan and vendor them into BOTH wheel dirs:
#   vendor/                       (repo-level, what sync-bridge.sh copies from)
#   infra/sandbox/container/vendor (the Docker build context, COPY'd by Dockerfile.rokan)
# Old rokan_*-*.whl are removed first so exactly one wheel per package remains — a stale
# second wheel would make `uv pip install rokan_do-*.whl` ambiguous. Source stays in Rokan.
#
# Usage: sh infra/sandbox/scripts/build-wheels.sh [ROKAN_DIR]
set -eu

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="$(cd "$HERE/../.." && pwd)"
ROKAN="${1:-${ROKAN_DIR:-$HOME/dev/Rokan}}"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/rokan-wheels.XXXXXX")"
trap 'rm -rf "$OUT"' EXIT INT TERM

[ -d "$ROKAN/packages/rokan-mcp" ] || { echo "build-wheels: no Rokan checkout at $ROKAN" >&2; exit 1; }
command -v uv >/dev/null 2>&1 || { echo "build-wheels: uv is not on PATH" >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "build-wheels: unzip is not on PATH" >&2; exit 1; }

# Build order matters only for the log; each wheel is built in isolation by hatchling.
for pkg in rokan-mcp rokan-agent rokan-do; do
  echo "== uv build --wheel $pkg"
  uv build --wheel --out-dir "$OUT" "$ROKAN/packages/$pkg" >/dev/null
done

# Exactly one wheel per package must have been produced.
for name in rokan_mcp rokan_agent rokan_do; do
  n=$(ls "$OUT"/${name}-*.whl 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" = "1" ] || { echo "build-wheels: expected 1 ${name} wheel, found $n" >&2; exit 1; }
done

# Content assertions BEFORE anything is replaced, so a bad build leaves the old wheels in place.
DO_WHL=$(ls "$OUT"/rokan_do-*.whl)
MCP_WHL=$(ls "$OUT"/rokan_mcp-*.whl)
unzip -l "$DO_WHL" | grep -q 'rokan_do/native.py$' \
  || { echo "build-wheels: $DO_WHL lacks rokan_do/native.py (wrong branch?)" >&2; exit 1; }
unzip -p "$MCP_WHL" 'rokan_mcp/_daemon.py' | grep -q 'WebMCP' \
  || { echo "build-wheels: $MCP_WHL _daemon.py has no WebMCP (wrong branch?)" >&2; exit 1; }

for dir in "$ENTRY/vendor" "$HERE/container/vendor"; do
  mkdir -p "$dir"
  rm -f "$dir"/rokan_*-*.whl
  cp "$OUT"/rokan_*.whl "$dir/"
done

echo "== vendored wheels (sha256)"
for whl in "$HERE"/container/vendor/rokan_*.whl; do
  shasum -a 256 "$whl" | awk -v n="$(basename "$whl")" '{print $1 "  " n}'
done
# Both dirs must hold byte-identical sets.
for whl in "$HERE"/container/vendor/rokan_*.whl; do
  cmp -s "$whl" "$ENTRY/vendor/$(basename "$whl")" \
    || { echo "build-wheels: vendor/ and container/vendor differ on $(basename "$whl")" >&2; exit 1; }
done
echo "== ok: $(ls "$HERE"/container/vendor/rokan_*.whl | wc -l | tr -d ' ') wheels in vendor/ and container/vendor"

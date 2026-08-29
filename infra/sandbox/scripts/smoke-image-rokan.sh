#!/bin/sh
# Smoke the rokan image (rokan-sandbox:rokan, built from Dockerfile.rokan) under judge-like limits:
# 1/4 vCPU, 1 GiB. Proves: the bridge pairs; rokan-do is installed with seeds; a seeded replay runs
# with 0 model calls and prints its ⚡ line (timed); the `rokan` shim is on PATH; the demo project's
# failing test is there for the recovery beat. Everything it starts is stopped at the end.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
IMG="${IMG:-rokan-sandbox:rokan}"
TOKEN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
docker rm -f rokan-sandbox-smoke-rokan >/dev/null 2>&1 || true
# LIMITS="--cpus 0.25 --memory 1g" reproduces the judge instance; under amd64 emulation on an arm64 Mac that
# starves node-pty startup (bridge > 30 s), so the default is unlimited and the 1/4-vCPU timing is measured on Cloudflare.
LIMITS="${LIMITS:-}"
docker run -d --name rokan-sandbox-smoke-rokan --platform linux/amd64 $LIMITS -p 7331:7331 "$IMG" \
  node /opt/bridge/bin/rokan-terminal.js --no-tunnel --mode judge --host 0.0.0.0 --port 7331 --token "$TOKEN" --ttl-ms 20000 --app http://localhost:3311 >/dev/null
cleanup() { docker rm -f rokan-sandbox-smoke-rokan >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
node "$HERE/scripts/pair-probe.mjs" "ws://127.0.0.1:7331" "$TOKEN"
X() { docker exec -u judge -w /home/judge rokan-sandbox-smoke-rokan sh -lc "$1"; }
echo "--- rokan-do in the image ---"
X 'which rokan-do && rokan-do ops | tail -1'
echo "--- rokan shim on the PTY PATH (via the bridge env) ---"
X 'PATH=/opt/bridge/shims:$PATH which rokan && PATH=/opt/bridge/shims:$PATH rokan do 2>&1 | head -2 || true'
echo "--- seeded replay (timed; local = emulated amd64, not the judge CPU) ---"
X 'start=$(date +%s%N); rokan-do run "what is the current status at githubstatus.com" 2>&1 | tail -3; end=$(date +%s%N); echo "wall $(( (end-start)/1000000 )) ms"'
echo "--- recovery-beat project ---"
X 'cd demo && python3 -m pytest -q 2>&1 | tail -2'
echo "--- no key in the container ---"
X 'test -z "${ANTHROPIC_API_KEY:-}" && echo "no ANTHROPIC_API_KEY (by design)"'

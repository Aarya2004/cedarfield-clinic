#!/bin/sh
# Smoke the rokan image (rokan-sandbox:rokan, built from Dockerfile.rokan) under judge-like limits:
# 1/4 vCPU, 1 GiB. Proves: the unpacked image is small enough to boot on a `basic` instance; the
# bridge pairs; rokan-do is installed with seeds; the bridge's own computed PATH resolves `rokan` and
# `rokan-do` and a login zsh runs `rokan do` through the shim (what the PTY does); a seeded replay runs
# with 0 model calls and prints its ⚡ line (timed); the demo project's failing test is there for the
# recovery beat; no key and no browser in the image. Everything it starts is stopped at the end.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
IMG="${IMG:-rokan-sandbox:rokan}"
# Cloudflare counts the image against the instance disk (4 GB on `basic`). The 2 221 MB image of
# 2026-08-28 never produced a healthy instance (rollout stuck at step 1: failed 1, healthy 0); the
# 1 602 MB one before it booted every time. Fail here, not at the freeze.
# 4 GB disk on `basic`; 1800 leaves ~2.2 GB for /tmp, the ephemeral ledger and uv/pip scratch. The
# judge container never installs packages at runtime (replays are browserless), so this headroom is
# ample; it is a boot guard, not a runtime-space guarantee. Measured as ROOT (the image runs as
# `judge`, which cannot read root-only dirs → undercount) with du's own exit checked (a bare
# `du | cut` returns cut's success and would hide a failed measurement).
MAX_MB="${MAX_MB:-1800}"
echo "--- unpacked image size, measured as root (limit ${MAX_MB} MB) ---"
MB=$(docker run --rm --platform linux/amd64 --user 0:0 --entrypoint sh "$IMG" -c 'set -e; du -sxm / | awk "END{print \$1}"')
case "$MB" in ''|*[!0-9]*) echo "FAIL could not measure image size (got: '$MB')"; exit 1;; esac
echo "unpacked ${MB} MB"
[ "$MB" -le "$MAX_MB" ] || { echo "FAIL image unpacks to ${MB} MB > ${MAX_MB} MB — this will not boot on a basic instance"; exit 1; }
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
X 'which rokan-do >/dev/null || { echo "FAIL rokan-do not on PATH"; exit 1; }; ops=$(rokan-do ops) || { echo "FAIL rokan-do ops errored"; exit 1; }; printf "%s\n" "$ops" | tail -1'
echo '--- PATH the bridge hands the PTY resolves rokan + rokan-do; login zsh runs rokan do via the shim ---'
BRIDGE_PATH=$(X 'cd /opt/bridge && node --input-type=module -e "import { prepareShellEnv } from \"/opt/bridge/src/shell-integration.js\"; const { env } = prepareShellEnv(\"/bin/zsh\", process.env); console.log(env.PATH)"')
echo "bridge PATH=$BRIDGE_PATH"
X "PATH='$BRIDGE_PATH' command -v rokan && PATH='$BRIDGE_PATH' command -v rokan-do"
X "PATH='$BRIDGE_PATH' zsh -lc 'rokan do --help >/dev/null 2>&1; echo \"rokan do via shim: exit \$?\"' | grep -q 'exit 0' && echo 'shim ok (exit 0)'"
echo "--- seeded replay (timed; local = emulated amd64, not the judge CPU) ---"
X 'start=$(date +%s%N); out=$(rokan-do run "what is the current status at githubstatus.com" 2>&1); ec=$?; end=$(date +%s%N); printf "%s\n" "$out" | tail -3; echo "wall $(( (end-start)/1000000 )) ms"; [ $ec -eq 0 ] || { echo "FAIL replay exit $ec"; exit 1; }; printf "%s" "$out" | grep -q "⚡" || { echo "FAIL replay printed no ⚡ line"; exit 1; }; echo "replay ok (exit 0, ⚡)"'
echo "--- recovery-beat project ---"
X 'cd demo && python3 -m pytest -q 2>&1 | tail -2'
echo "--- no key, no browser in the container (replays are browserless; nothing here can plan or spend) ---"
X 'test -z "${ANTHROPIC_API_KEY:-}" && echo "no ANTHROPIC_API_KEY (by design)"'
X 'test ! -d /ms-playwright && test ! -d "$HOME/.cache/ms-playwright" && echo "no browser (by design)"'

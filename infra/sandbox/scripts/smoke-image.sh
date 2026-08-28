#!/bin/sh
# Build the judge image locally and prove the bridge runs inside it: pair over ws://127.0.0.1:7331
# from the host, run a command on the container's PTY, and see the TTL end the session.
set -eu
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
sh scripts/sync-bridge.sh
docker build -t rokan-sandbox:local . 1>&2
TOKEN=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
docker rm -f rokan-sandbox-smoke >/dev/null 2>&1 || true
docker run -d --name rokan-sandbox-smoke -p 7331:7331 rokan-sandbox:local \
  node /opt/bridge/bin/rokan-terminal.js --no-tunnel --mode judge --host 0.0.0.0 --port 7331 --token "$TOKEN" --ttl-ms 20000 --app http://localhost:3311 >/dev/null
node "$HERE/scripts/pair-probe.mjs" "ws://127.0.0.1:7331" "$TOKEN"
RC=$?
docker logs rokan-sandbox-smoke 2>&1 | tail -5 1>&2
docker rm -f rokan-sandbox-smoke >/dev/null 2>&1 || true
exit $RC

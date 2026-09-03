#!/usr/bin/env bash
# Writes the short git SHA and the UTC time into apps/web/src/build-info.ts before a deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse --short HEAD)
AT=$(date -u '+%Y-%m-%d %H:%M UTC')
cat > apps/web/src/build-info.ts <<TS
/**
 * Stamped by the deploy step (scripts/stamp-build.sh): \`vercel\` CLI deploys carry no git hash, and
 * this route renders per request, so a build-time env never reaches it. Not committed with a real
 * value: the committed default is 'local'.
 */
export const BUILD_SHA = '$SHA';
export const BUILD_AT = '$AT';
TS
echo "stamped $SHA at $AT"

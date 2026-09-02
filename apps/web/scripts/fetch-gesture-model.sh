#!/usr/bin/env bash
# Provisions the MediaPipe gesture assets into apps/web/public/models/ (ticket T6).
#
# WHY A SCRIPT AND NOT A COMMIT: the two halves are 8.0MB (the .task model) and 34MB (three wasm
# builds — SIMD, no-SIMD, ES module). Forty-two megabytes of binaries do not belong in a git history
# that a human clones to read a hundred kilobytes of TypeScript. `public/models/` is gitignored;
# this script is the reproducible way to refill it, and it pins a sha256 so "reproducible" is a
# claim you can check rather than a hope.
#
# WHY SELF-HOSTED AT ALL: the alternative is loading the wasm and the model from Google's CDN at
# runtime. That would (a) send every visitor's IP to a third party the moment they enable a camera,
# (b) put a hard third-party dependency on a demo path, and (c) need a CSP hole. So: same origin,
# no runtime fetch off our domain, and the licence position stated out loud —
#
#   LICENCE: the @mediapipe/tasks-vision *code* is Apache-2.0. The gesture_recognizer.task *model
#   weights* are NOT: they are governed by the MediaPipe / Google model terms of service
#   (https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer and the model card
#   linked from it). Redistributing the weights inside our repository would be a licence question we
#   have not answered, so we do not: the file is fetched from Google's own bucket by the human who
#   runs the app, and it is served from our origin only for that deployment. Read the terms before
#   shipping this to production.
#
# Usage:  bash apps/web/scripts/fetch-gesture-model.sh          (from the repo root, or anywhere)
#         FORCE=1 bash apps/web/scripts/fetch-gesture-model.sh  (re-download even if present)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
web="$(dirname "$here")"
out="$web/public/models/mediapipe"

MODEL_URL="https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
# Observed 2026-08-30 from the URL above; if this ever changes, Google re-published the weights and
# somebody has to look at the model card before we serve the new ones.
MODEL_SHA256="97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482"
MODEL_BYTES=8373440

wasm_src="$web/node_modules/@mediapipe/tasks-vision/wasm"

echo "→ target: $out"
mkdir -p "$out/wasm"

# ---- 1. the wasm runtime, copied out of the pinned npm package ---------------
# Not downloaded: it is already on disk at the exact version in package.json, so copying it is the
# only way to guarantee the runtime and the JS bundle are the same build.
if [ ! -d "$wasm_src" ]; then
  echo "✗ $wasm_src is missing. Run 'pnpm install' in apps/web first." >&2
  exit 1
fi
cp -f "$wasm_src"/vision_wasm_*.js "$wasm_src"/vision_wasm_*.wasm "$out/wasm/"
echo "✓ wasm runtime: $(du -sh "$out/wasm" | cut -f1) in $(find "$out/wasm" -type f | wc -l) files"

# ---- 2. the model weights ----------------------------------------------------
model="$out/gesture_recognizer.task"
if [ -f "$model" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "✓ model already present ($(du -h "$model" | cut -f1)); FORCE=1 to re-download"
else
  echo "→ downloading gesture_recognizer.task (float16, ~8.0MB)"
  curl -fL --retry 3 -o "$model.part" "$MODEL_URL"
  mv "$model.part" "$model"
fi

size=$(wc -c < "$model" | tr -d '[:space:]')  # macOS wc pads with spaces; a string compare must not see them
if [ "$size" != "$MODEL_BYTES" ]; then
  echo "✗ unexpected size: $size bytes, expected $MODEL_BYTES. Google may have re-published the" >&2
  echo "  model; check the model card, then update MODEL_BYTES/MODEL_SHA256 in this script." >&2
  rm -f "$model"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  got=$(sha256sum "$model" | cut -d' ' -f1)
elif command -v shasum >/dev/null 2>&1; then
  got=$(shasum -a 256 "$model" | cut -d' ' -f1)
else
  echo "✗ no sha256 tool found — refusing to ship an unverified model (security review P2-2)." >&2
  exit 1
fi

if [ -n "$got" ]; then
  if [ "$MODEL_SHA256" = "__PIN_ME__" ]; then
    echo "! MODEL_SHA256 is unpinned. Observed: $got" >&2
  elif [ "$got" != "$MODEL_SHA256" ]; then
    echo "✗ checksum mismatch — removing the file so it can never be served." >&2
    echo "  expected $MODEL_SHA256" >&2
    echo "  got      $got" >&2
    rm -f "$model"
    exit 1
  else
    echo "✓ checksum ok"
  fi
fi

echo "✓ model: $(du -h "$model" | cut -f1)"
echo
echo "Done. The clinic dock offers Enable camera once a slot is held (see src/components/drop/GESTURE.md)."
echo "See src/components/drop/GESTURE.md for the manual camera test."

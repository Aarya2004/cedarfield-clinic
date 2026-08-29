// node --experimental-strip-types --test infra/sandbox/test/dockerfile-rokan.test.mjs — static guard on the
// judge image. Cloudflare counts the image against the instance disk (4 GB on `basic`); the 2026-08-28
// image (build-essential + Chromium apt deps + apt caches, 2 221 MB unpacked) never produced a healthy
// instance and the fleet silently kept the previous image — `rokan do` exited 127 live. The runtime
// stage must stay lean; the compiler lives in a throwaway stage. `pnpm smoke:image:rokan` measures the
// real unpacked size; this test catches the regression before a build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../Dockerfile.rokan', import.meta.url), 'utf8');
const stages = src.split(/^FROM /m).slice(1); // [build stage, runtime stage]
const runtime = stages[stages.length - 1];
const build = stages[0];

test('two stages: node-pty compiles in a throwaway stage, the runtime copies the result', () => {
  assert.equal(stages.length, 2);
  assert.match(build, /^[^\n]*AS bridge-build/);
  assert.match(build, /build-essential/);
  assert.match(runtime, /COPY --from=bridge-build --chown=judge:judge \/opt\/bridge \/opt\/bridge/);
});

test('runtime stage carries no compiler, no browser install, no apt/pip caches', () => {
  assert.doesNotMatch(runtime, /build-essential/);
  assert.doesNotMatch(runtime, /playwright install/);
  assert.doesNotMatch(runtime, /--with-deps/);
  for (const m of runtime.matchAll(/apt-get install[^\n]*(?:\\\n[^\n]*)*/g)) {
    // every apt install in the runtime stage is followed by a lists purge in the same RUN
    const rest = runtime.slice(m.index, runtime.indexOf('\n\n', m.index) === -1 ? undefined : runtime.indexOf('\n\n', m.index));
    assert.match(rest, /rm -rf \/var\/lib\/apt\/lists\/\*/);
  }
  assert.match(runtime, /--no-cache-dir/);
  assert.match(runtime, /rm -rf \/root\/\.cache/);
});

test('runtime stage installs rokan-do where the bridge looks and seeds it for the judge user', () => {
  assert.match(runtime, /ENV PATH=\/usr\/local\/python\/bin:\$PATH/);
  assert.match(runtime, /rokan-do --help >\/dev\/null/);
  assert.match(runtime, /USER judge/);
  assert.match(runtime, /rokan-do seed install && rokan-do seed install \/home\/judge\/rokan-seed-ops\.json/);
  assert.doesNotMatch(runtime, /ANTHROPIC_API_KEY/);
});

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
// Docker treats FROM case-insensitively and allows leading whitespace; split on every real FROM so a
// sneaked-in final `  from scratch` is counted (Codex review), not silently ignored.
const stages = src.split(/^[ \t]*from\s/im).slice(1);
const runtime = stages[stages.length - 1];
const build = stages[0];
// Each RUN command = a "RUN ..." with its backslash continuations, up to the next instruction/blank.
const runCommands = (stage) => [...stage.matchAll(/(?:^|\n)[ \t]*RUN\s[\s\S]*?(?=\n[ \t]*(?:RUN|COPY|ENV|USER|WORKDIR|FROM|ENTRYPOINT|CMD|ARG|LABEL|EXPOSE|VOLUME)\s|\n[ \t]*\n|$)/gi)].map((m) => m[0]);

test('exactly two stages: node-pty compiles in a throwaway stage, the runtime copies the result', () => {
  assert.equal(stages.length, 2, `expected 2 build stages, found ${stages.length}`);
  assert.match(build, /^[^\n]*AS bridge-build/i);
  assert.match(build, /build-essential/);
  assert.match(runtime, /COPY --from=bridge-build --chown=judge:judge \/opt\/bridge \/opt\/bridge/);
});

test('runtime stage carries no compiler, no browser install, no apt/pip caches', () => {
  assert.doesNotMatch(runtime, /build-essential/);
  assert.doesNotMatch(runtime, /playwright install/);
  assert.doesNotMatch(runtime, /--with-deps/);
  // Every RUN that installs apt packages must purge the lists IN THE SAME RUN — a purge in a later
  // RUN leaves the lists in an earlier layer and the image still grows (Codex review).
  const runs = runCommands(runtime);
  const aptRuns = runs.filter((r) => /apt-get install/.test(r));
  assert.ok(aptRuns.length >= 1, 'expected the runtime stage to install apt packages in a RUN');
  for (const r of aptRuns) assert.match(r, /rm -rf \/var\/lib\/apt\/lists\/\*/, `apt install without a same-RUN lists purge:\n${r}`);
  const pipRuns = runs.filter((r) => /pip install/.test(r));
  for (const r of pipRuns) assert.ok(/--no-cache-dir/.test(r) || /--no-cache/.test(r), `pip install without --no-cache:\n${r}`);
  assert.match(runtime, /rm -rf \/root\/\.cache/);
});

test('runtime stage installs rokan-do where the bridge looks and seeds it for the judge user', () => {
  assert.match(runtime, /ENV PATH=\/usr\/local\/python\/bin:\$PATH/);
  assert.match(runtime, /rokan-do --help >\/dev\/null/);
  assert.match(runtime, /USER judge/);
  assert.match(runtime, /rokan-do seed install && rokan-do seed install \/home\/judge\/rokan-seed-ops\.json/);
  assert.doesNotMatch(runtime, /ANTHROPIC_API_KEY/);
});

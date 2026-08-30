// node --experimental-strip-types --test infra/sandbox/test/dockerfile-rokan.test.mjs — static guard on the
// judge image. Cloudflare counts the image against the instance disk (8 GB on `standard-1`); the 2026-08-28
// image (build-essential + Chromium apt deps + apt caches, 2 221 MB unpacked) never produced a healthy
// instance and the fleet silently kept the previous image — `rokan do` exited 127 live. The runtime
// stage must stay lean; the compiler lives in a throwaway stage. `pnpm smoke:image:rokan` measures the
// real unpacked size (MAX_MB=3500); this test catches the regression before a build.
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

test('runtime stage carries no compiler, exactly one Playwright chromium install with a same-RUN purge, no apt/pip caches', () => {
  assert.doesNotMatch(runtime, /build-essential/);
  assert.doesNotMatch(runtime, /--with-deps/); // the 1.46 GB variant of 2026-08-28: retained .debs + full X stack
  const pw = runCommands(runtime).filter((r) => /playwright install chromium/.test(r));
  assert.equal(pw.length, 1, 'exactly one RUN installs the browser');
  assert.match(pw[0], /playwright install-deps chromium/);
  assert.match(pw[0], /rm -rf \/var\/lib\/apt\/lists\/\* \/var\/cache\/apt\/archives\/\*/, 'apt lists AND archives purged in the same RUN');
  assert.match(runtime, /ENV PLAYWRIGHT_BROWSERS_PATH=\/ms-playwright/);
  assert.match(runtime, /ROKAN_BROWSER_NO_SANDBOX=1/);
  assert.match(runtime, /ROKAN_TASK_CLASSES=read_value,read_list/);
  assert.match(runtime, /ROKAN_GUARD_ALL_HOSTS=1/);
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
  // No key in the image: the proxy URL + the documented dummy come from worker.ts at startProcess time.
  assert.doesNotMatch(runtime, /ANTHROPIC_API_KEY|sk-ant-/);
});

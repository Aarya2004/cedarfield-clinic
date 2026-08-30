// node --experimental-strip-types --test infra/sandbox/test/vendor-wheels.test.mjs — static guard on the
// wheels Dockerfile.rokan installs. `uv pip install rokan_do-*.whl` with TWO rokan_do wheels in the
// directory is ambiguous, and a wheel built from the wrong Rokan branch installs a rokan-do with no
// `native.py` — `rokan do` then imports fine and fails at first use. Rebuild with
// `sh infra/sandbox/scripts/build-wheels.sh`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VENDOR = fileURLToPath(new URL('../container/vendor/', import.meta.url));
const FLOOR = { rokan_do: '0.0.2', rokan_mcp: '0.1.2', rokan_agent: '0.0.2' };
const WHEEL = /^(rokan_(?:do|mcp|agent))-(\d+\.\d+\.\d+)-py3-none-any\.whl$/;

const wheels = readdirSync(VENDOR)
  .map((name) => name.match(WHEEL))
  .filter(Boolean)
  .map((m) => ({ file: m[0], pkg: m[1], version: m[2] }));

const cmpVersion = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

let unzip = true;
try {
  execFileSync('unzip', ['-v'], { stdio: 'ignore' });
} catch {
  unzip = false;
}

test('exactly one wheel per package in container/vendor', () => {
  for (const pkg of Object.keys(FLOOR)) {
    const found = wheels.filter((w) => w.pkg === pkg);
    assert.equal(found.length, 1, `${pkg}: expected 1 wheel, found ${found.map((w) => w.file).join(', ') || 'none'}`);
  }
  const strays = readdirSync(VENDOR).filter((n) => n.endsWith('.whl') && !WHEEL.test(n));
  assert.deepEqual(strays, [], `unexpected wheels: ${strays.join(', ')}`);
});

test('every wheel is at or above its floor version', () => {
  for (const w of wheels) {
    assert.ok(
      cmpVersion(w.version, FLOOR[w.pkg]) >= 0,
      `${w.file} is below the floor ${FLOOR[w.pkg]} — run scripts/build-wheels.sh`,
    );
  }
});

test('the rokan_do wheel carries native.py (built from the tier0-native branch)', { skip: unzip ? false : 'unzip is not on PATH — cannot inspect wheel contents' }, () => {
  const w = wheels.find((x) => x.pkg === 'rokan_do');
  assert.ok(w, 'no rokan_do wheel');
  const listing = execFileSync('unzip', ['-l', VENDOR + w.file], { encoding: 'utf8' });
  assert.match(listing, /\brokan_do\/native\.py$/m, `${w.file} has no rokan_do/native.py`);
});

// Run: node --experimental-strip-types --test src/lib/webmcp/schemas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDangerous, isDangerousIn } from './schemas.ts';

test('regression (Fable pass 1 P2 / PLAN §4): sudo is hard-blocked in judge mode only', () => {
  for (const c of ['sudo rm x', '  sudo -i', 'ls | sudo tee /etc/x', 'a; sudo b', 'a && sudo b', 'a || sudo b', '(sudo b)', 'env sudo b']) {
    assert.equal(isDangerousIn(c, 'judge'), true, c);
    assert.equal(isDangerousIn(c, 'builder'), isDangerous(c), c);
  }
  for (const c of ['echo sudo', 'ls pseudo', 'cat sudoers.md', 'git log --author=sudo']) {
    assert.equal(isDangerousIn(c, 'judge'), false, c);
  }
  assert.equal(isDangerousIn('rm -rf /', 'builder'), true); // the shared patterns still apply everywhere
});

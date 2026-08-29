// Run: node --experimental-strip-types --test src/components/forge/forge-preview.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainForgeError, hasPlaceholders, splitPlaceholders } from './forge-preview.ts';
import { placeholdersIn } from '../../lib/webmcp/forge-spec.ts';

test('splitPlaceholders keeps literal text and marks declared / unknown params', () => {
  const segs = splitPlaceholders('rokan do "top {{n}} HN titles" | head -{{ n }} {{missing}}', ['n']);
  assert.deepEqual(segs, [
    { kind: 'text', text: 'rokan do "top ' },
    { kind: 'param', text: '{{n}}', name: 'n' },
    { kind: 'text', text: ' HN titles" | head -' },
    { kind: 'param', text: '{{ n }}', name: 'n' },
    { kind: 'text', text: ' ' },
    { kind: 'unknown', text: '{{missing}}', name: 'missing' },
  ]);
  assert.equal(segs.map((s) => s.text).join(''), 'rokan do "top {{n}} HN titles" | head -{{ n }} {{missing}}');
});

test('splitPlaceholders agrees with the engine grammar on what is a placeholder', () => {
  const cmd = 'echo {{a}} {{B}} {{a_1}} {{ 1x }} {{toolongtoolongtoolongx}} {{ok}}';
  const mine = splitPlaceholders(cmd, ['a', 'a_1', 'ok'])
    .filter((s) => s.kind !== 'text')
    .map((s) => (s as { name: string }).name);
  assert.deepEqual(mine, placeholdersIn(cmd));
});

test('splitPlaceholders on a plain command is one text segment; empty is empty', () => {
  assert.deepEqual(splitPlaceholders('ls -la', []), [{ kind: 'text', text: 'ls -la' }]);
  assert.deepEqual(splitPlaceholders('', []), []);
});

test('hasPlaceholders is stateless across calls (global regex lastIndex reset)', () => {
  assert.equal(hasPlaceholders(['ls', 'echo {{x}}']), true);
  assert.equal(hasPlaceholders(['echo {{x}}']), true);
  assert.equal(hasPlaceholders(['echo {{x}}']), true);
  assert.equal(hasPlaceholders(['ls', 'pwd']), false);
});

test('explainForgeError writes a sentence for the codes a human can act on', () => {
  assert.match(explainForgeError({ error: 'unpin_one' }), /Unpin one/);
  assert.match(explainForgeError({ error: 'needs_confirmation' }), /Approve anyway/);
  assert.equal(explainForgeError({ error: 'invalid_name', detail: 'x' }), 'invalid_name: x');
  assert.equal(explainForgeError({ error: 'invalid_name' }), 'invalid_name');
});

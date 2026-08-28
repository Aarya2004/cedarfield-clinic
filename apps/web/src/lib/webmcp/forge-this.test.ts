// Run: node --experimental-strip-types --test src/lib/webmcp/forge-this.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessName, linesToSpec, stripPrompt } from './forge-this.ts';

test('stripPrompt removes the common prompts and keeps the command', () => {
  assert.equal(stripPrompt('~ $ ls -la'), 'ls -la');
  assert.equal(stripPrompt('$ pytest -q'), 'pytest -q');
  assert.equal(stripPrompt('% git status'), 'git status');
  assert.equal(stripPrompt('❯ npm test'), 'npm test');
  assert.equal(stripPrompt('aravkekane@Aravs-MacBook-Pro ~ % rokan do "top 5 HN titles"'), 'rokan do "top 5 HN titles"');
  assert.equal(stripPrompt('judge@rokan:~ % seq 1 3'), 'seq 1 3');
  assert.equal(stripPrompt('  README.md  package.json'), 'README.md  package.json'); // output line: kept, human edits
  assert.equal(stripPrompt('echo $HOME/x'), 'echo $HOME/x'); // a `$` inside the command is not a prompt
});

test('guessName follows the forge name grammar', () => {
  assert.equal(guessName('rokan do "top"', '42'), 'rokan_42');
  assert.equal(guessName('git status'), 'git');
  assert.equal(guessName('./run.sh', '7'), 'run_sh_7');
  assert.equal(guessName('123abc', '7'), 'abc_7');
  assert.equal(guessName('!!!', '9'), 'tool_9');
  assert.equal(guessName('averyveryveryverylongcommandname_xyz', '1').length <= 30, true);
});

test('linesToSpec: up to 5 commands, description honest, kind read', () => {
  const s = linesToSpec(['~ $ pnpm build', '~ $ pnpm test', '', '~ $ netlify deploy --prod'], '5');
  assert.deepEqual(s.commands, ['pnpm build', 'pnpm test', 'netlify deploy --prod']);
  assert.equal(s.name, 'pnpm_5');
  assert.equal(s.description, 'Forged from 3 commands the human ran.');
  assert.equal(s.kind, 'read');
  assert.equal(linesToSpec(['$ a', '$ b', '$ c', '$ d', '$ e', '$ f']).commands.length, 5);
});

// Run: node --experimental-strip-types --test src/lib/webmcp/forge-spec.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceInput,
  contentHash,
  forgedDescription,
  forgedInputSchema,
  isMutating,
  placeholderInQuotes,
  placeholdersIn,
  renderParamValue,
  substituteParams,
  validateForgeSpec,
  type ForgeSpec,
} from './forge-spec.ts';

const base: ForgeSpec = {
  name: 'hn_top',
  description: 'Top N Hacker News titles via rokan do.',
  commands: ['rokan do "top {{n}} HN titles"'],
  params: [{ name: 'n', description: 'How many titles', example: '5' }],
  kind: 'read',
};

test('valid spec passes', () => {
  assert.equal(validateForgeSpec(base), null);
});

test('name regex', () => {
  assert.equal(validateForgeSpec({ ...base, name: 'Hn' })?.error, 'invalid_name');
  assert.equal(validateForgeSpec({ ...base, name: 'a' })?.error, 'invalid_name');
  assert.equal(validateForgeSpec({ ...base, name: 'a'.repeat(30) })?.error, 'invalid_name');
  assert.equal(validateForgeSpec({ ...base, name: 'ok_name9' }), null);
});

test('description / commands / params limits', () => {
  assert.equal(validateForgeSpec({ ...base, description: '' })?.error, 'invalid_description');
  assert.equal(validateForgeSpec({ ...base, description: 'x'.repeat(301) })?.error, 'invalid_description');
  assert.equal(validateForgeSpec({ ...base, commands: [] })?.error, 'invalid_command');
  assert.equal(validateForgeSpec({ ...base, commands: Array(6).fill('ls') })?.error, 'invalid_command');
  assert.equal(validateForgeSpec({ ...base, commands: ['ls\nrm -rf /'] })?.error, 'invalid_command');
  const sevenParams = Array.from({ length: 7 }, (_, i) => ({ name: `p${i}`, description: 'd', example: 'e' }));
  assert.equal(validateForgeSpec({ ...base, params: sevenParams, commands: [sevenParams.map((p) => `{{${p.name}}}`).join(' ')] })?.error, 'invalid_params');
  assert.equal(validateForgeSpec({ ...base, params: [{ name: 'N', description: 'd', example: 'e' }], commands: ['echo {{N}}'] })?.error, 'invalid_params');
  assert.equal(validateForgeSpec({ ...base, params: [{ name: 'n', description: '', example: '5' }] })?.error, 'invalid_params');
  assert.equal(validateForgeSpec({ ...base, kind: 'nope' as never })?.error, 'invalid_kind');
});

test('placeholder ↔ param consistency', () => {
  assert.equal(validateForgeSpec({ ...base, commands: ['echo {{x}}'] })?.error, 'unknown_placeholder');
  assert.equal(validateForgeSpec({ ...base, commands: ['echo hi'] })?.error, 'unused_param');
  assert.deepEqual(placeholdersIn('a {{n}} b {{ m }} {{n}}'), ['n', 'm', 'n']);
});

test('placeholderInQuotes detects context (informational)', () => {
  assert.equal(placeholderInQuotes('echo "{{n}}"'), true);
  assert.equal(placeholderInQuotes("echo '{{n}}'"), true);
  assert.equal(placeholderInQuotes('echo {{n}} "x"'), false);
  assert.equal(placeholderInQuotes('echo "a\\"b" {{n}}'), false);
});

test('substitution inside quotes stays literal (the hero command is quoted)', () => {
  const v = (cmd: string, n: unknown) => {
    const r = substituteParams([cmd], base.params, { n });
    if ('error' in r) throw new Error(JSON.stringify(r));
    return r.lines[0];
  };
  assert.equal(v('rokan do "top {{n}} HN titles"', 3), 'rokan do "top 3 HN titles"');
  assert.equal(v('rokan do "top {{n}} HN titles"', '3; rm -rf /'), 'rokan do "top "\'3; rm -rf /\'" HN titles"');
  assert.equal(v('rokan do "top {{n}} HN titles"', '$(id)'), 'rokan do "top "\'$(id)\'" HN titles"');
  assert.equal(v("echo '{{n}}'", "it's"), "echo 'it'\\''s'");
  assert.equal(v("echo '{{n}}'", '$(id)'), "echo '$(id)'");
  assert.equal(v('echo "\\"{{n}}\\""', 'x y'), 'echo "\\""\'x y\'"\\""');
});

const spec: ForgeSpec = { ...base, commands: ['rokan do {{n}}'] };

test('substitution: bare values stay bare, everything else is single-quoted', () => {
  const ok = (input: Record<string, unknown>) => {
    const r = substituteParams(spec.commands, spec.params, input);
    if ('error' in r) throw new Error(JSON.stringify(r));
    return r.lines[0];
  };
  assert.equal(ok({ n: 3 }), 'rokan do 3');
  assert.equal(ok({ n: 'main' }), 'rokan do main');
  assert.equal(ok({ n: './x/y.txt' }), 'rokan do ./x/y.txt');
  assert.equal(ok({ n: 'a b' }), "rokan do 'a b'");
  assert.equal(ok({ n: '3; rm -rf /' }), "rokan do '3; rm -rf /'");
  assert.equal(ok({ n: '$(id)' }), "rokan do '$(id)'");
  assert.equal(ok({ n: '`id`' }), "rokan do '`id`'");
  assert.equal(ok({ n: "it's" }), "rokan do 'it'\\''s'");
  assert.equal(ok({ n: '~' }), "rokan do '~'");
  assert.equal(ok({ n: true }), 'rokan do true');
});

test('substitution: bad values rejected', () => {
  const bad = (input: Record<string, unknown>) => {
    const r = substituteParams(spec.commands, spec.params, input);
    return 'error' in r ? r.error : null;
  };
  assert.equal(bad({}), 'invalid_param');
  assert.equal(bad({ n: '' }), 'invalid_param');
  assert.equal(bad({ n: 'a\nb' }), 'invalid_param');
  assert.equal(bad({ n: 'ab' }), 'invalid_param');
  assert.equal(bad({ n: '‮3' }), 'invalid_param');
  assert.equal(bad({ n: { x: 1 } }), 'invalid_param');
  assert.equal(bad({ n: 'x'.repeat(201) }), 'invalid_param');
  assert.equal(renderParamValue('n', Infinity).hasOwnProperty('error'), true);
  const long = substituteParams(['echo {{n}} ' + 'y'.repeat(300)], spec.params, { n: 'z'.repeat(150) });
  assert.equal('error' in long ? long.error : null, 'too_long');
});

test('substitution flags dangerous resulting lines', () => {
  const r = substituteParams(['rm -rf {{p}}'], [{ name: 'p', description: 'd', example: '/tmp/x' }], { p: '/' });
  if ('error' in r) throw new Error(r.error);
  assert.equal(r.lines[0], 'rm -rf /');
  assert.equal(r.dangerous[0], true);
});

test('isMutating', () => {
  assert.equal(isMutating('ls -la'), false);
  assert.equal(isMutating('git push origin main'), true);
  assert.equal(isMutating('rm -rf build'), true);
  assert.equal(isMutating('netlify deploy --prod'), true);
  assert.equal(isMutating('curl -X POST https://x'), true);
  assert.equal(isMutating('echo hi > out.txt'), true);
  assert.equal(isMutating('rokan do "top 5 HN"'), false);
});

test('content hash: stable across key order, changes with any field', async () => {
  const h1 = await contentHash(spec);
  const h2 = await contentHash({ kind: spec.kind, params: [...spec.params], commands: [...spec.commands], description: spec.description, name: spec.name });
  assert.equal(h1, h2);
  assert.equal(h1.length, 12);
  assert.notEqual(await contentHash({ ...spec, kind: 'write' }), h1);
  assert.notEqual(await contentHash({ ...spec, description: spec.description + '!' }), h1);
  assert.notEqual(await contentHash({ ...spec, commands: ['rokan do {{n}} --json'] }), h1);
  assert.notEqual(await contentHash({ ...spec, params: [{ ...spec.params[0], example: '6' }] }), h1);
});

test('forged description + schema', () => {
  const d = forgedDescription({ ...spec, kind: 'write' });
  assert.ok(d.startsWith('CONSEQUENTIAL: '));
  assert.ok(d.length <= 500);
  assert.ok(d.includes('1 command into'));
  const longD = forgedDescription({ ...spec, description: 'x'.repeat(300) });
  assert.ok(longD.length <= 500);
  const schema = forgedInputSchema(spec) as { required: string[]; additionalProperties: boolean; properties: Record<string, { examples: string[] }> };
  assert.deepEqual(schema.required, ['n']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.n.examples, ['5']);
});

test('coerceInput handles string, object, garbage', () => {
  assert.deepEqual(coerceInput('{"n":"3"}'), { n: '3' });
  assert.deepEqual(coerceInput({ n: 3 }), { n: 3 });
  assert.deepEqual(coerceInput('not json'), {});
  assert.deepEqual(coerceInput(undefined), {});
  assert.deepEqual(coerceInput('"str"'), {});
});

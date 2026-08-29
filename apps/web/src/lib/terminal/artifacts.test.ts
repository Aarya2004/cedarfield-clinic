// Run: node --experimental-strip-types --test src/lib/terminal/artifacts.test.ts
//
// Detection is a promise to a judge: if the row says "JSON", the panel must not open a mess. So the
// negatives below are the real shapes a terminal prints — prompt echoes, ndjson, colour codes with
// the ESC byte already stripped by the run-feed store, --help output, diffs, prose with commas —
// and every one of them must classify as nothing at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, detectionFor, rokanArtifact, safeUrl, splitDelimited, tableFromJson } from './artifacts.ts';
import type { Run } from './runfeed.ts';

const run = (over: Partial<Run> = {}): Run => ({
  id: 'r1',
  command: 'echo hi',
  origin: 'human',
  exit_code: 0,
  ms: 10,
  cwd: '/home/dev',
  tail: [],
  t: 0,
  measured: true,
  ...over,
});

/* ------------------------------------------------------------------ JSON */

test('json: a whole tail that parses as one value is a confident artifact', () => {
  const d = detect(['{', '  "name": "rokan",', '  "tools": 6', '}']);
  assert.equal(d?.artifact.kind, 'json');
  assert.equal(d?.confident, true);
  assert.equal(d?.action, 'Open as JSON');
  assert.deepEqual(d?.artifact.kind === 'json' ? d.artifact.value : null, { name: 'rokan', tools: 6 });
});

test('json: an array of objects is table-able, with first-appearance column order', () => {
  const d = detect(['[{"name":"alice","role":"dev"},{"role":"ops","name":"bob","city":"lisbon"}]']);
  assert.equal(d?.artifact.kind, 'json');
  assert.equal(d?.action, 'Open as JSON table');
  const t = d?.artifact.kind === 'json' ? d.artifact.table : null;
  assert.deepEqual(t?.columns, ['name', 'role', 'city']);
  assert.deepEqual(t?.rows, [
    ['alice', 'dev', ''],
    ['bob', 'ops', 'lisbon'],
  ]);
  assert.equal(t?.truncated, false);
});

test('json: an array of scalars renders as a tree, not a table', () => {
  const d = detect(['[1, 2, 3]']);
  assert.equal(d?.artifact.kind === 'json' ? d.artifact.table : 'x', null);
  assert.equal(tableFromJson([1, 2, 3]), null);
  assert.equal(tableFromJson([]), null);
  assert.equal(tableFromJson({ a: 1 }), null);
});

test('json: a leading command echo still finds the document, but is no longer confident', () => {
  const d = detect(['cat package.json', '{"name": "web", "private": true}']);
  assert.equal(d?.artifact.kind, 'json');
  assert.equal(d?.confident, false);
});

test('the real shape a shell with no integration captures: echo, output, next prompt', () => {
  // copied byte for byte from a live bash bridge, 2026-08-29
  const cmd = 'printf \'[{"name":"alice","role":"dev"},{"name":"bob","role":"ops"}]\\n\'';
  const tail = [cmd, '[{"name":"alice","role":"dev"},{"name":"bob","role":"ops"}]', 'aarya@Aarya-desktop:~$ '];
  // the next prompt alone is dropped as chrome, but the echo is still a guess without the command
  assert.equal(detect(tail)?.confident, false);
  // with the command, both frames are exact: the JSON document is all that is left
  const d = detect(tail, cmd);
  assert.equal(d?.artifact.kind, 'json');
  assert.equal(d?.action, 'Open as JSON table');
  assert.equal(d?.confident, true);
  assert.deepEqual(d?.artifact.kind === 'json' ? d.artifact.table?.columns : null, ['name', 'role']);
  // the same frames around a table: without the echo strip this is ragged and detects as nothing
  assert.equal(detect(['cat people.csv', 'name,role', 'alice,dev', 'bob,ops', 'dev@box:~$ ']), null);
  assert.equal(detect(['cat people.csv', 'name,role', 'alice,dev', 'bob,ops', 'dev@box:~$ '], 'cat people.csv')?.artifact.kind, 'csv');
  // the prompt line alone is never content
  assert.equal(detect(['aarya@Aarya-desktop:~$ ']), null);
});

test('json: ndjson, json-ish logs, bare scalars and colour leftovers are not JSON', () => {
  // two values, not one document
  assert.equal(detect(['{"a":1}', '{"a":2}']), null);
  // a log line either side of an object
  assert.equal(detect(['2026-08-29 INFO start', '{"a": 1}', '2026-08-29 INFO done']), null);
  // output, not a document
  assert.equal(detect(['42']), null);
  assert.equal(detect(['"ok"']), null);
  // `jq -C` with the ESC bytes already stripped by the store: the brackets are text, not JSON
  assert.equal(detect(['[1;39m{', '  [34;1m"a"[0m: [0;32m"b"[0m', '[1;39m}']), null);
  // truncated output
  assert.equal(detect(['{"a": 1,']), null);
});

/* ------------------------------------------------------------ CSV / TSV */

test('csv: a header and two rows is a confident table', () => {
  const d = detect(['name,role,city', 'alice,dev,berlin', 'bob,ops,lisbon', '']);
  assert.equal(d?.artifact.kind, 'csv');
  assert.equal(d?.type, 'CSV');
  assert.equal(d?.action, 'Open as CSV table');
  assert.equal(d?.confident, true);
  const t = d?.artifact.kind === 'csv' ? d.artifact.table : null;
  assert.deepEqual(t?.columns, ['name', 'role', 'city']);
  assert.deepEqual(t?.rows, [
    ['alice', 'dev', 'berlin'],
    ['bob', 'ops', 'lisbon'],
  ]);
});

test('csv: a header and one row is offered but not confident', () => {
  assert.equal(detect(['a,b', '1,2'])?.confident, false);
});

test('csv: quotes group a delimiter inside a cell', () => {
  assert.deepEqual(splitDelimited('a,"b,c",d', ','), ['a', 'b,c', 'd']);
  assert.deepEqual(splitDelimited('"say ""hi""",x', ','), ['say "hi"', 'x']);
  assert.deepEqual(splitDelimited('one\ttwo', '\t'), ['one', 'two']);
  const d = detect(['id,label', '1,"one,two"', '2,three']);
  assert.deepEqual(d?.artifact.kind === 'csv' ? d.artifact.table.rows[0] : null, ['1', 'one,two']);
});

test('tsv: tabs are a table too', () => {
  const d = detect(['name\tms', 'plan\t900', 'replay\t312']);
  assert.equal(d?.artifact.kind, 'tsv');
  assert.equal(d?.type, 'TSV');
});

test('csv: commands and command output are never a table', () => {
  // one column is not a table
  assert.equal(detect(['names', 'alice', 'bob']), null);
  // ragged rows (a python traceback: commas, but never the same count)
  assert.equal(detect(['File "app.py", line 3, in <module>', '    total = add(a, b)']), null);
  // prose with commas: real cells do not start with a space
  assert.equal(detect(['Fetching the index, please wait', 'Done, thanks']), null);
  // a sentence per cell is prose, not data
  assert.equal(detect(['step,note', 'one,this is a much longer sentence than any real cell would be']), null);
  // a prompt echo is not a header
  assert.equal(detect(['$ cut -d, -f1 a,b', 'x,y', 'p,q']), null);
  // a blank line inside means this is output with structure, not one table
  assert.equal(detect(['a,b', '', 'c,d']), null);
  // ls -l: no delimiter at all
  assert.equal(detect(['total 8', 'drwxr-xr-x  4 dev  staff  128 Aug 29 10:00 .']), null);
});

/* -------------------------------------------------------------- Markdown */

test('markdown: headings plus lists are Markdown, confidently', () => {
  const d = detect(['# Release notes', '', '- Fixed the ghost bar', '- Added the run feed', '', '## Details', 'It ships tonight.']);
  assert.equal(d?.artifact.kind, 'markdown');
  assert.equal(d?.type, 'Markdown');
  assert.equal(d?.confident, true);
  assert.match(d?.artifact.kind === 'markdown' ? d.artifact.text : '', /^# Release notes/);
});

test('markdown: a heading plus a fenced block counts', () => {
  const d = detect(['## Usage', '', '```sh', 'rokan do "top 5 HN titles"', '```']);
  assert.equal(d?.artifact.kind, 'markdown');
  assert.equal(d?.confident, true);
});

test('markdown: prose, scripts, diffs and --help output are not Markdown', () => {
  // plain prose has no signal at all
  assert.equal(detect(['The build finished and everything looks fine.', 'Nothing here is a document.']), null);
  // a shell script: `# comment` looks like a heading, and that alone is never enough
  assert.equal(detect(['#!/bin/bash', '# Usage: deploy.sh <env>', '# Deploys the app', 'set -eu']), null);
  // a diff wears `-`/`+` lines that read exactly like a list
  assert.equal(detect(['# Changelog', 'diff --git a/x b/y', '- old line', '+ new line']), null);
  // `--help`: the flag lines are not list items (no space after the dash)
  assert.equal(detect(['Usage: tool [options]', '', 'Options:', '  -h, --help     show this help', '  -v, --version  print the version']), null);
  // a transcript of two commands is not a document
  assert.equal(detect(['$ ls', '# notes', '- one', '$ pwd']), null);
});

/* ------------------------------------------------------------------ HTML */

test('html: a whole document is an HTML artifact, kept byte for byte', () => {
  const tail = ['<!DOCTYPE html>', '<html lang="en">', '<head><title>Status</title></head>', '<body><h1>All green</h1><p>Nothing to do.</p></body>', '</html>'];
  const d = detect(tail);
  assert.equal(d?.artifact.kind, 'html');
  assert.equal(d?.type, 'HTML');
  assert.equal(d?.action, 'Open as HTML page');
  assert.equal(d?.confident, true);
  // nothing is stripped, rewritten or escaped here — the sandbox in the panel is the boundary
  assert.equal(d?.artifact.kind === 'html' ? d.artifact.doc : '', tail.join('\n'));
});

test('html: a doctype-less <html> document counts, and so does a minified one', () => {
  assert.equal(detect(['<html><head></head><body><p>hi</p></body></html>'])?.confident, true);
  assert.equal(detect(['<!doctype html><html><body><h1>404 Not Found</h1></body></html>'])?.artifact.kind, 'html');
  // `<html>` cut off mid-stream still opens (a page is the only sane view of it) but is a guess
  const cut = detect(['<!doctype html>', '<html><body><h1>Report</h1><p>rows follow…</p></body>']);
  assert.equal(cut?.artifact.kind, 'html');
  assert.equal(cut?.confident, false);
});

test('html: an error page IS the artifact when the whole tail is the page, and is not when it is buried', () => {
  // Deliberate: what the server sent is what the run printed, so rendering the 404 is the honest view.
  const page = '<!doctype html><html><head><title>404</title></head><body><h1>404 Not Found</h1><hr><address>nginx</address></body></html>';
  assert.equal(detect([page])?.artifact.kind, 'html');
  // …but the same page inside a curl trace is a log with markup in it, not a document
  assert.equal(detect(['> GET /missing HTTP/1.1', '< HTTP/1.1 404 Not Found', '< content-type: text/html', page]), null);
  // the command echo is exact chrome, so a recorded command still finds the page behind it
  const cmd = 'curl -s https://example.com/missing';
  assert.equal(detect([cmd, page], cmd)?.artifact.kind, 'html');
  assert.equal(detect([cmd, page]), null);
});

test('html: prose with tags, fragments, XML and SVG are not HTML documents', () => {
  // prose that mentions a tag
  assert.equal(detect(['Use the <html> element to open a document.', 'Then close it.']), null);
  // a fragment: no document start
  assert.equal(detect(['<div class="row">', '  <p>one</p>', '</div>']), null);
  // fewer than three tags, and nothing closed
  assert.equal(detect(['<html>']), null);
  assert.equal(detect(['<!doctype html>', '<html>']), null);
  // XML and SVG roots are out of scope — an SVG can carry script-adjacent content
  assert.equal(detect(['<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0"><channel><title>x</title></channel></rss>']), null);
  assert.equal(detect(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>']), null);
  // an XML declaration before the doctype means the tail did not start as an HTML document
  assert.equal(detect(['<?xml version="1.0"?>', '<!DOCTYPE html>', '<html><body><p>x</p></body></html>']), null);
  // a heredoc that writes a page is a command, not output
  assert.equal(detect(['cat > page.html <<EOF', '<!doctype html><html><body><p>x</p></body></html>', 'EOF']), null);
});

/* ------------------------------------------------------------------ URLs */

test('urls: a list of links is a link artifact, deduped and in order', () => {
  const d = detect(['https://news.ycombinator.com/item?id=1', 'https://example.com/a', 'https://news.ycombinator.com/item?id=1']);
  assert.equal(d?.artifact.kind, 'urls');
  assert.equal(d?.confident, true);
  assert.deepEqual(d?.artifact.kind === 'urls' ? d.artifact.urls : null, ['https://news.ycombinator.com/item?id=1', 'https://example.com/a']);
  assert.equal(d?.action, 'Open the 2 links');
});

test('urls: one line that is one link still opens', () => {
  const d = detect(['https://github.com/rokan/pull/1']);
  assert.equal(d?.artifact.kind, 'urls');
  assert.equal(d?.type, 'Link');
  assert.equal(d?.action, 'Open the link');
});

test('urls: a link buried in output is not a link list, and only http(s) is a link', () => {
  assert.equal(detect(['added 240 packages', 'found 0 vulnerabilities', 'run `npm fund` for details', 'https://example.com/x']), null);
  assert.equal(detect(['javascript:alert(1)']), null);
  assert.equal(detect(['data:text/html,<script>x</script>']), null);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('file:///etc/passwd'), null);
  assert.equal(safeUrl('see https://example.com now'), null);
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
});

/* ----------------------------------------------------------------- rokan */

test('rokan: a replayed run maps to a card with zero calls and the measured ms', () => {
  const d = rokanArtifact(
    run({
      command: 'rokan do "latest pydantic version at pypi.org"',
      ms: 400,
      rokan: { ms: 312, replayed: true },
      tail: ['resolving…', '  pydantic 2.9.2   312ms  ⚡'],
    }),
  );
  assert.equal(d?.artifact.kind, 'rokan');
  const c = d?.artifact.kind === 'rokan' ? d.artifact.card : null;
  assert.equal(c?.question, 'latest pydantic version at pypi.org');
  assert.equal(c?.answer, 'pydantic 2.9.2');
  assert.equal(c?.ms, 312);
  assert.equal(c?.totalMs, 400);
  assert.equal(c?.replayed, true);
  assert.equal(c?.calls, 0);
  assert.equal(c?.exit_code, 0);
  assert.deepEqual(c?.lines, ['resolving…']);
  assert.equal(d?.action, 'Open result card');
});

test('rokan: a planned run never invents a call count, and the native token fills site/tool', () => {
  const planned = rokanArtifact(run({ command: 'rokan do "top 3 HN titles"', rokan: { ms: 900, replayed: false }, tail: ['  Show HN: a thing   900ms'] }));
  const c = planned?.artifact.kind === 'rokan' ? planned.artifact.card : null;
  assert.equal(c?.calls, null);
  assert.equal(c?.replayed, false);
  assert.equal(c?.site, null);
  assert.equal(c?.tool, null);

  const native = rokanArtifact(
    run({ command: "rokan do 'search allbirds.com for wool runners'", rokan: { ms: 640, replayed: false }, tail: ['  4 results ⚙ native:allbirds.com:search_catalog,get_product   640ms'] }),
  );
  const n = native?.artifact.kind === 'rokan' ? native.artifact.card : null;
  assert.equal(n?.site, 'allbirds.com');
  assert.equal(n?.tool, 'search_catalog');
  assert.equal(n?.answer, '4 results');
  assert.equal(n?.question, 'search allbirds.com for wool runners');
});

test('rokan: a run with no trailer has no card, and an unmeasured one says so', () => {
  assert.equal(rokanArtifact(run({ tail: ['  something   10ms  ⚡'] })), null);
  const d = rokanArtifact(run({ command: null, ms: null, exit_code: null, measured: false, rokan: { ms: 5, replayed: false }, tail: [] }));
  const c = d?.artifact.kind === 'rokan' ? d.artifact.card : null;
  assert.equal(c?.totalMs, null);
  assert.equal(c?.question, null);
  assert.equal(c?.answer, null);
  assert.equal(c?.command, null);
});

/* ----------------------------------------------------------------- misc */

test('an empty tail detects nothing, and detection is memoised per run', () => {
  assert.equal(detect([]), null);
  assert.equal(detect(['']), null);
  const r = run({ tail: ['{"a": 1}'] });
  const first = detectionFor(r);
  assert.equal(first?.artifact.kind, 'json');
  assert.equal(detectionFor(r), first); // same object: one parse per run, however often the feed renders
  assert.equal(detectionFor(run({ id: 'r2', tail: ['nothing structured here'] })), null);
});

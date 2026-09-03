#!/usr/bin/env node
/**
 * Headless WebMCP harness — drives any page's tools through Chrome's CDP `WebMCP` domain the
 * same way DevTools / the Inspector do. No consumer needed. Every timing printed is measured.
 *
 *   node evals/harness/webmcp-cdp.mjs <url> <steps.json> [--shot out.png] [--chrome <path>]
 *
 * steps.json = [
 *   {"list": true},                                  // tools seen so far (toolsAdded/toolsRemoved)
 *   {"invoke": "terminal_propose", "input": {"command": "ls"}},   // + "inputFrom": {"proposal_id": "<js expr>"} for dynamic values
 *   {"key": "Enter"},                                // raw key event — NO focusing (a human doesn't get that)
 *   {"focus": "[data-prompt]"},                      // explicit focus, only when the flow genuinely includes a click
 *   {"eval": "…", "equals": 3} | {"eval": "…", "matches": "regex"}
 *   {"shot": "docs/evidence/demo/01.png"}            // screenshot now (evidence per demo beat)
 *   {"eval": "document.title"},
 *   {"sleep": 500},
 *   {"expect": {"tool": "forged_status_of"}}         // fails the run if not registered by now
 * ]
 * The FIRST step may also carry {"allowErrors": true} — without it, any page exception or
 * console.error observed during the run fails the case.
 * Output: one JSON line per step with `ms`, plus a final summary line. Exit 1 on any failure.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? undefined : args[i + 1]; };
const [url, stepsPath] = args.filter((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
if (!url || !stepsPath) { console.error('usage: webmcp-cdp.mjs <url> <steps.json> [--shot out.png] [--chrome path]'); process.exit(2); }
const CHROME = flag('chrome') ?? process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const steps = JSON.parse(readFileSync(stepsPath, 'utf8'));
const caseName = basename(stepsPath).replace(/\.json$/, '');
// A real free port, not 9500 + random: two harnesses started in the same second used to collide on
// the debugging port and one of them attached to the other's browser.
const freePort = () => new Promise((resolve, reject) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  s.on('error', reject);
});
const port = await freePort();
// Profile dir under this run's root when run-all gives us one, so its cleanup can scope the reap to
// its own children instead of pkill-ing every webmcp-cdp Chrome on the machine (another agent's included).
const profileRoot = process.env.ROKAN_EVAL_CHROME_PROFILE_ROOT || tmpdir();
const profileDir = join(profileRoot, `webmcp-cdp-${port}`);
// ROKAN_EVAL_CHROME_FLAGS: extra Chrome switches, space-separated. Used by the gesture boot case
// to hand Chrome a fake camera (--use-fake-device-for-media-stream --use-fake-ui-for-media-stream)
// so the wasm→model→getUserMedia pipeline is provable headlessly, with no human in front of a lens.
const extraFlags = (process.env.ROKAN_EVAL_CHROME_FLAGS ?? '').split(' ').filter(Boolean);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, '--enable-features=WebMCP', '--no-first-run', ...extraFlags, 'about:blank'], { stdio: 'ignore' });
// Any uncaught throw past this point must still reap Chrome — a leaked headless browser per failed
// case is how the 767 MB RSS of 2026-08-28 happened.
const reap = () => { try { chrome.kill('SIGKILL'); } catch { /* gone */ } try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* gone */ } };
process.on('exit', reap);
process.on('uncaughtException', (e) => { console.error(e); reap(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); reap(); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { /* booting */ } }
if (!targets) { console.error('chrome did not start'); process.exit(1); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
// Bounded: an onopen that never fires (Chrome up, page target already gone) used to hang the case
// forever, and run-all's spawnSync had no timeout to end it.
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('CDP WebSocket did not open within 10 s')), 10000);
  ws.onopen = () => { clearTimeout(t); resolve(); };
  ws.onerror = (e) => { clearTimeout(t); reject(new Error(`CDP WebSocket error: ${e?.message ?? 'unknown'}`)); };
});
let id = 0; const pending = new Map();
/** Set by a `viewport` step; makes `shot` photograph the size the case actually asserted at. */
let viewport = null;
const tools = new Map(); const responded = []; const pageErrors = []; const asyncCalls = new Map(); const claimed = new Set();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? 'exception');
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  if (m.method === 'WebMCP.toolsAdded') for (const t of m.params.tools) tools.set(t.name, { ...t, addedAt: Date.now() });
  if (m.method === 'WebMCP.toolsRemoved') for (const n of m.params.toolNames ?? m.params.tools?.map((t) => t.name) ?? []) tools.delete(n);
  if (m.method === 'WebMCP.toolResponded') responded.push(m.params);
};
const SEND_TIMEOUT_MS = 15000;
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id;
  const timer = setTimeout(() => { if (pending.has(i)) { pending.delete(i); r({ error: { message: `timeout after ${SEND_TIMEOUT_MS} ms: ${method}` } }); } }, SEND_TIMEOUT_MS);
  pending.set(i, (m) => { clearTimeout(timer); r(m); });
  ws.send(JSON.stringify({ id: i, method, params }));
});
// A thrown expression is NOT a value: it used to come back as the exception's description — a
// truthy string — so a `waitFor` that threw passed instantly. Now it is `undefined`, which no
// `equals`/`matches`/`waitFor` accepts, and the description is kept for the step's output.
let lastEvalError = null;
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) {
    lastEvalError = r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text ?? 'exception';
    return undefined;
  }
  lastEvalError = null;
  return r.result?.result?.value ?? null;
};
await send('Page.enable'); await send('Runtime.enable'); await send('WebMCP.enable');
const nav = await send('Page.navigate', { url });
const frameId = nav.result.frameId;
await sleep(2000);

let failed = 0;
const out = (o) => console.log(JSON.stringify(o));
// On the first failure of a run, dump what the page knows (session, last status, pending proposal,
// screen tail, recent field notes) so a remote failure (judge sandbox) is diagnosable from the log.
const DIAG = "(() => { const r = window.__rokan; if (!r) return 'no test hooks'; const s = r.session(); return { state: s.state, mode: s.mode, host: s.host, hello: s.hello && { mode: s.hello.mode, shell: s.hello.shell, integration: s.hello.integration }, lastStatus: s.lastStatus, reconnects: s.reconnects, reconnectAt: s.reconnectAt, lastClose: r.lastClose ? r.lastClose() : null, sentTypes: r.sentTypes ? r.sentTypes() : null, share: s.share, pending: r.proposals.pending(), lineEmpty: !!document.querySelector('[data-ghost]'), screen: r.screen(8) ?? null, notes: r.fieldNotes().slice(-14) }; })()";
let diagDone = false;
const fail = async () => {
  failed++;
  if (!diagDone) {
    diagDone = true;
    try { out({ diag: await evalJs(DIAG) }); } catch (e) { out({ diag: `diag failed: ${e instanceof Error ? e.message : String(e)}` }); }
  }
};
for (const step of steps) {
  const t0 = performance.now();
  try {
    if (typeof step.shot === 'string') {
      // Per-beat screenshot (evidence for the demo dry-run); 1280 wide by default so every shot in
      // the committed set is comparable. A `viewport` step earlier in the case wins: without that,
      // a case that asserted at 390 px produced a 1280 px photograph of it, which is evidence of
      // the wrong thing (caught 2026-08-31 by the responsive case).
      if (!viewport) {
        await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      }
      await sleep(150);
      const r = await send('Page.captureScreenshot', { format: 'png' });
      // ROKAN_EVAL_SHOT_DIR redirects every shot's basename into one directory. run-all sets it for
      // non-judge runs so a `--bridge` pass can't overwrite the judge-sandbox evidence in docs/ (it did,
      // 2026-08-29: builder-mode shots landed on the committed beat*.png).
      // The basename is prefixed with the case name when redirected: two cases both shooting
      // `beat1-born.png` into one scratch dir silently overwrote each other.
      const shotDir = process.env.ROKAN_EVAL_SHOT_DIR;
      const file = shotDir ? `${shotDir}/${caseName}-${basename(step.shot)}` : step.shot;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      out({ step: 'shot', file, ms: Math.round(performance.now() - t0) });
    } else if (step.viewport) {
      viewport = step.viewport;
      // Drive the page at a real device size. Added 2026-08-31 so the responsive claim ("clean at
      // 390px") is asserted rather than eyeballed: `shot` already overrides device metrics, so
      // without this every screenshot and every measurement was taken at one width.
      const { width, height = 844, dpr = 2, mobile = width < 500 } = step.viewport;
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
      await sleep(step.settle ?? 350);
      out({ step: 'viewport', width, height, dpr, mobile, ms: Math.round(performance.now() - t0) });
    } else if (typeof step.query === 'string') {
      out({ step: 'query', query: step.query }); // consumed by run-all.mjs (page URL params)
    } else if (step.list) {
      out({ step: 'list', tools: [...tools.values()].map((t) => ({ name: t.name, annotations: t.annotations })), ms: Math.round(performance.now() - t0) });
    } else if (step.invoke) {
      const before = responded.length;
      const input = { ...(step.input ?? {}) };
      // inputFrom: {field: "<js expression>"} — resolve dynamic values (ids minted earlier in the run)
      for (const [k, expr] of Object.entries(step.inputFrom ?? {})) input[k] = await evalJs(expr);
      const inv = await send('WebMCP.invokeTool', { frameId, toolName: step.invoke, input });
      const budget = step.timeout ?? 5000;
      while (responded.length === before && !inv.error && performance.now() - t0 < budget) await sleep(20);
      const r = responded[before];
      // CDP_ERROR = the browser refused the call (e.g. the tool was unregistered); NO_RESPONSE = handler never answered
      const status = inv.error ? 'CDP_ERROR' : (r?.status ?? 'NO_RESPONSE');
      const output = r?.output ?? r?.exception?.description ?? inv.error?.message ?? null;
      let ok = status === (step.expectStatus ?? 'Completed');
      if (ok && step.outputMatches && !new RegExp(step.outputMatches).test(JSON.stringify(output))) ok = false;
      if (!ok) await fail();
      out({ step: 'invoke', tool: step.invoke, input, status, output, ...(step.outputMatches ? { outputMatches: step.outputMatches, ok } : {}), ms: Math.round(performance.now() - t0) });
    } else if (step.invokeAsync) {
      // Start a tool call and keep going — for tools that wait on the person (clinic_ask). The page
      // must be driven while the call is open; `awaitInvoke` collects it later.
      const input = { ...(step.input ?? {}) };
      for (const [k, expr] of Object.entries(step.inputFrom ?? {})) input[k] = await evalJs(expr);
      const before = responded.length;
      const p = send('WebMCP.invokeTool', { frameId, toolName: step.invokeAsync, input }).catch((error) => ({ error }));
      asyncCalls.set(step.as ?? step.invokeAsync, { p, before, t0: performance.now(), tool: step.invokeAsync, input });
      out({ step: 'invokeAsync', tool: step.invokeAsync, as: step.as ?? step.invokeAsync, input, ok: true });
    } else if (step.awaitInvoke) {
      const c = asyncCalls.get(step.awaitInvoke);
      if (!c) { out({ step: 'awaitInvoke', as: step.awaitInvoke, ok: false, error: 'no such call' }); await fail(); }
      else {
        const inv = await c.p;
        const budget = step.timeout ?? 5000;
        // Open calls answer in any order: take the first response after this call began that no
        // earlier awaitInvoke has claimed.
        let idx = c.before;
        while (claimed.has(idx)) idx++;
        while (responded.length <= idx && !inv.error && performance.now() - t0 < budget) await sleep(20);
        const r = responded[idx];
        if (r) claimed.add(idx);
        const status = inv.error ? 'CDP_ERROR' : (r?.status ?? 'NO_RESPONSE');
        const output = r?.output ?? r?.exception?.description ?? inv.error?.message ?? null;
        let ok = status === (step.expectStatus ?? 'Completed');
        if (ok && step.outputMatches && !new RegExp(step.outputMatches).test(JSON.stringify(output))) ok = false;
        if (!ok) await fail();
        asyncCalls.delete(step.awaitInvoke);
        out({ step: 'awaitInvoke', tool: c.tool, as: step.awaitInvoke, input: c.input, status, output, ...(step.outputMatches ? { outputMatches: step.outputMatches, ok } : {}), ms: Math.round(performance.now() - c.t0) });
      }
    } else if (step.focus) {
      // Explicit only. Harness rule: never arrange a precondition a human would not have.
      out({ step: 'focus', selector: step.focus, ok: await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(step.focus)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`) });
    } else if (typeof step.type === 'string') {
      // Type into the focused element (xterm's textarea when the terminal has focus). "\r" = Enter.
      // Real key events (keydown → keypress/input → keyup), the way a human types; never insertText.
      for (const ch of step.type) {
        if (ch === '\r') {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        } else {
          const upper = ch.toUpperCase();
          const code = /[a-z]/i.test(ch) ? `Key${upper}` : /[0-9]/.test(ch) ? `Digit${ch}` : ch === ' ' ? 'Space' : undefined;
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, code, text: ch, unmodifiedText: ch, windowsVirtualKeyCode: /[a-z0-9]/i.test(ch) ? upper.charCodeAt(0) : 0 });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code });
        }
      }
      out({ step: 'type', text: step.type, ms: Math.round(performance.now() - t0) });
    } else if (step.waitFor) {
      // Poll an expression until truthy (default 8 s). Measured wait printed.
      const budget = step.timeout ?? 8000;
      let v = null;
      while (performance.now() - t0 < budget) {
        v = await evalJs(step.waitFor);
        if (v) break;
        await sleep(50);
      }
      const ok = !!v;
      if (!ok) await fail();
      out({ step: 'waitFor', expr: step.waitFor, ok, value: v, ms: Math.round(performance.now() - t0) });
    } else if (step.key) {
      // `ctrl:true` sends a control chord (e.g. Ctrl-C). modifiers bit 2 = Ctrl in CDP; text is the
      // control byte so xterm forwards it to the PTY (Ctrl-C → \x03).
      const mod = step.ctrl ? 2 : 0;
      const ctrlText = step.ctrl && /^[a-z]$/i.test(step.key) ? String.fromCharCode(step.key.toUpperCase().charCodeAt(0) - 64) : undefined;
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, code: step.ctrl ? `Key${step.key.toUpperCase()}` : step.key, modifiers: mod, windowsVirtualKeyCode: step.key === 'Enter' ? 13 : step.key === 'Escape' ? 27 : step.ctrl ? step.key.toUpperCase().charCodeAt(0) : 0, ...(ctrlText ? { text: ctrlText, unmodifiedText: step.key } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: step.ctrl ? `Key${step.key.toUpperCase()}` : step.key, modifiers: mod });
      out({ step: 'key', key: step.key, ctrl: !!step.ctrl, ms: Math.round(performance.now() - t0) });
    } else if (step.eval) {
      const value = await evalJs(step.eval);
      // Echo at most 2 KB of the expression: an injected library (axe is 553 KB) turned one log
      // line into half a megabyte, and Node drops pending stdout on exit — the tail of the run,
      // summary included, silently vanished (found 2026-08-31 while gating a11y on step results).
      const exprEcho = step.eval.length > 2048 ? `${step.eval.slice(0, 2048)}… [+${step.eval.length - 2048} chars]` : step.eval;
      // A bare eval (no equals/matches) is a recorded measurement: it must at least produce a value.
      // Opus pass 3: a bare step whose value was null counted toward "0 failed" for a day.
      const recorded = !('equals' in step) && !('matches' in step);
      const ok = 'equals' in step ? JSON.stringify(value) === JSON.stringify(step.equals) : 'matches' in step ? new RegExp(step.matches).test(String(value)) : value !== null && value !== undefined && value !== false;
      if (!ok) await fail();
      out({ step: 'eval', expr: exprEcho, value, ...('equals' in step ? { equals: step.equals, ok } : {}), ...('matches' in step ? { matches: step.matches, ok } : {}), ...(recorded ? { recorded: true, ok } : {}), ms: Math.round(performance.now() - t0) });
    } else if (step.sleep) {
      await sleep(step.sleep);
      out({ step: 'sleep', ms: step.sleep });
    } else if (step.expect) {
      const ok = step.expect.tool ? tools.has(step.expect.tool) : step.expect.noTool ? !tools.has(step.expect.noTool) : false;
      if (!ok) await fail();
      out({ step: 'expect', expect: step.expect, ok, tools: [...tools.keys()] });
    } else if (step._doc) {
      // Case-file documentation: not executed, not counted (see `executed` below).
      out({ step: 'doc' });
    } else {
      // A step nothing above recognised — a typo like `waitfor` or `evel` used to run as a no-op
      // and count as a pass, making a mistyped assertion indistinguishable from a passing one
      // (adversarial review 2026-08-31, finding 6). Unknown means failed, loudly.
      out({ step: 'unknown', keys: Object.keys(step) });
      await fail();
    }
  } catch (e) {
    failed++;
    out({ step: 'error', error: String(e) });
  }
}
const shot = flag('shot');
if (shot) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1800, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(shot, Buffer.from(r.result.data, 'base64'));
}
// A page exception / console.error was reported in the summary and counted for nothing — a case
// could go green while the app threw. It now fails the case unless the case's FIRST step opts in
// with `"allowErrors": true` (with a comment saying which error and why).
// true = accept everything (last resort). An ARRAY of regex strings is the precise form: errors
// matching any pattern are filtered as known-benign (e.g. MediaPipe's INFO lines on console.error),
// and anything else still fails the case — the gate stays armed for real errors.
const allowSpec = steps[0]?.allowErrors;
const allowErrors = allowSpec === true;
const allowPatterns = Array.isArray(allowSpec) ? allowSpec.map((p) => new RegExp(p)) : [];
const realErrors = pageErrors.filter((e) => !allowPatterns.some((re) => re.test(e)));
if (realErrors.length && !allowErrors) {
  failed++;
  out({ step: 'pageErrors', ok: false, count: realErrors.length, errors: realErrors.slice(0, 5), hint: 'set "allowErrors": true (or an array of benign-error regexes) on the first step of this case to accept them' });
}
// `steps` counts what ran, not what the file contains: `_doc` entries are prose, and counting
// them padded every documented case's step total by one.
const executedSteps = steps.filter((s) => !s._doc).length;
out({ summary: { steps: executedSteps, failed, tools: [...tools.keys()], pageErrors: pageErrors.slice(0, 5), ...(allowErrors ? { allowErrors: true } : {}) } });
ws.close(); reap();
process.exit(failed ? 1 : 0);

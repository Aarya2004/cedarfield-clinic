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
 *   {"expect": {"tool": "forged_hn_top"}}            // fails the run if not registered by now
 * ]
 * Output: one JSON line per step with `ms`, plus a final summary line. Exit 1 on any failure.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? undefined : args[i + 1]; };
const [url, stepsPath] = args.filter((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--')));
if (!url || !stepsPath) { console.error('usage: webmcp-cdp.mjs <url> <steps.json> [--shot out.png] [--chrome path]'); process.exit(2); }
const CHROME = flag('chrome') ?? process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const steps = JSON.parse(readFileSync(stepsPath, 'utf8'));
const port = 9500 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/webmcp-cdp-${port}`, '--enable-features=WebMCP', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { await sleep(250); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { /* booting */ } }
if (!targets) { console.error('chrome did not start'); process.exit(1); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
const tools = new Map(); const responded = []; const pageErrors = [];
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
const evalJs = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? null; };
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
      // per-beat screenshot (evidence for the demo dry-run); full page at 1280 wide
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(150);
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(step.shot, Buffer.from(r.result.data, 'base64'));
      out({ step: 'shot', file: step.shot, ms: Math.round(performance.now() - t0) });
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
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, code: step.key, windowsVirtualKeyCode: step.key === 'Enter' ? 13 : step.key === 'Escape' ? 27 : 0 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: step.key });
      out({ step: 'key', key: step.key, ms: Math.round(performance.now() - t0) });
    } else if (step.eval) {
      const value = await evalJs(step.eval);
      // A bare eval (no equals/matches) is a recorded measurement: it must at least produce a value.
      // Opus pass 3: a bare step whose value was null counted toward "0 failed" for a day.
      const recorded = !('equals' in step) && !('matches' in step);
      const ok = 'equals' in step ? JSON.stringify(value) === JSON.stringify(step.equals) : 'matches' in step ? new RegExp(step.matches).test(String(value)) : value !== null && value !== undefined && value !== false;
      if (!ok) await fail();
      out({ step: 'eval', expr: step.eval, value, ...('equals' in step ? { equals: step.equals, ok } : {}), ...('matches' in step ? { matches: step.matches, ok } : {}), ...(recorded ? { recorded: true, ok } : {}), ms: Math.round(performance.now() - t0) });
    } else if (step.sleep) {
      await sleep(step.sleep);
      out({ step: 'sleep', ms: step.sleep });
    } else if (step.expect) {
      const ok = step.expect.tool ? tools.has(step.expect.tool) : step.expect.noTool ? !tools.has(step.expect.noTool) : false;
      if (!ok) await fail();
      out({ step: 'expect', expect: step.expect, ok, tools: [...tools.keys()] });
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
out({ summary: { steps: steps.length, failed, tools: [...tools.keys()], pageErrors: pageErrors.slice(0, 5) } });
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);

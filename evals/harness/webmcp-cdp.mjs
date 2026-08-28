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
const tools = new Map(); const responded = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
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
for (const step of steps) {
  const t0 = performance.now();
  try {
    if (step.list) {
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
      if (!ok) failed++;
      out({ step: 'invoke', tool: step.invoke, input, status, output, ...(step.outputMatches ? { outputMatches: step.outputMatches, ok } : {}), ms: Math.round(performance.now() - t0) });
    } else if (step.focus) {
      // Explicit only. Harness rule: never arrange a precondition a human would not have.
      out({ step: 'focus', selector: step.focus, ok: await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(step.focus)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`) });
    } else if (step.key) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, code: step.key, windowsVirtualKeyCode: step.key === 'Enter' ? 13 : step.key === 'Escape' ? 27 : 0 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: step.key });
      out({ step: 'key', key: step.key, ms: Math.round(performance.now() - t0) });
    } else if (step.eval) {
      const value = await evalJs(step.eval);
      const ok = 'equals' in step ? JSON.stringify(value) === JSON.stringify(step.equals) : 'matches' in step ? new RegExp(step.matches).test(String(value)) : true;
      if (!ok) failed++;
      out({ step: 'eval', expr: step.eval, value, ...('equals' in step ? { equals: step.equals, ok } : {}), ...('matches' in step ? { matches: step.matches, ok } : {}), ms: Math.round(performance.now() - t0) });
    } else if (step.sleep) {
      await sleep(step.sleep);
      out({ step: 'sleep', ms: step.sleep });
    } else if (step.expect) {
      const ok = step.expect.tool ? tools.has(step.expect.tool) : step.expect.noTool ? !tools.has(step.expect.noTool) : false;
      if (!ok) failed++;
      out({ step: 'expect', expect: step.expect, ok, tools: [...tools.keys()] });
    }
  } catch (e) {
    failed++;
    out({ step: 'error', error: String(e) });
  }
}
const shot = flag('shot');
if (shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(shot, Buffer.from(r.result.data, 'base64')); }
out({ summary: { steps: steps.length, failed, tools: [...tools.keys()] } });
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);

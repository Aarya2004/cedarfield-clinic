#!/usr/bin/env node
/**
 * Headless WebMCP harness — drives any page's tools through Chrome's CDP `WebMCP` domain the
 * same way DevTools / the Inspector do. No consumer needed. Every timing printed is measured.
 *
 *   node evals/harness/webmcp-cdp.mjs <url> <steps.json> [--shot out.png] [--chrome <path>]
 *
 * steps.json = [
 *   {"list": true},                                  // tools seen so far (toolsAdded/toolsRemoved)
 *   {"invoke": "terminal_propose", "input": {"command": "ls"}},
 *   {"key": "Enter"},                                // focus [data-prompt] (or section[tabindex]) then key
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
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
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
      await send('WebMCP.invokeTool', { frameId, toolName: step.invoke, input: step.input ?? {} });
      const budget = step.timeout ?? 5000;
      while (responded.length === before && performance.now() - t0 < budget) await sleep(20);
      const r = responded[before];
      out({ step: 'invoke', tool: step.invoke, input: step.input ?? {}, status: r?.status ?? 'NO_RESPONSE', output: r?.output ?? r?.exception?.description ?? null, ms: Math.round(performance.now() - t0) });
      if (!r || r.status !== (step.expectStatus ?? 'Completed')) failed++;
    } else if (step.key) {
      await evalJs("(document.querySelector('[data-prompt]') ?? document.querySelector('section[tabindex]') ?? document.body).focus()");
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: step.key, code: step.key, windowsVirtualKeyCode: step.key === 'Enter' ? 13 : step.key === 'Escape' ? 27 : 0 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: step.key });
      out({ step: 'key', key: step.key, ms: Math.round(performance.now() - t0) });
    } else if (step.eval) {
      out({ step: 'eval', expr: step.eval, value: await evalJs(step.eval), ms: Math.round(performance.now() - t0) });
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

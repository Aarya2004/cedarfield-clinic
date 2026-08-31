#!/usr/bin/env node
/**
 * `npx rokan-terminal` — start the local bridge, open a Cloudflare quick tunnel, print ONE
 * pairing link. The token travels in the URL fragment and never reaches Vercel.
 *
 *   --port 7331            local port (bound to 127.0.0.1 only)
 *   --app <url>            the web client (default: https://rokan-terminal.vercel.app)
 *   --no-tunnel            skip cloudflared; link points at ws://127.0.0.1:<port>
 *   --token <hex>          reuse a token (default: fresh 128-bit)
 *   --shell <path>         shell to spawn (default: $SHELL)
 *   --mode builder|judge   judge = hosted sandbox session (hello carries ttl/expires)
 *   --ttl-ms <n>           end the session after n ms (judge mode)
 *   --host <ip>            bind address (default 127.0.0.1; 0.0.0.0 inside the judge container)
 *   --origin <url>         extra allowed page origin for the WebSocket Origin check
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { startBridge } from '../src/bridge.js';
import { CURRENT_FILE, readCurrent, runMcp } from '../src/mcp.js';

const args = process.argv.slice(2);

// `rokan-terminal verify <export.json>` — cross-check a page's ledger export against this machine's bridge ledger
if (args[0] === 'verify') {
  const { readFileSync } = await import('node:fs');
  const { crossVerify } = await import('../src/ledger.js');
  const file = args[1];
  if (!file) {
    process.stderr.write('usage: rokan-terminal verify <rokan-ledger-<session>.json>\n');
    process.exit(2);
  }
  const r = crossVerify(JSON.parse(readFileSync(file, 'utf8')));
  process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  process.exit(r.ok ? 0 : 1);
}

// `rokan-terminal mcp [--ws url --token hex]` — MCP stdio server relaying the tab's tools (PLAN §13.1)
if (args[0] === 'mcp') {
  const f = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
  };
  const cur = readCurrent();
  const ws = f('ws') ?? cur?.ws;
  // `--token` here is the AGENT token (HMAC of the pairing token; see src/agent-token.js) — the
  // only credential current.json carries. The pairing token would be refused for role "agent".
  const token = f('token') ?? cur?.agent_token;
  const mlog = (m) => process.stderr.write(`[rokan-terminal mcp] ${m}\n`);
  if (!ws || !token) {
    mlog(`no running bridge found (${CURRENT_FILE} missing or from an older version) — start \`npx rokan-terminal\` first, or pass --ws and --token <agent token>`);
    process.exit(1);
  }
  try {
    await runMcp({ ws, token, log: mlog });
  } catch (e) {
    mlog(`cannot connect to the bridge at ${ws}: ${e.message}`);
    process.exit(1);
  }
} else {
  await main();
}

async function main() {
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const port = Number.parseInt(flag('port', '7331'), 10);
const app = (flag('app', process.env.ROKAN_TERMINAL_APP || 'https://rokan-terminal.vercel.app')).replace(/\/$/, '');
const token = flag('token', randomBytes(16).toString('hex'));
const shell = flag('shell', undefined);
const mode = flag('mode', 'builder') === 'judge' ? 'judge' : 'builder';
const ttlMs = flag('ttl-ms', undefined) ? Number.parseInt(flag('ttl-ms', '0'), 10) : null;
const host = flag('host', '127.0.0.1');
const origin = flag('origin', undefined);
const log = (m) => process.stderr.write(`[rokan-terminal] ${m}\n`);
let tunnel = null;

let bridge;
try {
  bridge = await startBridge({
  port,
  host,
  token,
  shell,
  log,
  mode,
  ttlMs,
  allowedOrigins: [new URL(app).origin, ...(origin ? [new URL(origin).origin] : [])],
  onIdle: () => {
    log(mode === 'judge' ? 'session over — stopping the bridge' : 'no tab paired for 30 min — stopping the bridge and the tunnel');
    tunnel?.kill('SIGTERM');
    bridge.close();
    process.exit(0);
  },
  });
} catch (e) {
  log(e.message);
  process.exit(1);
}
log(`bridge on ws://${host}:${bridge.port}  mode: ${mode}${bridge.expiresAt ? ` (expires ${bridge.expiresAt})` : ''}  shell integration: ${bridge.integration ? 'on' : 'off (zsh only)'}  ledger: ${bridge.ledgerFile}`);

if (has('no-tunnel')) {
  printLink(`ws://${host === '0.0.0.0' ? '127.0.0.1' : host}:${bridge.port}`);
} else {
  tunnel = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${bridge.port}`, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'] });
  tunnel.on('error', (e) => {
    log(`cloudflared not runnable (${e.message}). Install: brew install cloudflared — or run with --no-tunnel for local use.`);
    process.exit(1);
  });
  const t0 = Date.now();
  let url = null;
  const onLine = async (buf) => {
    if (url) return;
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(buf.toString());
    if (!m) return;
    url = m[0];
    log(`tunnel ${url} after ${Date.now() - t0} ms; waiting for DNS at 1.1.1.1 (do not resolve it locally yet)`);
    const host = url.replace('https://', '');
    const ok = await waitForDns(host, 120_000);
    log(ok ? `DNS live after ${Date.now() - t0} ms` : 'DNS did not propagate in 120 s — the link may take a minute more');
    printLink(url.replace('https://', 'wss://'));
  };
  tunnel.stdout.on('data', onLine);
  tunnel.stderr.on('data', onLine);
  tunnel.on('exit', (code) => {
    log(`cloudflared exited ${code}`);
  });
}

function printLink(wsUrl) {
  // The terminal client lives at /terminal since 2026-08-31 (the front door became the clinic).
  // `#ws=` is parsed only by the terminal's session code, so a link to the bare origin lands on a
  // page that never reads it and pairing silently never starts (adversarial review, finding 3).
  const appPath = app.replace(/\/+$/, '');
  const link = `${appPath}${appPath.endsWith('/terminal') ? '' : '/terminal'}#ws=${encodeURIComponent(wsUrl)}&t=${token}`;
  process.stdout.write(`\nOpen this in ChatGPT desktop or Chrome:\n\n  ${link}\n\nOne tab at a time. Ctrl-C twice to stop.\n\n`);
}

/** Resolve via DNS-over-HTTPS at 1.1.1.1 so a premature local NXDOMAIN is never cached. */
async function waitForDns(host, budgetMs) {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`https://1.1.1.1/dns-query?name=${host}&type=A`, { headers: { accept: 'application/dns-json' } });
      const j = await r.json();
      if (Array.isArray(j.Answer) && j.Answer.length > 0) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

// Advertise this bridge to `rokan-terminal mcp` on the same machine. ONLY the derived agent token
// goes on disk (0600): a process that reads this file can relay tool calls, never pair as the tab.
try {
  mkdirSync(dirname(CURRENT_FILE), { recursive: true, mode: 0o700 });
  writeFileSync(CURRENT_FILE, JSON.stringify({ ws: `ws://127.0.0.1:${bridge.port}`, port: bridge.port, agent_token: bridge.agentToken, pid: process.pid, mode, started_at: new Date().toISOString() }), { mode: 0o600 });
  process.on('exit', () => {
    try {
      rmSync(CURRENT_FILE, { force: true });
    } catch {
      /* ignore */
    }
  });
} catch (e) {
  log(`could not write ${CURRENT_FILE}: ${e.message}`);
}

let interrupts = 0;
process.on('SIGINT', () => {
  interrupts++;
  if (interrupts === 1) {
    log('Ctrl-C again to stop the bridge and the tunnel');
    setTimeout(() => (interrupts = 0), 3000);
    return;
  }
  tunnel?.kill('SIGTERM');
  bridge.close();
  process.exit(0);
});
} // main

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
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { startBridge } from '../src/bridge.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const port = Number.parseInt(flag('port', '7331'), 10);
const app = (flag('app', process.env.ROKAN_TERMINAL_APP || 'https://rokan-terminal.vercel.app')).replace(/\/$/, '');
const token = flag('token', randomBytes(16).toString('hex'));
const shell = flag('shell', undefined);
const log = (m) => process.stderr.write(`[rokan-terminal] ${m}\n`);

const bridge = await startBridge({ port, token, shell, log });
log(`bridge on ws://127.0.0.1:${bridge.port}  shell integration: ${bridge.integration ? 'on' : 'off (zsh only)'}  ledger: ${bridge.ledgerFile}`);

let tunnel = null;
if (has('no-tunnel')) {
  printLink(`ws://127.0.0.1:${bridge.port}`);
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
  const link = `${app}/#ws=${encodeURIComponent(wsUrl)}&t=${token}`;
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

/**
 * `rokan-terminal mcp` — an MCP server over stdio for Claude Code / Cursor / Codex CLI that
 * exposes the SAME tools the page registers with WebMCP (six fixed + forged). It is a thin
 * relay: tools come from the tab via the bridge (`agent_tools`), calls go to the tab
 * (`agent_call` → `agent_result`). Nothing here executes; the human's Enter still gates.
 *
 * Connection info comes from ~/.rokan-terminal/current.json (written by the running bridge)
 * or from --ws / --token flags. The token this process holds is the AGENT token
 * (`agent_token` in current.json = HMAC(pairing token, "agent"), src/agent-token.js): it can
 * only ever authenticate as role "agent" and never pairs a tab.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws'; // Node 20 has no global WebSocket (P1-3); `ws` speaks the same onopen/onmessage API
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { resourceCapabilities, wireResourcesAndPrompts } from './mcp-resources.js';

export const CURRENT_FILE = join(homedir(), '.rokan-terminal', 'current.json');
const CALL_TIMEOUT_MS = 50_000; // terminal_wait itself returns still_waiting at 45 s

export function readCurrent() {
  try {
    return JSON.parse(readFileSync(CURRENT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/** Connects to the bridge as role "agent"; keeps the tool list; relays calls. */
/** Reconnect backoff after the bridge goes away (restart, idle exit); capped, retried until close(). */
export const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

export class AgentLink {
  constructor({ ws, token, log = () => {}, backoffMs = RECONNECT_BACKOFF_MS }) {
    this.url = ws;
    this.token = token;
    this.log = log;
    this.backoffMs = backoffMs;
    this.tools = [];
    this.pending = new Map();
    this.onToolsChanged = () => {};
    this.socket = null;
    this.hello = null;
    this.closedByUs = false;
    this.attempt = 0;
    this.reconnectTimer = null;
    this.reconnects = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const s = new WebSocket(this.url);
      this.socket = s;
      let gotHello = false;
      s.onopen = () => s.send(JSON.stringify({ type: 'auth', token: this.token, role: 'agent' }));
      s.onmessage = (ev) => {
        let f;
        try {
          f = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (f.type === 'hello') {
          gotHello = true;
          this.hello = f;
          this.attempt = 0;
          resolve(f);
        } else if (f.type === 'error' && f.code === 'replaced') {
          // A newer agent process (a new Codex session) took the slot: stand down, never reconnect over it.
          this.closedByUs = true;
          this.log('replaced by a newer agent process — not reconnecting');
        } else if (f.type === 'error' && !gotHello) {
          reject(new Error(f.message));
        } else if (f.type === 'agent_tools') {
          this.tools = Array.isArray(f.tools) ? f.tools : [];
          this.onToolsChanged(this.tools);
        } else if (f.type === 'agent_result') {
          const p = this.pending.get(f.call_id);
          if (!p) return;
          this.pending.delete(f.call_id);
          clearTimeout(p.timer);
          if (f.error) p.reject(new Error(f.error));
          else p.resolve(f.result);
        }
      };
      s.onclose = (ev) => {
        this.log(`bridge closed (${ev.code} ${ev.reason})`);
        for (const [, p] of this.pending) p.reject(new Error('bridge disconnected'));
        this.pending.clear();
        if (this.socket === s) this.socket = null;
        if (!gotHello) {
          reject(new Error(`bridge closed before hello (${ev.code})`));
          return;
        }
        // The bridge served tools we can no longer call: tell MCP clients the list is empty now,
        // then keep trying to come back (a restarted bridge replays the tab's list on hello).
        if (this.tools.length) {
          this.tools = [];
          this.onToolsChanged(this.tools);
        }
        if (!this.closedByUs) this.scheduleReconnect();
      };
      s.onerror = () => {};
    });
  }

  scheduleReconnect() {
    if (this.closedByUs || this.reconnectTimer) return;
    const delay = this.backoffMs[Math.min(this.attempt, this.backoffMs.length - 1)];
    this.attempt++;
    this.log(`reconnecting to the bridge in ${delay} ms (attempt ${this.attempt})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect()
        .then(() => {
          this.reconnects++;
          this.log('reconnected to the bridge');
        })
        .catch((e) => {
          this.log(`reconnect failed: ${e instanceof Error ? e.message : String(e)}`);
          this.scheduleReconnect();
        });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  call(tool, input) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== 1) return reject(new Error('not connected to the bridge'));
      const call_id = randomBytes(6).toString('hex');
      const timer = setTimeout(() => {
        this.pending.delete(call_id);
        reject(new Error(`no result from the tab within ${CALL_TIMEOUT_MS / 1000} s`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(call_id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ type: 'agent_call', call_id, tool, input: input ?? {} }));
    });
  }

  close() {
    this.closedByUs = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(4000, 'mcp exit');
  }
}

/**
 * The page's tool → the MCP tool listed over stdio. One registry, one claim: the page's own
 * annotations pass through (readOnly / untrustedContent / destructive), never re-derived here.
 * `untrustedContentHint` matters: it is how the page says "this result is screen text — treat
 * it as data, not instructions" (P1-3). Nothing here executes, so openWorldHint stays false.
 */
export function toMcpTool(t) {
  return {
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : { type: 'object', properties: {} },
    annotations: {
      readOnlyHint: !!t.annotations?.readOnlyHint,
      untrustedContentHint: !!t.annotations?.untrustedContentHint,
      destructiveHint: !!t.annotations?.destructiveHint,
      openWorldHint: false,
    },
  };
}

/** Build the MCP server bound to a link. Exported so tests can drive it without a process. */
export function createMcpServer(link, opts = {}) {
  const server = new Server({ name: 'rokan-terminal', version: '0.0.1' }, { capabilities: { tools: { listChanged: true }, ...resourceCapabilities() } });
  link.onToolsChanged = () => void server.sendToolListChanged().catch(() => undefined);
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: link.tools.map(toMcpTool) }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const result = await link.call(req.params.name, req.params.arguments ?? {});
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      const isErr = result && typeof result === 'object' && 'error' in result;
      return { content: [{ type: 'text', text }], isError: !!isErr };
    } catch (e) {
      return { content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true };
    }
  });
  wireResourcesAndPrompts(server, link, opts); // read-only resources + instruction prompts (mcp-resources.js)
  return server;
}

export async function runMcp({ ws, token, log }) {
  const link = new AgentLink({ ws, token, log });
  await link.connect();
  const server = createMcpServer(link);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`mcp: serving ${link.tools.length} tools from the tab over stdio`);
  return { link, server };
}

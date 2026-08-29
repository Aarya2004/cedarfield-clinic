/**
 * MCP resources + prompts for `rokan-terminal mcp` (ticket #7, ALIGNMENT "BRIDGE PING: MCP relay
 * resources + prompts"). MCP-stdio surface only — Codex CLI / Claude Code / Cursor. The browser
 * WebMCP standard is tools-only; the page neither exposes nor claims resources or prompts.
 *
 * Constraints this file keeps:
 * - READ SURFACES ONLY. Nothing here can type, run, or queue a command. No new agent→tab frame
 *   kinds: `terminal://history` and `forge://tools` resolve by relaying through the EXISTING
 *   `agent_call` path to the page tools `terminal_history` / `forge_list`, so Share-screen gating
 *   and redaction ride along by construction. Whatever the page answers (including a
 *   `{shared:false}` refusal) is passed through verbatim — that refusal IS the honest content.
 * - `terminal://ledger` is bridge-owned truth read straight off disk: the rows are HMAC-chained and
 *   countersigned, so they are served as the raw bytes that were signed, never re-serialized.
 * - Prompts are pure instruction templates. They execute nothing and name the trust boundary.
 */
import { readFileSync } from 'node:fs';
import { LEDGER_FILE } from './ledger.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export const LEDGER_ROW_CAP = 500;

/** The one sentence every prompt has to carry. Repeated verbatim so no template can soften it. */
export const TRUST_BOUNDARY =
  'Trust boundary: nothing you do here executes. Every command is a proposal — it is ghost-typed ' +
  "into the human's terminal and only the human's Enter runs it — and a forge spec is registered " +
  'only after the human approves the Forge card. Never claim a command ran until a tool result says so.';

export const RESOURCES = [
  {
    uri: 'terminal://history',
    name: 'Terminal run history',
    description:
      'The last runs recorded at the agent boundary (command, exit code, ms, cwd, origin, redacted tail). ' +
      'Relayed live to the page tool terminal_history; returns {"shared":false,...} when Share screen is off.',
    mimeType: 'application/json',
  },
  {
    uri: 'forge://tools',
    name: 'Forged tools',
    description:
      'Every tool forged in this tab with its content hash, pin state and measured stats. ' +
      'Relayed live to the page tool forge_list.',
    mimeType: 'application/json',
  },
  {
    uri: 'terminal://ledger',
    name: 'Session ledger (HMAC-chained JSONL)',
    description:
      "The bridge's own append-only ledger for the session this MCP process is attached to, raw and " +
      `byte-identical to what was signed. Last ${LEDGER_ROW_CAP} rows.`,
    mimeType: 'application/x-ndjson',
  },
];

export const PROMPTS = [
  {
    name: 'debug-last-failure',
    description: 'Read the last failed run, explain it, and propose (never run) a fix.',
    arguments: [],
  },
  {
    name: 'forge-from-history',
    description: 'Turn a repeated sequence of recent runs into one forged tool the human approves.',
    arguments: [{ name: 'n', description: 'How many recent runs to consider (default 20).', required: false }],
  },
  {
    name: 'session-report',
    description: 'Summarise this session from the run history and the ledger — measured numbers only.',
    arguments: [],
  },
];

/** Merge into the Server's `capabilities` object; the low-level Server refuses handlers otherwise. */
export function resourceCapabilities() {
  return { resources: {}, prompts: {} };
}

/** Reads a tab-backed resource by relaying to a page tool over the existing agent_call path. */
async function relay(link, tool) {
  const result = await link.call(tool, {}); // rejects exactly as a tool call does today (no tab / no bridge)
  return typeof result === 'string' ? result : JSON.stringify(result);
}

/**
 * Rows of `session` from the ledger JSONL, byte-preserved. Each line is parsed only to read its
 * `session` field; the ORIGINAL line text is what gets served, because the signature covers those
 * exact bytes. Returns the last LEDGER_ROW_CAP rows with a leading `#` note when older rows were cut.
 */
export function readLedgerRows(file, session, cap = LEDGER_ROW_CAP) {
  if (!session) {
    return '# no bridge session yet — this resource is scoped to the session this MCP process is attached to\n';
  }
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return `# no ledger file at ${file} yet — nothing has been recorded for session ${session}\n`;
  }
  const mine = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // a torn last line during an append; never guess at its content
    }
    if (row && row.session === session) mine.push(line);
  }
  const total = mine.length;
  const kept = total > cap ? mine.slice(total - cap) : mine;
  const head = total > cap ? `# truncated: showing the last ${cap} of ${total} rows for session ${session}\n` : '';
  return head + kept.map((l) => l + '\n').join('');
}

/** The instruction templates. `args` are the raw GetPrompt arguments (strings), never executed. */
export function promptText(name, args = {}) {
  if (name === 'debug-last-failure') {
    return [
      'Debug the most recent failing command in this terminal session.',
      '',
      '1. Read the resource terminal://history (or call the tool terminal_history) and find the most',
      '   recent run whose exit_code is non-zero. If the page answers {"shared":false}, say so and stop —',
      '   the human has not shared the screen and you must not guess at what ran.',
      '2. Read its command, exit code and redacted tail. Secrets are already [redacted]; do not ask for them.',
      '3. Explain the failure in two sentences, in plain language.',
      '4. Offer ONE fix as a proposal: call terminal_propose with the exact command, then call',
      '   terminal_wait and report the real exit code it returns.',
      '',
      TRUST_BOUNDARY,
    ].join('\n');
  }
  if (name === 'forge-from-history') {
    const n = typeof args.n === 'string' || typeof args.n === 'number' ? String(args.n) : '20';
    return [
      `Look for a repeated sequence worth keeping in the last ${n} runs of this session.`,
      '',
      `1. Read the resource terminal://history (or call terminal_history with last_n=${n}).`,
      '2. Find a sequence of 2–5 commands the human ran more than once, or that clearly belong together.',
      '   Name the varying parts — those become the tool\'s parameters.',
      '3. Call forge_create with a short snake_case name, a one-line description that says what it does',
      '   and what it never does, and the steps with {{param}} placeholders.',
      '4. The Forge card opens for the human to edit and approve. Do not narrate it as done. After they',
      '   approve, forged_<name> is registered live and you can call it — each step still ghost-types.',
      '5. Read forge://tools (or call forge_list) to confirm the tool exists and report its content hash.',
      '',
      TRUST_BOUNDARY,
    ].join('\n');
  }
  if (name === 'session-report') {
    return [
      'Write a short, honest report of this terminal session.',
      '',
      '1. Read terminal://history for what ran: commands, exit codes, measured ms.',
      '2. Read terminal://ledger for the signed record of this session (one JSON row per line, HMAC-chained;',
      '   `rokan-terminal verify` cross-checks a page export against it).',
      '3. Read forge://tools for anything forged, with content hashes.',
      '4. Report only numbers those sources actually contain. No estimates, no rounding up, and say',
      '   plainly when the screen was not shared and you therefore cannot know.',
      '',
      TRUST_BOUNDARY,
    ].join('\n');
  }
  throw new Error(`unknown prompt: ${name}`);
}

/**
 * Wire the four handlers onto an existing low-level Server.
 * opts: { ledgerFile, session } — `session` may be a string or a getter; it defaults to the id the
 * bridge sent in the agent `hello` frame, so a reconnect to a restarted bridge re-scopes itself.
 */
export function wireResourcesAndPrompts(server, link, opts = {}) {
  const ledgerFile = opts.ledgerFile ?? LEDGER_FILE;
  const cap = opts.cap ?? LEDGER_ROW_CAP;
  const sessionOf = () => {
    const s = typeof opts.session === 'function' ? opts.session() : opts.session;
    return s ?? link?.hello?.session_id ?? null;
  };

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    const spec = RESOURCES.find((r) => r.uri === uri);
    if (!spec) throw new Error(`unknown resource: ${uri}`);
    let text;
    if (uri === 'terminal://history') text = await relay(link, 'terminal_history');
    else if (uri === 'forge://tools') text = await relay(link, 'forge_list');
    else text = readLedgerRows(ledgerFile, sessionOf(), cap);
    return { contents: [{ uri, mimeType: spec.mimeType, text }] };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const name = req.params.name;
    const spec = PROMPTS.find((p) => p.name === name);
    if (!spec) throw new Error(`unknown prompt: ${name}`);
    return {
      description: spec.description,
      messages: [{ role: 'user', content: { type: 'text', text: promptText(name, req.params.arguments ?? {}) } }],
    };
  });

  return server;
}

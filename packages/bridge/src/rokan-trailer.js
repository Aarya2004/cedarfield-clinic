/**
 * `rokan-do` result-line parser (PLAN §2 "rokan do output parsing"). The CLI prints a warm
 * success as exactly one line — `  <answer>   <elapsed>ms` — with `  ⚡` appended only when the
 * transport was a replay (no model call). Model-call counts are not printed, so the honest
 * reading is `{ ms, replayed }`: replayed ⇒ 0 model calls; otherwise unknown (null), never inferred.
 * Colour (dim timing, saffron bolt) is emitted on a TTY — our PTY is one — so ANSI is stripped first.
 */
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
// `  <answer>   <ms>ms[  ⚡][  ⚙ native:<site>:<tool>]` — the ⚡ (0 model calls) and the ⚙ native
// provenance are BOTH anchored at end of line, after the ms tail, so a spoofed glyph inside the
// answer text (which precedes the tail) is never read as provenance (reviewer guidance).
const LINE_RE = /^\s{2}\S.*?\s{3}(\d{1,7})ms(\s{2}⚡)?(\s{2}⚙ native:(\S.*?))?\s*$/;
export const ROKAN_OUT_MAX = 65536;
/** The command line that ran must BE rokan / rokan-do (env assignments or a path prefix allowed). */
export const ROKAN_CMD_RE = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:\S*\/)?(?:rokan|rokan-do)(?:\s|$)/;
// A chained command can print a fake `⚡` line that would be mis-attributed as a rokan replay
// (`rokan do x; echo '  spoof  1ms  ⚡'` — Fable P3). Only a single, un-chained rokan invocation is
// attributed. This conservatively also rejects a rokan arg that quotes one of these bytes — we would
// rather show no ⚡ than a spoofable one (honest numbers).
const ROKAN_CHAIN_RE = /[;&|\n`]|\$\(/;
export function isRokanCommand(cmd) {
  return typeof cmd === 'string' && ROKAN_CMD_RE.test(cmd) && !ROKAN_CHAIN_RE.test(cmd);
}

export function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '');
}

/**
 * Split a `native:<site>:<tool>` payload into { site, tool }. From the RIGHT: a
 * tool name carries no colon, but a host may (`localhost:8477`) — so the tool is
 * everything after the LAST colon and the site is the rest (reviewer guidance).
 * Returns null unless both are non-empty.
 */
function parseNative(payload) {
  const s = String(payload).trim();
  const i = s.lastIndexOf(':');
  if (i <= 0 || i === s.length - 1) return null;
  const site = s.slice(0, i).trim();
  const tool = s.slice(i + 1).trim();
  return site && tool ? { site, tool } : null;
}

/**
 * Last matching line wins (a task can print context lines after the answer).
 * Returns `{ ms, replayed, native? }` — `native` is display provenance
 * (`{ site, tool }`), never used as a daemon invocation key. `replayed` (⚡) means
 * 0 model calls, for a compiled OR a native replay.
 */
export function parseRokanTrailer(text) {
  const lines = stripAnsi(text).replace(/\r/g, '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = LINE_RE.exec(lines[i]);
    if (m) {
      const out = { ms: Number.parseInt(m[1], 10), replayed: !!m[2] };
      if (m[4]) {
        const native = parseNative(m[4]);
        if (native) out.native = native;
      }
      return out;
    }
  }
  return null;
}

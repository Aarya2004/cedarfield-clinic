/**
 * `rokan-do` result-line parser (PLAN §2 "rokan do output parsing"). The CLI prints a warm
 * success as exactly one line — `  <answer>   <elapsed>ms` — with `  ⚡` appended only when the
 * transport was a replay (no model call). Model-call counts are not printed, so the honest
 * reading is `{ ms, replayed }`: replayed ⇒ 0 model calls; otherwise unknown (null), never inferred.
 * Colour (dim timing, saffron bolt) is emitted on a TTY — our PTY is one — so ANSI is stripped first.
 */
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
const LINE_RE = /^\s{2}\S.*?\s{3}(\d{1,7})ms(\s{2}⚡)?\s*$/;
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

/** Last matching line wins (a task can print context lines after the answer). */
export function parseRokanTrailer(text) {
  const lines = stripAnsi(text).replace(/\r/g, '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = LINE_RE.exec(lines[i]);
    if (m) return { ms: Number.parseInt(m[1], 10), replayed: !!m[2] };
  }
  return null;
}

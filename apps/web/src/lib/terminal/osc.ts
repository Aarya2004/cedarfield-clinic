/**
 * Client-side detector for the bridge's shell-integration markers (OSC 133 A/C/D, OSC 7, and the
 * bridge's private OSC 7331;cmd;<base64> command line).
 * Same algorithm as `packages/bridge/src/shell-integration.js`; handles sequences split across
 * `data` frames. Used to reset the local line buffer on a new prompt and to know when the
 * command after an Enter has ended (its exit code arrives in the `status` frame).
 *
 * The `command` event (ticket #4) is additive: zsh's preexec prints 7331;cmd;<b64> immediately
 * before 133;C, so the run feed can name a command the human typed themselves. Consumers that
 * only care about prompt/start/end simply never match it.
 */
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

/** A command line may not be longer than this once decoded (the bridge caps it the same way). */
const COMMAND_MAX = 2000;

export type PromptEvent =
  | { kind: 'prompt' }
  | { kind: 'start' }
  | { kind: 'end'; code: number | null }
  | { kind: 'cwd'; cwd: string }
  | { kind: 'command'; command: string };

export class PromptDetector {
  private carry = '';

  feed(chunk: string): PromptEvent[] {
    const text = this.carry + chunk;
    const events: PromptEvent[] = [];
    let i = 0;
    for (;;) {
      const start = text.indexOf(ESC + ']', i);
      if (start === -1) break;
      const endBel = text.indexOf(BEL, start);
      const endSt = text.indexOf(ESC + '\\', start);
      let end = -1;
      let endLen = 0;
      if (endBel !== -1 && (endSt === -1 || endBel < endSt)) {
        end = endBel;
        endLen = 1;
      } else if (endSt !== -1) {
        end = endSt;
        endLen = 2;
      }
      if (end === -1) {
        this.carry = text.length - start < 8192 ? text.slice(start) : '';
        return events;
      }
      const ev = interpret(text.slice(start + 2, end));
      if (ev) events.push(ev);
      i = end + endLen;
    }
    this.carry = text.endsWith(ESC) ? ESC : '';
    return events;
  }
}

function interpret(body: string): PromptEvent | null {
  if (body.startsWith('133;')) {
    const parts = body.slice(4).split(';');
    if (parts[0] === 'A') return { kind: 'prompt' };
    if (parts[0] === 'C') return { kind: 'start' };
    if (parts[0] === 'D') {
      const code = Number.parseInt(parts[1] ?? '', 10);
      return { kind: 'end', code: Number.isFinite(code) ? code : null };
    }
    return null;
  }
  if (body.startsWith('7331;cmd;')) {
    // The bridge's shell rc emits `7331;cmd;<nonce>;<base64>` since 2026-08-29 (the nonce lets the bridge
    // drop forged markers); older rcs emit `7331;cmd;<base64>`. The payload is always the LAST field.
    const fields = body.slice(9).split(';');
    const command = decodeBase64Utf8(fields[fields.length - 1] ?? '');
    return command === null ? null : { kind: 'command', command: command.slice(0, COMMAND_MAX) };
  }
  if (body.startsWith('7;')) {
    const m = /^7;file:\/\/[^/]*(\/.*)$/.exec(body);
    if (m) {
      let cwd = m[1];
      try {
        cwd = decodeURIComponent(m[1]);
      } catch {
        /* raw path with a stray % */
      }
      return { kind: 'cwd', cwd };
    }
  }
  return null;
}

/** base64 → UTF-8, tolerating the garbage a half-written escape can leave behind. Never throws. */
function decodeBase64Utf8(b64: string): string | null {
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

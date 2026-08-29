/**
 * Shell integration: a throwaway ZDOTDIR whose rc files source the user's own, then emit
 * OSC 133 (A = prompt start, C = command start, D;<code> = command end), OSC 7 (cwd) and a
 * private OSC 7331;cmd;<base64> carrying the command line. The bridge parses these to report
 * honest `running / last_exit_code / last_command_ms / cwd` — no guessing from prompt text.
 *
 * zsh only. Other shells spawn without integration and status fields stay null.
 */
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, basename } from 'node:path';

const ESC = '';
const BEL = '';

export function shellName(shellPath) {
  return basename(shellPath);
}

/** Returns {env, integration:boolean}. */
export function prepareShellEnv(shellPath, baseEnv) {
  const shims = fileURLToPath(new URL('../shims', import.meta.url));
  // A sandboxed bridge can be spawned with a minimal PATH (measured in the judge container: exit 127
  // for `rokan do`); add the dirs rokan-do is installed into when they exist.
  const extra = ['/usr/local/python/bin', `${baseEnv.HOME || ''}/.local/bin`].filter((d) => d && existsSync(d));
  const env = { ...baseEnv, ROKAN_TERMINAL: '1', TERM: baseEnv.TERM || 'xterm-256color', COLORTERM: 'truecolor', PATH: [shims, ...extra, baseEnv.PATH || '/usr/local/bin:/usr/bin:/bin'].join(':') };
  if (shellName(shellPath) !== 'zsh') return { env, integration: false };
  const home = homedir();
  const dir = mkdtempSync(join(tmpdir(), 'rokan-zdotdir-'));
  const src = (file) => `[[ -f "${home}/${file}" ]] && source "${home}/${file}"\n`;
  writeFileSync(join(dir, '.zshenv'), `export ZDOTDIR_ORIG="${home}"\n` + src('.zshenv'));
  writeFileSync(join(dir, '.zprofile'), src('.zprofile'));
  writeFileSync(join(dir, '.zlogin'), src('.zlogin'));
  writeFileSync(
    join(dir, '.zshrc'),
    src('.zshrc') +
      [
        'autoload -Uz add-zsh-hook',
        '__rokan_precmd() {',
        '  local ec=$?',
        `  printf '${ESC}]7;file://%s%s${BEL}' "$HOST" "$PWD"`,
        `  printf '${ESC}]133;D;%d${BEL}' "$ec"`,
        `  printf '${ESC}]133;A${BEL}'`,
        '}',
        '__rokan_preexec() {',
        `  printf '${ESC}]7331;cmd;%s${BEL}' "$(printf %s "$1" | base64 | tr -d '\\n')"`,
        `  printf '${ESC}]133;C${BEL}'`,
        '}',
        'add-zsh-hook precmd __rokan_precmd',
        'add-zsh-hook preexec __rokan_preexec',
        '',
      ].join('\n'),
  );
  env.ZDOTDIR = dir;
  return { env, integration: true };
}

/** Remove the throwaway ZDOTDIR created by `prepareShellEnv` (one per bridge run). */
export function cleanupShellEnv(env) {
  const dir = env?.ZDOTDIR;
  if (dir && dir.includes('rokan-zdotdir-')) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

/**
 * Incremental OSC parser. Feed PTY chunks; get back events:
 *   {kind:"prompt"} | {kind:"start", command} | {kind:"end", code} | {kind:"cwd", cwd}
 * Handles sequences split across chunks. Never throws on garbage.
 */
export class OscParser {
  constructor() {
    this.carry = '';
    this.pendingCommand = null;
  }

  feed(chunk) {
    const text = this.carry + chunk;
    const events = [];
    let i = 0;
    let lastSafe = 0;
    while (true) {
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
        // Unterminated: keep from `start` for the next chunk unless absurdly long.
        if (text.length - start < 8192) this.carry = text.slice(start);
        else this.carry = '';
        return events;
      }
      const body = text.slice(start + 2, end);
      const ev = this.interpret(body);
      if (ev) events.push(ev);
      i = end + endLen;
      lastSafe = i;
    }
    // A chunk ending in a lone ESC may be the first byte of an OSC split at that boundary.
    this.carry = text.endsWith(ESC) ? ESC : '';
    void lastSafe;
    return events;
  }

  interpret(body) {
    if (body.startsWith('133;')) {
      const parts = body.slice(4).split(';');
      switch (parts[0]) {
        case 'A':
          return { kind: 'prompt' };
        case 'C': {
          const command = this.pendingCommand;
          this.pendingCommand = null;
          return { kind: 'start', command };
        }
        case 'D': {
          const code = Number.parseInt(parts[1] ?? '', 10);
          return { kind: 'end', code: Number.isFinite(code) ? code : null };
        }
        default:
          return null;
      }
    }
    if (body.startsWith('7331;cmd;')) {
      try {
        this.pendingCommand = Buffer.from(body.slice(9), 'base64').toString('utf8').slice(0, 2000);
      } catch {
        this.pendingCommand = null;
      }
      return null;
    }
    if (body.startsWith('7;')) {
      const m = /^7;file:\/\/[^/]*(\/.*)$/.exec(body);
      if (m) {
        let cwd = m[1];
        try {
          cwd = decodeURIComponent(m[1]);
        } catch {
          /* zsh emits $PWD raw; a stray % is not an escape (Fable review F2) */
        }
        return { kind: 'cwd', cwd };
      }
    }
    return null;
  }
}

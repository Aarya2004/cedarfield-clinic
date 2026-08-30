/**
 * Shell integration: a throwaway ZDOTDIR whose rc files source the user's own, then emit
 * OSC 133 (A = prompt start, C = command start, D;<code> = command end), OSC 7 (cwd) and a
 * private OSC 7331;cmd;<base64> carrying the command line. The bridge parses these to report
 * honest `running / last_exit_code / last_command_ms / cwd` — no guessing from prompt text.
 *
 * Marker forgery (review P1-4, 2026-08-29): any program that prints the marker bytes — `cat` of a
 * hostile file, a web page fetched by `rokan do` — used to mint a signed `executed` ledger row
 * for a command that never ran. Every marker our hooks emit now carries a per-session nonce
 * (`randomBytes(8)`, generated here, written only into the rc file as an unexported shell
 * variable so child processes never see it):
 *   ESC ] 133 ; A ; <nonce> BEL          ESC ] 133 ; C ; <nonce> BEL
 *   ESC ] 133 ; D ; <exit> ; <nonce> BEL  ESC ] 7331 ; cmd ; <nonce> ; <base64> BEL
 * `OscParser` built with that nonce drops any 133 / 7331 marker whose nonce field is absent or
 * wrong and counts it in `forged`. OSC 7 (cwd) is a standard sequence other tools emit too and
 * is not a claim that anything ran, so it stays un-nonced.
 *
 * zsh only. Other shells spawn without integration and status fields stay null.
 */
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';
import { join, basename } from 'node:path';

const ESC = '\x1b';
const BEL = '\x07';

export function shellName(shellPath) {
  return basename(shellPath);
}

/** Returns {env, integration:boolean, nonce:string|null}. */
export function prepareShellEnv(shellPath, baseEnv) {
  const shims = fileURLToPath(new URL('../shims', import.meta.url));
  // A sandboxed bridge can be spawned with a minimal PATH (measured in the judge container: exit 127
  // for `rokan do`); add the dirs rokan-do is installed into when they exist.
  const extra = ['/usr/local/python/bin', `${baseEnv.HOME || ''}/.local/bin`].filter((d) => d && existsSync(d));
  const env = { ...baseEnv, ROKAN_TERMINAL: '1', TERM: baseEnv.TERM || 'xterm-256color', COLORTERM: 'truecolor', PATH: [shims, ...extra, baseEnv.PATH || '/usr/local/bin:/usr/bin:/bin'].join(':') };
  if (shellName(shellPath) !== 'zsh') return { env, integration: false, nonce: null };
  const nonce = randomBytes(8).toString('hex');
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
        // shell variable, NOT exported: children of the shell cannot read it from their environment
        `typeset -g __rokan_nonce='${nonce}'`,
        '__rokan_precmd() {',
        '  local ec=$?',
        `  printf '${ESC}]7;file://%s%s${BEL}' "$HOST" "$PWD"`,
        `  printf '${ESC}]133;D;%d;%s${BEL}' "$ec" "$__rokan_nonce"`,
        `  printf '${ESC}]133;A;%s${BEL}' "$__rokan_nonce"`,
        '}',
        '__rokan_preexec() {',
        `  printf '${ESC}]7331;cmd;%s;%s${BEL}' "$__rokan_nonce" "$(printf %s "$1" | base64 | tr -d '\\n')"`,
        `  printf '${ESC}]133;C;%s${BEL}' "$__rokan_nonce"`,
        '}',
        'add-zsh-hook precmd __rokan_precmd',
        'add-zsh-hook preexec __rokan_preexec',
        '',
      ].join('\n'),
    { mode: 0o600 },
  );
  env.ZDOTDIR = dir;
  return { env, integration: true, nonce };
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
 *
 * With `nonce` set, a 133 / 7331 marker is honoured only when its nonce field equals it; every
 * other one is dropped and counted in `forged`. Without a nonce (no integration) they are all
 * accepted — the status fields are already documented as untrustworthy then.
 */
export class OscParser {
  constructor({ nonce = null } = {}) {
    this.carry = '';
    this.pendingCommand = null;
    this.nonce = nonce;
    this.forged = 0;
  }

  feed(chunk) {
    const text = this.carry + chunk;
    const events = [];
    let i = 0;
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
    }
    // A chunk ending in a lone ESC may be the first byte of an OSC split at that boundary.
    this.carry = text.endsWith(ESC) ? ESC : '';
    return events;
  }

  /** True when the marker's nonce field proves it came from our hooks (or no nonce is required). */
  genuine(field) {
    if (this.nonce === null) return true;
    if (field === this.nonce) return true;
    this.forged++;
    return false;
  }

  interpret(body) {
    if (body.startsWith('133;')) {
      const parts = body.slice(4).split(';');
      switch (parts[0]) {
        case 'A':
          return this.genuine(parts[1]) ? { kind: 'prompt' } : null;
        case 'C': {
          if (!this.genuine(parts[1])) return null;
          const command = this.pendingCommand;
          this.pendingCommand = null;
          return { kind: 'start', command };
        }
        case 'D': {
          if (!this.genuine(parts[2])) return null;
          const code = Number.parseInt(parts[1] ?? '', 10);
          return { kind: 'end', code: Number.isFinite(code) ? code : null };
        }
        default:
          return null;
      }
    }
    if (body.startsWith('7331;cmd;')) {
      const parts = body.slice(9).split(';');
      const [nonce, b64] = this.nonce === null && parts.length === 1 ? [null, parts[0]] : parts;
      if (!this.genuine(nonce)) return null;
      try {
        this.pendingCommand = Buffer.from(b64 ?? '', 'base64').toString('utf8').slice(0, 2000);
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

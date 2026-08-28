/**
 * Signed, expiring session ids (pure, unit-tested). `/ws/:sid` used to call `getSandbox()` for any
 * well-formed id — and the SDK starts a container on first fetch — so 10 random ids exhausted
 * `max_instances` with no Gate involved (Fable F4). A sid is now `<24 hex>.<exp seconds>.<16 hex>`
 * where the suffix is HMAC-SHA256(SID_SECRET, `<id>.<exp>`)[:16]; the Worker verifies signature and
 * expiry before any sandbox lookup, so a stale tab cannot restart a container after the TTL
 * (Fable pass-3 P2). Stateless.
 */
const enc = new TextEncoder();
export const SID_RE = /^([a-f0-9]{24})\.(\d{1,13})\.([a-f0-9]{16})$/;

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** `id` is the 24-hex sandbox name; `expiresAtMs` the session's end. Returns the signed sid. */
export async function issueSid(secret: string, id: string, expiresAtMs: number): Promise<string> {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('bad id');
  const exp = Math.floor(expiresAtMs / 1000);
  if (!Number.isFinite(exp) || exp <= 0) throw new Error('bad expiry');
  return `${id}.${exp}.${(await hmacHex(secret, `${id}.${exp}`)).slice(0, 16)}`;
}

/** Returns the sandbox id when the signature verifies and the sid has not expired, else null. */
export async function verifySid(secret: string, sid: string, nowMs: number): Promise<string | null> {
  const m = SID_RE.exec(sid);
  if (!m) return null;
  const expect = (await hmacHex(secret, `${m[1]}.${m[2]}`)).slice(0, 16);
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= expect.charCodeAt(i) ^ m[3].charCodeAt(i);
  if (diff !== 0) return null;
  return Number.parseInt(m[2], 10) * 1000 > nowMs ? m[1] : null;
}

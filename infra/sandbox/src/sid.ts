/**
 * Signed session ids (pure, unit-tested). `/ws/:sid` used to call `getSandbox()` for any well-formed
 * id — and the SDK starts a container on first fetch — so 10 random ids exhausted `max_instances`
 * with no Gate involved (Fable F4). A sid is now `<24 hex>.<16 hex>` where the suffix is
 * HMAC-SHA256(SID_SECRET, id)[:16]; the Worker verifies it before any sandbox lookup. Stateless.
 */
const enc = new TextEncoder();
export const SID_RE = /^([a-f0-9]{24})\.([a-f0-9]{16})$/;

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** `id` is the 24-hex sandbox name; returns the signed sid handed to the client. */
export async function issueSid(secret: string, id: string): Promise<string> {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('bad id');
  return `${id}.${(await hmacHex(secret, id)).slice(0, 16)}`;
}

/** Returns the sandbox id when the signature verifies, else null. Constant-time compare. */
export async function verifySid(secret: string, sid: string): Promise<string | null> {
  const m = SID_RE.exec(sid);
  if (!m) return null;
  const expect = (await hmacHex(secret, m[1])).slice(0, 16);
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= expect.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0 ? m[1] : null;
}

// Pair with a bridge (in a container) over ws, run a command, check honest status, wait for TTL.
const [wsUrl, token] = process.argv.slice(2);
const t0 = Date.now();
let ws;
for (let i = 0; i < 60; i++) {
  try {
    ws = await new Promise((resolve, reject) => {
      const s = new WebSocket(wsUrl);
      s.onopen = () => resolve(s);
      s.onerror = () => reject(new Error('connect'));
    });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ws) {
  console.log('FAIL bridge in image did not accept a socket in 30 s');
  process.exit(1);
}
const frames = [];
ws.onmessage = (e) => frames.push(JSON.parse(e.data));
const until = (pred, ms) => new Promise((resolve) => {
  const start = Date.now();
  const tick = () => {
    const f = frames.find(pred);
    if (f) return resolve(f);
    if (Date.now() - start > ms) return resolve(null);
    setTimeout(tick, 25);
  };
  tick();
});
ws.send(JSON.stringify({ type: 'auth', token, cols: 100, rows: 30 }));
const hello = await until((f) => f.type === 'hello', 10000);
const ok1 = hello?.mode === 'judge' && hello?.integration === true && typeof hello?.expires_at === 'string';
console.log(`${ok1 ? 'PASS' : 'FAIL'} hello from the image in ${Date.now() - t0} ms: ${JSON.stringify(hello)}`);
await until((f) => f.type === 'data' && f.data.includes(']133;A'), 10000);
ws.send(JSON.stringify({ type: 'input', data: 'whoami; id -u; echo probe_ok; false\r' }));
const st = await until((f) => f.type === 'status' && f.last_command === 'whoami; id -u; echo probe_ok; false' && f.running === false, 10000);
const out = frames.filter((f) => f.type === 'data').map((f) => f.data).join('');
const ok2 = st?.last_exit_code === 1 && out.includes('judge') && out.includes('probe_ok') && /\r?\n1000\r?\n/.test(out);
console.log(`${ok2 ? 'PASS' : 'FAIL'} command ran as uid 1000 'judge' with honest exit 1: ${JSON.stringify(st)}`);
ws.send(JSON.stringify({ type: 'input', data: 'curl -sS -m 5 https://example.org -o /dev/null -w "%{http_code}"; echo; curl -sS -m 5 https://evil.example -o /dev/null -w "%{http_code}" || echo blocked\r' }));
await new Promise((r) => setTimeout(r, 7000));
const out2 = frames.filter((f) => f.type === 'data').map((f) => f.data).join('');
console.log(`INFO egress from a local docker run is NOT the Cloudflare allowlist (that is enforced by the Worker's Sandbox class); local output: ${out2.slice(-200).replace(/\s+/g, ' ')}`);
const ended = await until((f) => f.type === 'error' && f.code === 'timeout', 25000);
console.log(`${ended ? 'PASS' : 'FAIL'} TTL ended the session at ${Date.now() - t0} ms: ${JSON.stringify(ended)}`);
ws.close();
process.exit(ok1 && ok2 && ended ? 0 : 1);

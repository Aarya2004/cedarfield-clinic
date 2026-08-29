// Drift stand-in: one static product page whose price + DOM change between v1 and v2.
// The value lives in a file so we can "ship a site change" without restarting the server —
// exactly the event Rokan's recheck is built to catch. No framework; deterministic.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json'); // { version, price } — swapped between runs
const PORT = Number(process.env.DRIFT_PORT || 8099);

function page() {
  const { version, price } = JSON.parse(readFileSync(STATE, 'utf8'));
  // v1: price sits in <span class="price">. v2: the site was "redesigned" — the old
  // .price node now holds shipping copy, and the real price moved to [data-amount].
  // A selector/regex captured on v1 keeps matching .price and now reads the WRONG value.
  if (version === 1) {
    return `<!doctype html><meta charset=utf8><title>Wander Boot</title>
<main><h1>Wander Boot</h1><span class="price">$${price}</span></main>`;
  }
  return `<!doctype html><meta charset=utf8><title>Wander Boot</title>
<main><h1>Wander Boot</h1>
<span class="price">$75 shipping</span>
<span data-amount="1">$${price}</span></main>`;
}

createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page());
}).listen(PORT, () => console.error(`drift server on :${PORT}`));

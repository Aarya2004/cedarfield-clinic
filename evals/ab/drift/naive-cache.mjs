// The contrast arm: what a vanilla agent's *cached script* does on drift.
// A coding agent, asked the same question twice, will often reuse the scrape it
// wrote the first time (the whole point of caching a workflow). That script pins
// a selector/regex to v1's DOM. When the site changes, the script keeps running —
// and silently returns whatever the old selector now grabs. No refusal, no flag.
//
//   node naive-cache.mjs capture   # run against v1, save the brittle recipe
//   node naive-cache.mjs replay    # run against current page, apply the saved recipe
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RECIPE = join(HERE, 'naive-recipe.json');
const PORT = Number(process.env.DRIFT_PORT || 8099);
const mode = process.argv[2];

async function html() {
  // 127.0.0.1, not localhost: the server binds v4 only, and a `localhost` that resolves to ::1
  // first fails the fetch on some setups.
  const r = await fetch(`http://127.0.0.1:${PORT}/`);
  return r.text();
}

// The recipe the agent "learned" on v1: grab the first .price span's dollar amount.
const RE = /class="price">\$?([0-9.,]+)/;

if (mode === 'capture') {
  const doc = await html();
  const m = doc.match(RE);
  const recipe = { selector: 'span.price', regex: RE.source, learned: m ? m[1] : null };
  writeFileSync(RECIPE, JSON.stringify(recipe));
  console.log(JSON.stringify({ mode, answer: m ? `$${m[1]}` : null, verified: 'value read from live v1' }));
} else if (mode === 'replay') {
  const doc = await html();
  const recipe = JSON.parse(readFileSync(RECIPE, 'utf8'));
  const m = doc.match(new RegExp(recipe.regex));
  // The script has no idea the meaning changed. It reports a number with full confidence.
  // RE captures [0-9.,]+ by construction, so the old `m[1].match(/^[0-9.,]+$/)` guard was dead.
  console.log(JSON.stringify({
    mode, answer: m ? `$${m[1]}` : recipe.learned && `$${recipe.learned}`,
    refused: false, note: 'no verification step — returns whatever the v1 selector now matches',
  }));
} else {
  console.error('usage: naive-cache.mjs capture|replay'); process.exit(2);
}

/**
 * Step-1 probe for the Workbench decision (2026-08-30): can a consumer (ChatGPT desktop / Chrome) execute a
 * CROSS-SITE workflow when our page only hands it one instruction at a time? The page registers exactly one
 * WebMCP tool, `next_step`. It never calls another site itself — the spec makes cross-origin tools opt-in
 * (exposedTo / getTools({fromOrigins})), so the agent must navigate, call the remote site's OWN tool, come
 * back and call `next_step` again. Served by the judge Worker so no web deploy is needed for the probe.
 */
export const PROBE_HTML = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rokan probe — next_step</title>
<style>body{font:15px/1.5 -apple-system,Segoe UI,sans-serif;max-width:52rem;margin:3rem auto;padding:0 1rem;color:#18181b;background:#fafaf6}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}pre{background:#fff;border:1px solid #e4e4e7;padding:.75rem;border-radius:6px;white-space:pre-wrap}</style>
<h1>Rokan cross-site probe</h1>
<p>This page registers <strong>one</strong> WebMCP tool, <code>next_step</code>. It returns one instruction at a time for a two-site workflow. Ask your agent:</p>
<pre>Run the workflow on this page: call next_step, do exactly what it says (it will send you to other sites and back), and keep calling next_step until it says DONE. Then tell me both results.</pre>
<p id="status"></p>
<h2>Log (this browser)</h2>
<pre id="log"></pre>
<script>
const HERE = location.href.split('#')[0];
const STEPS = [
  { site: 'https://www.allbirds.com', instruction:
    'STEP 1 of 2. Navigate to https://www.allbirds.com in this same tab. On THAT page, call its own WebMCP tool named search_catalog with input {"catalog":{"query":"wool runners"}}. Note the first product name and price it returns. Then navigate back to ' + HERE + ' and call next_step again with {"done":[{"step":1,"result":"<first product name and price>"}]}.' },
  { site: 'https://www.brooklinen.com', instruction:
    'STEP 2 of 2. Navigate to https://www.brooklinen.com in this same tab. On THAT page, call its own WebMCP tool search_catalog with {"catalog":{"query":"linen sheets"}} (it is a different store with its own tools). Note the first product name and price. Then navigate back to ' + HERE + ' and call next_step with {"done":[{"step":1,"result":"..."},{"step":2,"result":"<first product name + price>"}]}.' },
];
function log(m){ const t=new Date().toISOString().slice(11,19); const el=document.getElementById('log'); el.textContent += t+' '+m+'\\n'; try{ localStorage.setItem('probe-log', el.textContent) }catch{} }
try { document.getElementById('log').textContent = localStorage.getItem('probe-log') || ''; } catch {}
const mc = document.modelContext || navigator.modelContext;
document.getElementById('status').textContent = mc ? 'document.modelContext present — registering next_step…' : 'neither document.modelContext nor navigator.modelContext is present in this browser (no WebMCP consumer).';
if (mc) {
  mc.registerTool({
    name: 'next_step',
    title: 'Next step of the two-site workflow',
    description: 'Returns the next instruction of a two-site workflow. Call with no input first. Each instruction sends you to ANOTHER site to call that site\\'s own WebMCP tool; then come back to this page and call next_step again with what you did in "done". Ends with DONE.',
    inputSchema: { type: 'object', properties: { done: { type: 'array', description: 'steps completed so far', items: { type: 'object', properties: { step: { type: 'integer' }, result: { type: 'string' } } } } } },
    annotations: { readOnlyHint: true },
    async execute(input) {
      const done = (input && Array.isArray(input.done)) ? input.done : [];
      log('next_step called; done=' + JSON.stringify(done));
      if (done.length >= STEPS.length) { log('→ DONE'); return { status: 'DONE', message: 'Workflow complete. Report both results to the user.', done }; }
      const s = STEPS[done.length];
      log('→ step ' + (done.length + 1) + ' → ' + s.site);
      return { status: 'CONTINUE', step: done.length + 1, of: STEPS.length, site: s.site, instruction: s.instruction };
    },
  }).then(() => { log('registered next_step'); document.getElementById('status').textContent = 'Tool next_step is registered (' + STEPS.length + ' steps).'; }, (e) => { log('registerTool failed: ' + e); });
}
log('page loaded at ' + HERE);
</script>
`;

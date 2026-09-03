/**
 * Tools in the first snapshot (2026-09-03, Codex re-audit pass 2, P1: "WebMCP tool
 * clinic_list_drops is not available in this snapshot" on three fresh loads).
 *
 * The app registers its tools after React hydrates — hundreds of milliseconds after the HTML lands.
 * A client that snapshots the tool list the instant navigation completes sees nothing, and refuses
 * the agent's first call. So the twelve load-time tools are registered by an inline script in the
 * HTML itself, before any bundle runs: name, description, schema and annotations are exact copies of
 * the app's own definitions (`LOAD_TOOL_DESCRIPTORS`, derived from the same source), and `execute`
 * waits for the app, then hands the call to it. Tools therefore exist in the very first snapshot,
 * and a call made before the app is ready simply resolves when it is.
 *
 * The script is static (no request data), runs under the page's CSP nonce, and does nothing in a
 * browser without `modelContext` — the app then registers everything itself, as before.
 */
import { BASE_TOOL_NAMES, LISTEN_TOOL_NAMES, clinicToolDefs, type ClinicToolName } from './clinic-tools.ts';

export interface ToolDescriptor {
  name: ClinicToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint?: boolean };
}

/** The page-wide hand-off between the inline registration and the app. */
export interface BootstrapHandle {
  names: string[];
  execute: ((name: string, input: unknown, ctx?: { signal?: AbortSignal }) => Promise<unknown>) | null;
  ready: Promise<void>;
  resolve: () => void;
}

export const BOOTSTRAP_GLOBAL = '__cedarfieldTools';

/** The tools every visit has from the first byte: the base set and the listening set. */
export function loadToolDescriptors(): ToolDescriptor[] {
  const names: readonly ClinicToolName[] = [...BASE_TOOL_NAMES, ...LISTEN_TOOL_NAMES];
  const defs = clinicToolDefs(() => {
    throw new Error('bootstrap descriptors never read the view');
  });
  return names.map((name) => {
    const def = defs.find((d) => d.name === name);
    if (!def) throw new Error(`no definition for ${name}`);
    return { name: def.name, description: def.description, inputSchema: def.inputSchema, annotations: def.annotations };
  });
}

/** The inline script. Plain ES5 on purpose: it runs before any bundle, in any browser. */
export function bootstrapScript(descriptors: readonly ToolDescriptor[]): string {
  const json = JSON.stringify(descriptors).replace(/<\//g, '<\\/');
  return (
    '(function(){' +
    'var mc=document.modelContext||(typeof navigator!=="undefined"&&navigator.modelContext);' +
    'if(!mc||typeof mc.registerTool!=="function")return;' +
    `var B=window["${BOOTSTRAP_GLOBAL}"]={names:[],execute:null,ready:null,resolve:null};` +
    'B.ready=new Promise(function(r){B.resolve=r;});' +
    `var defs=${json};` +
    'var notReady={content:[{type:"text",text:JSON.stringify({ok:false,error:"page_not_ready",detail:"The page is still loading; call again in a moment."})}]};' +
    'for(var i=0;i<defs.length;i++){(function(d){' +
    'try{mc.registerTool({name:d.name,description:d.description,inputSchema:d.inputSchema,annotations:d.annotations,' +
    'execute:function(input,ctx){return B.ready.then(function(){return B.execute?B.execute(d.name,input,ctx):notReady;});}});' +
    'B.names.push(d.name);}catch(e){}' +
    '})(defs[i]);}' +
    '})();'
  );
}

/** The app's side: the handle the inline script left, if it ran and registered anything. */
export function bootstrapHandle(): BootstrapHandle | null {
  if (typeof window === 'undefined') return null;
  const h = (window as unknown as Record<string, unknown>)[BOOTSTRAP_GLOBAL] as BootstrapHandle | undefined;
  return h && Array.isArray(h.names) && h.names.length > 0 ? h : null;
}

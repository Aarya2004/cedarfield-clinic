'use client';

/**
 * MCP relay (page side). When paired, publish the current tool list to the bridge
 * (`agent_tools`) and answer relayed `agent_call` frames with `agent_result`, dispatching to
 * exactly the same tool code WebMCP uses. Republish only when a tool *definition* changes (a forged
 * tool born / evicted / restored) — never on ghost, Enter or ledger churn, which would spam
 * `listChanged` to every MCP client.
 */
import type { BridgeClient } from '@/lib/ws/client';
import { agentTools, callAgentTool } from '@/lib/webmcp/register';
import { forge } from '@/lib/webmcp/forge';
import { note } from '@/lib/webmcp/fieldnotes';

export function attachAgentRelay(client: BridgeClient): () => void {
  let lastKey: string | null = null;
  const publish = (force = false) => {
    if (!client.paired) return;
    const tools = agentTools();
    const key = JSON.stringify(tools.map((t) => [t.name, t.description, t.inputSchema, t.annotations]));
    if (!force && key === lastKey) return;
    lastKey = key;
    client.publishAgentTools(tools);
    note('agent_tools.published', { count: tools.length });
  };
  const offState = client.on('state', (s) => {
    if (s === 'paired') publish(true); // a (re)connected bridge always gets the current list
  });
  const offForge = forge.subscribe(() => publish());
  const offCall = client.on('agent_call', async ({ call_id, tool, input }) => {
    try {
      const result = await callAgentTool(tool, input);
      client.sendAgentResult(call_id, result);
    } catch (e) {
      client.sendAgentResult(call_id, undefined, e instanceof Error ? e.message : String(e));
    }
  });
  if (client.paired) publish(true);
  return () => {
    offState();
    offForge();
    offCall();
  };
}

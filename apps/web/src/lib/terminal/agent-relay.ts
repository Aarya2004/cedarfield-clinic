'use client';

/**
 * MCP relay (page side). When paired, publish the current tool list to the bridge
 * (`agent_tools`) and answer relayed `agent_call` frames with `agent_result`, dispatching to
 * exactly the same tool code WebMCP uses. Republish whenever a forged tool is born/evicted.
 */
import type { BridgeClient } from '@/lib/ws/client';
import { agentTools, callAgentTool } from '@/lib/webmcp/register';
import { forge } from '@/lib/webmcp/forge';
import { note } from '@/lib/webmcp/fieldnotes';

export function attachAgentRelay(client: BridgeClient): () => void {
  const publish = () => {
    if (!client.paired) return;
    const tools = agentTools();
    client.publishAgentTools(tools);
    note('agent_tools.published', { count: tools.length });
  };
  const offState = client.on('state', (s) => {
    if (s === 'paired') publish();
  });
  const offForge = forge.subscribe(publish);
  const offCall = client.on('agent_call', async ({ call_id, tool, input }) => {
    try {
      const result = await callAgentTool(tool, input);
      client.sendAgentResult(call_id, result);
    } catch (e) {
      client.sendAgentResult(call_id, undefined, e instanceof Error ? e.message : String(e));
    }
  });
  if (client.paired) publish();
  return () => {
    offState();
    offForge();
    offCall();
  };
}

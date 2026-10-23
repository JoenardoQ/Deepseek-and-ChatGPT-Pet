// Dependency-free MCP stdio transport: newline-delimited JSON-RPC, no stdout logs.
import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { postEvent as sendEvent, status, ensureBridge, shutdownBridge, updateHost } from './client.mjs';
import { base } from './runtime.mjs';
import { statePoses } from './state.mjs';
const hostId = process.env.PET_SESSION_ID || randomUUID();
const postEvent = (event, options) => sendEvent({ ...event, sessionId: hostId }, options);
const props = {
  state: { type: 'string', enum: Object.keys(statePoses) },
  message: {
    type: 'string',
    maxLength: 100,
    description: 'Optional short caption. Never copy private conversation text automatically.',
  },
  desktop: { type: 'boolean', description: 'Show the separate draggable desktop pet window.' },
};
const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const definitions = [
  {
    name: 'wake_pet',
    description: '唤起可拖拽桌宠，检查返回的 desktop 状态。',
    inputSchema: { type: 'object', properties: props, additionalProperties: false },
    annotations,
  },
  {
    name: 'set_pet_state',
    description: '更新已唤起的桌宠状态和简短台词。工作或思考状态 90 秒未更新会回到待机。',
    inputSchema: { type: 'object', properties: props, additionalProperties: false },
    annotations,
  },
  {
    name: 'hide_pet',
    description: '收起 ChatGPT 唤起的桌宠。若 DSH 仍在同步，它可以继续显示。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations,
  },
  {
    name: 'shutdown_pet',
    description: '完全关闭 ChatGPT 桌宠和本地桌宠服务。DSH 若仍在运行桌宠，可能重新连接；应同时从 DSH 关闭桌面显示。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations,
  },
  {
    name: 'pet_status',
    description: '只读查询本地桌宠和宿主连接，不会启动桌宠。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { ...annotations, readOnlyHint: true },
  },
];
async function callTool(name, args = {}) {
  if (!definitions.some((t) => t.name === name)) throw new Error('Unknown tool');
  if (!args || Array.isArray(args) || typeof args !== 'object') throw new Error('Invalid arguments');
  const allowed = ['wake_pet', 'set_pet_state'].includes(name) ? Object.keys(props) : [];
  if (Object.keys(args).some((k) => !allowed.includes(k))) throw new Error('Unknown argument');
  if (name === 'shutdown_pet') {
    const current = await status().catch(() => null);
    if (
      current &&
      ((current.connections || []).some((s) => s.sessionId !== hostId) || current.connectedSources?.includes('dsh'))
    )
      throw Error('还有其他连接正在使用桌宠，请使用 hide_pet 仅收起当前会话；完全退出请在本机操作。');
    return shutdownBridge();
  }
  if (name === 'pet_status') {
    try {
      return await status();
    } catch (e) {
      return { visible: false, bridge: 'unavailable', error: e.message };
    }
  }
  if (name === 'set_pet_state') {
    const s = await status();
    if (!s.visible) throw new Error('Call wake_pet first');
  }
  if (name === 'hide_pet') return postEvent({ source: 'chatgpt', action: 'hide' }, { autostart: false });
  const result = await postEvent({ ...args, source: 'chatgpt', action: name === 'wake_pet' ? 'wake' : 'update' });
  // Let the desktop report startup failures before describing the outcome.
  if (name === 'wake_pet') {
    await new Promise((r) => setTimeout(r, 1200));
    return status();
  }
  return result;
}
export async function dispatch(request) {
  const { id, method, params } = request;
  if (id === undefined) return null;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  if (request.jsonrpc !== '2.0' || typeof method !== 'string')
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
  if (method === 'initialize') {
    const versions = ['2024-11-05', '2025-03-26', '2025-06-18'];
    return reply({
      protocolVersion: versions.includes(params?.protocolVersion) ? params.protocolVersion : '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'desktop-pet', version: '2.0.0' },
    });
  }
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: definitions });
  if (method === 'tools/call') {
    try {
      const data = await callTool(params?.name, params?.arguments);
      return reply({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data });
    } catch (e) {
      return reply({ isError: true, content: [{ type: 'text', text: e.message }] });
    }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
}
if (process.argv[1]?.endsWith('mcp.mjs')) {
  let ending = false,
    heartbeat;
  const start =
    process.env.PET_AUTOSTART === '0'
      ? Promise.resolve()
      : (async () => {
          await ensureBridge();
          if (ending) return;
          const lease = await updateHost(hostId);
          if (!lease.enabled || ending) return;
          await postEvent({ source: 'chatgpt', action: 'wake', desktop: true });
          heartbeat = setInterval(() => {
            void updateHost(hostId).catch(() => {});
          }, 2500).unref();
        })().catch((error) => console.error('[dsh-pet startup]', error.message));
  const release = async () => {
    if (process.env.PET_AUTOSTART === '0') return;
    ending = true;
    clearInterval(heartbeat);
    await start;
    clearInterval(heartbeat);
    await updateHost(hostId, true).catch(() => {});
  };
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void release().finally(() => process.exit(0));
    });
  for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    try {
      if (line.length > 65536) throw new Error('Request too large');
      const response = await dispatch(JSON.parse(line));
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    } catch {
      process.stdout.write(
        JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n',
      );
    }
  }
  await release();
}

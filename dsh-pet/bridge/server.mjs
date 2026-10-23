/** Loopback coordinator: host leases, work events and paired scenes. */
import http from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, renameSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Duets } from './duets.mjs';
import { Sources, Controls } from './state.mjs';
import { HostLeases } from './plugin-lifetime.mjs';
import { DesktopProcess } from './desktop-process.mjs';
import { root, port, dataDir } from './runtime.mjs';
export function createBridge({ launch = true } = {}) {
  const sources = new Sources(),
    controls = new Controls(),
    hosts = new HostLeases();
  const desktop = new DesktopProcess({ launch });
  const roleIds = new Set(
    readdirSync(path.join(root, 'assets/pets')).filter((id) =>
      existsSync(path.join(root, 'assets/pets', id, 'pet.json')),
    ),
  );
  const duetFile = path.join(dataDir, 'duet.json');
  let mode = 'auto',
    shuttingDown = false,
    dshSeen = false;
  try {
    mode = JSON.parse(readFileSync(duetFile, 'utf8')).mode;
  } catch {}
  const duets = new Duets({
    mode,
    persist(value) {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(duetFile + '.tmp', JSON.stringify({ mode: value }));
      renameSync(duetFile + '.tmp', duetFile);
    },
  });
  function snapshot() {
    const control = controls.snapshot(),
      online = sources.connected();
    return {
      service: 'desktop-pet',
      version: 1,
      build: '2.0.0',
      pid: process.pid,
      shuttingDown,
      visible: control.visible || online.has('dsh'),
      control,
      connections: control.connections,
      connectedSources: [...online.keys()],
      characters: Object.fromEntries([...online].map(([id, p]) => [id, p.character])),
      desktop: desktop.snapshot(),
      duet: duets.snapshot(sources, control),
    };
  }
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || ''))
      return send(403, { error: 'Local Host required' });
    if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)
      return send(403, { error: 'Cross-origin denied' });
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/state') return send(200, snapshot());
      if (req.method === 'GET' && url.pathname === '/control') return send(200, controls.snapshot());
      if (req.method !== 'POST') return send(404, { error: 'Not found' });
      if (req.headers['x-pet-client'] !== '1') return send(403, { error: 'Client header required' });
      if (!['/host', '/duet', '/pet/close', '/presence', '/event', '/shutdown'].includes(url.pathname))
        return send(404, { error: 'Not found' });
      let raw = '',
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8192) return send(413, { error: 'Body too large' });
        raw += chunk;
      }
      const value = raw ? JSON.parse(raw) : {};
      if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('Expected object');
      if (url.pathname === '/shutdown') {
        shuttingDown = true;
        controls.sessions.clear();
        send(200, { stopping: true });
        void desktop.stop().finally(() => server.close());
        return;
      }
      if (url.pathname === '/host') {
        if (
          typeof value.id !== 'string' ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(value.id) ||
          (value.release !== undefined && typeof value.release !== 'boolean') ||
          Object.keys(value).some((k) => !['id', 'release'].includes(k))
        )
          throw Error('Invalid host lease');
        const enabled = hosts.update(value.id, value.release === true);
        if (value.release || !enabled) controls.release(value.id);
        else controls.heartbeat(value.id);
        return send(200, { enabled });
      }
      if (url.pathname === '/duet') {
        if (Object.keys(value).some((k) => k !== 'mode')) throw Error('Expected duet mode');
        duets.set(value.mode);
        return send(200, snapshot());
      }
      if (url.pathname === '/pet/close') {
        if (Object.keys(value).length) throw Error('Invalid close request');
        controls.sessions.clear();
        controls.revision++;
        sources.presence.delete('chatgpt');
        await desktop.stop();
        return send(200, snapshot());
      }
      if (url.pathname === '/presence') {
        if (
          !['dsh', 'chatgpt'].includes(value.source) ||
          !roleIds.has(value.character) ||
          typeof value.desktop !== 'boolean' ||
          typeof value.instanceId !== 'string' ||
          value.instanceId.length > 120 ||
          typeof value.build !== 'string' ||
          value.build.length > 40 ||
          (value.error !== null && typeof value.error !== 'string') ||
          (value.error?.length || 0) > 300 ||
          Object.keys(value).some(
            (k) => !['source', 'character', 'desktop', 'instanceId', 'build', 'error'].includes(k),
          )
        )
          throw Error('Invalid pet presence');
        sources.touch(value.source, value);
        if (value.source === 'dsh') dshSeen = true;
        return send(200, snapshot());
      }
      if (url.pathname === '/event') {
        controls.apply(value);
        if (!controls.snapshot().visible) {
          sources.presence.delete('chatgpt');
          await desktop.stop();
        } else desktop.start();
        return send(200, snapshot());
      }
    } catch (error) {
      send(400, { error: error.message });
    }
  });
  let cleaning = false;
  const timer = setInterval(async () => {
    if (cleaning) return;
    cleaning = true;
    try {
      const active = hosts.active();
      if (hosts.hadHost && !active) controls.clearSessions();
      const control = controls.snapshot(),
        dshActive = sources.connected().has('dsh');
      if (!control.visible) await desktop.stop();
      if ((hosts.hadHost || dshSeen) && !active && !control.visible && !dshActive && server.listening) server.close();
    } finally {
      cleaning = false;
    }
  }, 1000).unref();
  server.on('close', () => {
    clearInterval(timer);
    void desktop.stop();
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createBridge();
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1');
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

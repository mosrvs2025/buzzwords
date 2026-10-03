import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { aiEnabled, generateDeck } from './ai';
import { RoomManager } from './rooms';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');
const PORT = Number(process.env.PORT || 8787);
const dataFile = process.env.DATA_FILE ?? path.join(root, 'data', 'rooms.json');

const rooms = new RoomManager(dataFile || null);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage, limit = 10_000): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('too large');
    chunks.push(c);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

const aiHits = new Map<string, number[]>();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  try {
    if (url.pathname === '/api/rooms' && req.method === 'POST') return json(res, 200, { code: rooms.createRoom() });
    const m = url.pathname.match(/^\/api\/rooms\/([A-Za-z]{4})$/);
    if (m) return json(res, rooms.has(m[1]) ? 200 : 404, { exists: rooms.has(m[1]) });
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.rooms.size, ai: aiEnabled() });
    if (url.pathname === '/api/generate-deck' && req.method === 'POST') {
      if (!aiEnabled()) return json(res, 501, { error: 'AI decks aren’t switched on for this server yet.' });
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress);
      const now = Date.now();
      const hits = (aiHits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
      if (hits.length >= 8) return json(res, 429, { error: 'Easy there — try again in a few minutes.' });
      aiHits.set(ip, [...hits, now]);
      const { prompt } = await readBody(req);
      if (typeof prompt !== 'string' || prompt.trim().length < 3) return json(res, 400, { error: 'Tell me what the deck is about.' });
      try {
        return json(res, 200, await generateDeck(prompt));
      } catch (e) {
        console.error('[ai]', e);
        return json(res, 502, { error: e instanceof Error && e.message.length < 80 ? e.message : 'The deck machine jammed. Try again.' });
      }
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });

    // static client (production build); SPA fallback to index.html
    if (!fs.existsSync(dist)) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('Client not built. Run `npm run dev` and open the Vite URL, or `npm run build`.');
    }
    let file = path.join(dist, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    const ext = path.extname(file);
    const immutable = file.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'server error' });
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
wss.on('connection', (ws) => {
  (ws as any).alive = true;
  ws.on('pong', () => ((ws as any).alive = true));
  rooms.attach(ws);
});
// drop half-open sockets so "connected" dots stay honest
setInterval(() => {
  for (const ws of wss.clients) {
    if (!(ws as any).alive) ws.terminate();
    else {
      (ws as any).alive = false;
      ws.ping();
    }
  }
}, 15_000).unref();

server.listen(PORT, () => console.log(`Buzzwords server on http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    rooms.flush();
    process.exit(0);
  });
}

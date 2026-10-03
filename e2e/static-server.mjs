// Mimics a static host like Vercel: serves dist/, SPA fallback, and NO game server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const dist = path.resolve('dist');
const port = Number(process.env.PORT || 8898);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(404);
      return res.end('not found');
    }
    let f = path.join(dist, u.pathname);
    if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  })
  .listen(port, () => console.log('static on', port));

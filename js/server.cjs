const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp' };
http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    const etag = `"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    if (req.method === 'HEAD') { res.writeHead(200, { ...headers, 'Content-Length': stat.size }).end(); return; }
    fs.readFile(file, (readError, data) => {
      if (readError) { res.writeHead(500).end(); return; }
      res.writeHead(200, headers).end(data);
    });
  });
}).listen(+process.env.PORT || 4173, '127.0.0.1', () => console.log('CHPTR preview: http://127.0.0.1:' + (process.env.PORT || 4173)));

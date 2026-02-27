#!/usr/bin/env node
/**
 * Unified proxy server:
 * - /api/* → http://localhost:3000/api/v1/*   (backend REST)
 * - /realtime  → ws://localhost:3000/realtime  (Socket.IO)
 * - everything else → static files from dist/
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const net = require('net');

const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3000', 10);
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, 'apps/frontend/dist');
const PORT = parseInt(process.env.PROXY_PORT || '8080', 10);

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(STATIC_DIR, urlPath);

  // SPA fallback
  const tryFiles = [filePath, filePath + '.html', path.join(STATIC_DIR, 'index.html')];
  
  for (const f of tryFiles) {
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      const mime = MIME[ext] || 'application/octet-stream';
      // Never cache index.html — always serve fresh so new asset hashes load
      const cacheControl = (ext === '.html')
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheControl });
      fs.createReadStream(f).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end('Not found');
}

function proxyRequest(req, res) {
  // Rewrite /api/* → /api/v1/* only if not already /api/v1/
  const targetPath = req.url.replace(/^\/api(?!\/v1)/, '/api/v1');
  
  const options = {
    hostname: BACKEND_HOST,
    port: BACKEND_PORT,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[proxy] backend error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyRequest(req, res);
  } else if (req.url.startsWith('/realtime') || req.url.startsWith('/socket.io/') || req.url.startsWith('/socket.io?')) {
    // Socket.IO polling transport — proxy to backend as-is
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => { res.writeHead(502); res.end('Bad Gateway'); });
    req.pipe(proxyReq);
  } else {
    serveStatic(req, res);
  }
});

// WebSocket proxy for Socket.IO (/realtime namespace, engine on /socket.io)
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (!url.startsWith('/realtime') && !url.startsWith('/socket.io')) {
    socket.destroy();
    return;
  }
  const conn = net.createConnection(BACKEND_PORT, BACKEND_HOST, () => {
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    conn.write(`${req.method} ${url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head && head.length) conn.write(head);
    socket.pipe(conn);
    conn.pipe(socket);
  });
  conn.on('error', (err) => { console.error('[ws-proxy]', err.message); socket.destroy(); });
  socket.on('error', () => conn.destroy());
});

server.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
  console.log(`  /api/* → http://localhost:${BACKEND_PORT}/api/v1/*`);
  console.log(`  /realtime → ws://localhost:${BACKEND_PORT}/realtime (WS)`);
  console.log(`  static → ${STATIC_DIR}`);
});

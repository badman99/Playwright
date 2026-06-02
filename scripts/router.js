/**
 * Runner Local Router
 * 
 * Port 8080 pe sunta hai, path ke hisaab se route karta hai:
 *   /playwright/* → Playwright MCP   :3002
 *   /storage/*    → Static files     :3003  (screenshots, uploads)
 *   /puppeteer/*  → Future Puppeteer :3004
 *   /health       → Health check
 * 
 * Extensible: ROUTES mein naya entry daalo, kaam ho jaata hai!
 */

const http = require('http');
const https = require('https');

const ROUTER_PORT = 8080;

// ─── Route table ─────────────────────────────────────────────────
const ROUTES = {
  '/playwright':   { target: 'http://localhost:3002', stripPrefix: true },
  '/terminal':     { target: 'http://localhost:3004', stripPrefix: true },
  '/storage-dav':  { target: 'http://localhost:3005', stripPrefix: true },
};

// ─── Proxy helper ────────────────────────────────────────────────
function proxyRequest(req, res, target, newPath) {
  const targetUrl = new URL(target);
  const isHttps = targetUrl.protocol === 'https:';

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: newPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
    },
  };

  const lib = isHttps ? https : http;
  const proxyReq = lib.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Router] Proxy error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Service unavailable', detail: err.message }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

// ─── Server ──────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  // Health check
  if (reqPath === '/health' || reqPath === '/playwright/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
    return;
  }

  // Route matching
  for (const [prefix, config] of Object.entries(ROUTES)) {
    if (reqPath === prefix || reqPath.startsWith(prefix + '/')) {
      const newPath = config.stripPrefix
        ? (reqPath.slice(prefix.length) || '/')
        : reqPath;

      console.log(`[Router] ${req.method} ${reqPath} → ${config.target}${newPath}`);
      proxyRequest(req, res, config.target, newPath);
      return;
    }
  }

  // 404 with available routes info
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not found',
    availableRoutes: Object.keys(ROUTES),
  }));
});

server.listen(ROUTER_PORT, () => {
  console.log(`\n🚦 Router running on :${ROUTER_PORT}`);
  console.log('📍 Available routes:');
  for (const [prefix, config] of Object.entries(ROUTES)) {
    console.log(`   ${prefix} → ${config.target}`);
  }
  console.log('');
});

server.on('error', (err) => {
  console.error(`[Router] Server error: ${err.message}`);
  process.exit(1);
});

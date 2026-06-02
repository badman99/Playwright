/**
 * Playwright Runner Worker
 *
 * Endpoints:
 *   POST /register  — Runner apna tunnel URL register karta hai
 *   GET  /activate  — GitHub Actions workflow trigger karta hai
 *   GET  /status    — Runner alive check
 *   /*              — Sab kuch runner ko proxy karo
 *
 * SSE Fix:
 *   Supergateway /sse endpoint event mein bare path bhejta hai:
 *     data: /messages?sessionId=xxx
 *   Worker isko intercept karke service prefix add karta hai:
 *     data: /terminal/messages?sessionId=xxx
 *   Taaki client sahi service pe POST kare.
 */

const AUTH_HEADER = 'X-Auth-Token';

// Known MCP services jinke SSE streams ko rewrite karna hai
// Router inhe sahi port pe bhejta hai
const MCP_SERVICES = ['/playwright', '/terminal'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ─── CORS preflight ──────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE, PATCH, PUT',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // ─── /register ───────────────────────────────────────────────
    if (path === '/register' && request.method === 'POST') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'Invalid JSON' }, 400); }

      const { tunnelUrl } = body;
      if (!tunnelUrl) return json({ error: 'tunnelUrl required' }, 400);

      await env.KV.put('TUNNEL_URL', tunnelUrl);
      await env.KV.put('REGISTERED_AT', new Date().toISOString());
      return json({ ok: true, tunnelUrl });
    }

    // ─── /activate ───────────────────────────────────────────────
    if (path === '/activate') {
      if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

      const ghResponse = await fetch(
        `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GITHUB_PAT}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'playwright-runner-worker',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      return ghResponse.ok || ghResponse.status === 204
        ? json({ ok: true, message: '🚀 Workflow triggered!' })
        : json({ error: `GitHub API failed: ${await ghResponse.text()}` }, 500);
    }

    // ─── /status ─────────────────────────────────────────────────
    if (path === '/status') {
      const tunnelUrl = await env.KV.get('TUNNEL_URL');
      const registeredAt = await env.KV.get('REGISTERED_AT');
      if (!tunnelUrl) return json({ active: false, message: 'No runner registered' });

      try {
        const check = await fetch(`${tunnelUrl}/health`, { signal: AbortSignal.timeout(5000) });
        return json({ active: check.ok, tunnelUrl, registeredAt });
      } catch {
        return json({ active: false, tunnelUrl, registeredAt, message: 'Runner not responding' });
      }
    }

    // ─── /* Proxy ─────────────────────────────────────────────────
    const tunnelUrl = await env.KV.get('TUNNEL_URL');

    if (!tunnelUrl) {
      return new Response(offlinePage(env.AUTH_TOKEN), {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Proxy path as-is — router handles service routing
    const targetUrl = tunnelUrl + path + url.search;

    const isSSE = request.headers.get('Accept') === 'text/event-stream'
      || path.endsWith('/sse');

    // Service prefix detect karo (e.g. /terminal, /playwright)
    const servicePrefix = MCP_SERVICES.find(s => path.startsWith(s)) || null;

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set('Host', new URL(tunnelUrl).host);
    proxyHeaders.delete('Origin');
    proxyHeaders.delete('accept-encoding'); // compression disable for streaming

    try {
      const proxyReq = new Request(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        duplex: 'half',
      });

      const response = await fetch(proxyReq);

      const respHeaders = new Headers(response.headers);
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PATCH, PUT');
      respHeaders.set('Access-Control-Allow-Headers', '*');

      if (isSSE) {
        respHeaders.set('Content-Type', 'text/event-stream');
        respHeaders.set('Cache-Control', 'no-cache');
        respHeaders.set('Connection', 'keep-alive');
        respHeaders.delete('content-length');
      }

      // ── SSE endpoint rewrite ──────────────────────────────────
      // Problem: Supergateway/MCP servers send bare paths in endpoint events:
      //   event: endpoint
      //   data: /messages?sessionId=xxx
      //
      // Client will POST to WORKER_URL/messages — but router doesn't know
      // which service! Fix: rewrite to WORKER_URL/terminal/messages etc.
      if (isSSE && servicePrefix && response.body) {
        const rewrittenBody = rewriteSSEEndpoints(response.body, servicePrefix);
        return new Response(rewrittenBody, { status: response.status, headers: respHeaders });
      }

      return new Response(response.body, { status: response.status, headers: respHeaders });

    } catch (err) {
      console.error(`Proxy error [${path}]: ${err.message}`);
      return json({ error: 'Runner unreachable', detail: err.message, path }, 502);
    }
  },
};

// ─── SSE Stream Rewriter ──────────────────────────────────────────
// SSE data lines mein bare paths ko service-prefixed paths se replace karo
// e.g. "data: /messages?sid=x" → "data: /terminal/messages?sid=x"

function rewriteSSEEndpoints(body, servicePrefix) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';

  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // incomplete last line save karo

      const output = lines.map(line => {
        // "data: /path..." lines rewrite karo
        // Already prefixed lines skip karo
        if (line.startsWith('data: /') && !line.startsWith(`data: ${servicePrefix}`)) {
          return 'data: ' + servicePrefix + line.slice(6); // "data: ".length === 6
        }
        return line;
      }).join('\n') + '\n';

      controller.enqueue(encoder.encode(output));
    },
    flush(controller) {
      if (buffer) controller.enqueue(encoder.encode(buffer));
    },
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────

function checkAuth(request, env) {
  const token = request.headers.get(AUTH_HEADER)
    || new URL(request.url).searchParams.get('token');
  return token === env.AUTH_TOKEN;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function offlinePage(authToken) {
  return `<!DOCTYPE html>
  <html>
    <head><title>Runner Offline</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:50px">
      <h1>🔴 Runner is offline</h1>
      <p>GitHub Actions runner is not active right now.</p>
      <a href="/activate?token=${authToken}"
         style="background:#0066cc;color:white;padding:10px 20px;border-radius:5px;text-decoration:none">
        🚀 Start Runner
      </a>
    </body>
  </html>`;
}

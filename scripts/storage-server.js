/**
 * Storage Server — FTP jaisa HTTP file server
 * 
 * Endpoints:
 *   GET    /files                    → directory listing (JSON)
 *   GET    /files/path/to/file       → file download
 *   GET    /files/path/to/dir?zip=1  → folder zip download
 *   POST   /files/path/to/file       → file upload (multipart OR raw body)
 *   DELETE /files/path/to/file       → delete file/folder
 *   PATCH  /files/path/to/file       → rename/move  { "to": "new/path" }
 *   PUT    /mkdir/path/to/dir        → create directory
 *   GET    /search?q=filename        → search files recursively
 *   GET    /info/path/to/file        → file metadata
 */

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execSync } = require('child_process');
const { pipeline } = require('stream/promises');

const PORT = parseInt(process.env.STORAGE_PORT || '3003');
const ROOT = process.env.STORAGE_ROOT || '/tmp/storage';

// Ensure root exists
fs.mkdirSync(ROOT, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────

function safePath(reqPath) {
  const rel = decodeURIComponent(reqPath.replace(/^\/files\/?/, '').replace(/^\/mkdir\/?/, '').replace(/^\/info\/?/, ''));
  const abs = path.resolve(ROOT, rel);
  // Path traversal protection
  if (!abs.startsWith(ROOT)) throw new Error('Access denied');
  return abs;
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function error(res, msg, status = 400) {
  json(res, { error: msg }, status);
}

async function statInfo(filePath) {
  const stat = await fsp.stat(filePath);
  const name = path.basename(filePath);
  return {
    name,
    path: '/' + path.relative(ROOT, filePath),
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    modified: stat.mtime.toISOString(),
    created: stat.birthtime.toISOString(),
    ext: stat.isDirectory() ? null : path.extname(name).toLowerCase(),
  };
}

// Parse multipart/form-data — simple single-file parser (no deps!)
function parseMultipart(body, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];
  let start = body.indexOf(boundaryBuf) + boundaryBuf.length;

  while (start < body.length) {
    const end = body.indexOf(boundaryBuf, start);
    if (end === -1) break;
    const part = body.slice(start, end - 2); // strip \r\n before boundary
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = end + boundaryBuf.length; continue; }

    const headers = part.slice(0, headerEnd).toString();
    const content = part.slice(headerEnd + 4);

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    parts.push({
      name: nameMatch?.[1],
      filename: filenameMatch?.[1],
      content,
    });
    start = end + boundaryBuf.length;
  }
  return parts;
}

// Read full request body
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ─── Route handlers ───────────────────────────────────────────────

// GET /files/* — list or download
async function handleGet(req, res, urlPath, query) {
  const abs = safePath(urlPath);

  let stat;
  try { stat = await fsp.stat(abs); }
  catch { return error(res, 'Not found', 404); }

  // Directory listing
  if (stat.isDirectory()) {
    if (query.zip === '1') {
      // Zip download
      const zipName = path.basename(abs) + '.zip';
      const zipPath = `/tmp/${Date.now()}_${zipName}`;
      execSync(`cd "${abs}" && zip -r "${zipPath}" .`);
      const zipStat = await fsp.stat(zipPath);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': zipStat.size,
        'Access-Control-Allow-Origin': '*',
      });
      const stream = fs.createReadStream(zipPath);
      await pipeline(stream, res);
      await fsp.unlink(zipPath).catch(() => {});
      return;
    }

    const entries = await fsp.readdir(abs);
    const items = await Promise.all(
      entries.map(e => statInfo(path.join(abs, e)).catch(() => null))
    );
    return json(res, {
      path: '/' + path.relative(ROOT, abs),
      items: items.filter(Boolean),
      total: items.length,
    });
  }

  // File download
  const mimeTypes = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.json': 'application/json',
    '.txt': 'text/plain', '.md': 'text/markdown', '.html': 'text/html',
    '.css': 'text/css', '.js': 'application/javascript',
    '.zip': 'application/zip', '.gz': 'application/gzip',
    '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  };
  const ext = path.extname(abs).toLowerCase();
  const mime = mimeTypes[ext] || 'application/octet-stream';
  const inline = ['.png','.jpg','.jpeg','.gif','.webp','.svg','.pdf','.txt','.md','.html','.json'].includes(ext);

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${path.basename(abs)}"`,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
  });
  const stream = fs.createReadStream(abs);
  await pipeline(stream, res);
}

// POST /files/* — upload
async function handlePost(req, res, urlPath) {
  const abs = safePath(urlPath);
  const contentType = req.headers['content-type'] || '';
  const body = await readBody(req);

  // Ensure parent dir exists
  await fsp.mkdir(path.dirname(abs), { recursive: true });

  if (contentType.includes('multipart/form-data')) {
    const boundary = contentType.split('boundary=')[1]?.trim();
    if (!boundary) return error(res, 'Missing boundary');
    const parts = parseMultipart(body, boundary);
    const filePart = parts.find(p => p.filename);
    if (!filePart) return error(res, 'No file in request');
    const destPath = fs.statSync(abs).isDirectory?.()
      ? path.join(abs, filePart.filename)
      : abs;
    await fsp.writeFile(destPath, filePart.content);
    return json(res, { ok: true, path: '/' + path.relative(ROOT, destPath), size: filePart.content.length });
  }

  // Raw body upload
  await fsp.writeFile(abs, body);
  return json(res, { ok: true, path: '/' + path.relative(ROOT, abs), size: body.length });
}

// DELETE /files/* — delete
async function handleDelete(req, res, urlPath) {
  const abs = safePath(urlPath);
  try {
    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) {
      await fsp.rm(abs, { recursive: true, force: true });
    } else {
      await fsp.unlink(abs);
    }
    return json(res, { ok: true, deleted: '/' + path.relative(ROOT, abs) });
  } catch {
    return error(res, 'Not found', 404);
  }
}

// PATCH /files/* — rename/move { "to": "new/path" }
async function handlePatch(req, res, urlPath) {
  const abs = safePath(urlPath);
  const body = await readBody(req);
  let data;
  try { data = JSON.parse(body.toString()); }
  catch { return error(res, 'Invalid JSON'); }

  if (!data.to) return error(res, '"to" field required');
  const dest = safePath('/files/' + data.to);

  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.rename(abs, dest);
  return json(res, { ok: true, from: '/' + path.relative(ROOT, abs), to: '/' + path.relative(ROOT, dest) });
}

// PUT /mkdir/* — create directory
async function handleMkdir(req, res, urlPath) {
  const abs = safePath(urlPath);
  await fsp.mkdir(abs, { recursive: true });
  return json(res, { ok: true, created: '/' + path.relative(ROOT, abs) });
}

// GET /search?q=... — recursive search
async function handleSearch(req, res, query) {
  const q = query.q?.toLowerCase();
  if (!q) return error(res, 'q param required');

  const results = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e);
      if (e.toLowerCase().includes(q)) {
        results.push(await statInfo(full).catch(() => null));
      }
      const stat = await fsp.stat(full).catch(() => null);
      if (stat?.isDirectory()) await walk(full);
    }
  }
  await walk(ROOT);
  return json(res, { query: q, results: results.filter(Boolean), total: results.length });
}

// GET /info/* — file metadata
async function handleInfo(req, res, urlPath) {
  const abs = safePath(urlPath);
  try {
    return json(res, await statInfo(abs));
  } catch {
    return error(res, 'Not found', 404);
  }
}

// ─── Main server ──────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const parsed = new URL(req.url, 'http://localhost');
  const urlPath = parsed.pathname;
  const query = Object.fromEntries(parsed.searchParams);

  try {
    // Health check
    if (urlPath === '/health') {
      return json(res, { ok: true, root: ROOT, uptime: process.uptime() });
    }

    // Routes
    if (urlPath.startsWith('/files')) {
      if (req.method === 'GET')    return await handleGet(req, res, urlPath, query);
      if (req.method === 'POST')   return await handlePost(req, res, urlPath);
      if (req.method === 'DELETE') return await handleDelete(req, res, urlPath);
      if (req.method === 'PATCH')  return await handlePatch(req, res, urlPath);
    }

    if (urlPath.startsWith('/mkdir') && req.method === 'PUT') {
      return await handleMkdir(req, res, urlPath);
    }

    if (urlPath.startsWith('/search') && req.method === 'GET') {
      return await handleSearch(req, res, query);
    }

    if (urlPath.startsWith('/info') && req.method === 'GET') {
      return await handleInfo(req, res, urlPath);
    }

    error(res, 'Not found', 404);
  } catch (err) {
    console.error(`[Storage] Error: ${err.message}`);
    error(res, err.message, 500);
  }
});

server.listen(PORT, () => {
  console.log(`\n📁 Storage Server on :${PORT}`);
  console.log(`   Root: ${ROOT}`);
  console.log(`\n   GET    /files              → list root`);
  console.log(`   GET    /files/path/file    → download`);
  console.log(`   GET    /files/dir?zip=1   → zip folder`);
  console.log(`   POST   /files/path/file   → upload`);
  console.log(`   DELETE /files/path/file   → delete`);
  console.log(`   PATCH  /files/path/file   → rename/move`);
  console.log(`   PUT    /mkdir/path        → create dir`);
  console.log(`   GET    /search?q=name     → search\n`);
});

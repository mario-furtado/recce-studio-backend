import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, 'dist', 'recce-studio', 'browser');
const port = Number(process.env.PORT || 4200);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendEnv(response) {
  const apiBaseUrl = process.env.API_BASE_URL || process.env.FRONTEND_API_BASE_URL || '';
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`window.__RECCE_STUDIO_CONFIG__ = ${JSON.stringify({ apiBaseUrl })};`);
}

async function sendFile(response, path) {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) {
    throw new Error('Not a file');
  }

  response.writeHead(200, {
    'content-type': contentTypes[extname(path)] || 'application/octet-stream',
  });
  createReadStream(path).pipe(response);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/assets/env.js') {
      sendEnv(response);
      return;
    }

    const requestedPath = normalize(decodeURIComponent(url.pathname))
      .replace(/^[/\\]+/, '')
      .replace(/^(\.\.[/\\])+/, '');
    const filePath = join(root, requestedPath || 'index.html');
    const indexPath = join(root, 'index.html');
    const target = existsSync(filePath) ? filePath : indexPath;
    await sendFile(response, target);
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Recce Studio frontend is not available.');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Recce Studio frontend listening on ${port}`);
});

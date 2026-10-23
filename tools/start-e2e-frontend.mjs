import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const results = fileURLToPath(new URL('../.factory-results/e2e/', import.meta.url));
mkdirSync(results, { recursive: true });
const log = openSync(`${results}/frontend-build.log`, 'w');
const build = spawnSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'build'], {
  cwd: frontend, stdio: ['ignore', log, log], windowsHide: true,
});
if (build.error || build.status !== 0) {
  console.error(`[e2e:frontend] Build failed; see ${results}/frontend-build.log`);
  process.exit(1);
}
await import('../frontend/server.mjs');

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, openSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const results = join(root, '.factory-results', 'e2e');
mkdirSync(results, { recursive: true });
const classpath = join(results, 'classpath.txt');
const log = openSync(join(results, 'backend-compile.log'), 'w');
const compile = spawnSync(process.platform === 'win32' ? 'mvn.cmd' : 'mvn', [
  'compiler:compile', 'compiler:testCompile', 'dependency:build-classpath',
  '-DincludeScope=test', `-Dmdep.outputFile=${classpath}`,
], { cwd: root, stdio: ['ignore', log, log], shell: process.platform === 'win32', windowsHide: true });
if (compile.error || compile.status !== 0) {
  console.error(`[e2e:backend] Compilation failed; see ${results}/backend-compile.log`);
  process.exit(1);
}
const uploads = mkdtempSync(join(results, 'uploads-'));
const serverLog = openSync(join(results, 'backend-server.log'), 'w');
const child = spawn('java', [
  `-Drecce.e2e.uploads=${uploads}`, '-cp',
  [join(root, 'target', 'test-classes'), join(root, 'target', 'classes'), readFileSync(classpath, 'utf8').trim()].join(delimiter),
  'org.example.e2e.E2eServer',
], { cwd: root, stdio: ['ignore', serverLog, serverLog], windowsHide: true });
child.on('error', (error) => { console.error(error.message); process.exit(1); });
child.on('exit', (code) => {
  if (code !== 0) console.error(`[e2e:backend] Server exited; see ${results}/backend-server.log`);
  process.exit(code ?? 1);
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));

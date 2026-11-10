import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, closeSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// No default database, embedded credentials, server startup or automatic migration.
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (!['plan', 'backup', 'restore-check', 'apply', 'check-rollback'].includes(args[0])) {
  console.error('Usage: node tools/run-legacy-crew-migration.mjs plan|backup|restore-check|apply|check-rollback --...');
  process.exit(2);
}
const folder = join(root, '.factory-results', 'legacy-migration');
mkdirSync(folder, { recursive: true });
const cp = join(folder, 'classpath.txt');
const log = openSync(join(folder, 'compile.log'), 'w');
const compile = spawnSync(process.platform === 'win32' ? 'mvn.cmd' : 'mvn', [
  'compiler:compile', 'dependency:build-classpath', '-DincludeScope=runtime', `-Dmdep.outputFile=${cp}`,
], { cwd: root, stdio: ['ignore', log, log], windowsHide: true, shell: process.platform === 'win32' });
closeSync(log);
if (compile.status !== 0) { console.error('Compilation failed. See .factory-results/legacy-migration/compile.log.'); process.exit(1); }
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const run = spawnSync(java, ['-cp', `${join(root, 'target/classes')}${delimiter}${readFileSync(cp, 'utf8').trim()}`,
  'org.example.migration.LegacyCrewMigrationTool', ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
process.exit(run.status ?? 1);

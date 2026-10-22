import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const frontendRoot = join(root, 'frontend');
const gate = (process.argv[2] ?? '').toLowerCase();
const requested = (process.argv[3] ?? 'AUTO').toUpperCase();
const planOnly = process.argv.includes('--plan');
const validGates = new Set(['ticket', 'release']);
const validProfiles = new Set(['AUTO', 'FAST', 'STANDARD', 'DEEP']);

if (!validGates.has(gate) || !validProfiles.has(requested)) {
  console.error('Usage: node tools/run-quality-gate.mjs <ticket|release> <AUTO|FAST|STANDARD|DEEP> [--plan]');
  process.exit(2);
}

function gitLines(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function changedFiles() {
  const files = new Set([
    ...gitLines(['diff', '--name-only', '--diff-filter=ACMR']),
    ...gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ]);
  const base = process.env.QUALITY_BASE_SHA;
  if (base && !/^0+$/.test(base)) {
    gitLines(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]).forEach((file) => files.add(file));
  }
  return [...files].map((file) => file.replaceAll('\\', '/'));
}

function canonicalTicketSection() {
  const ticketId = (process.env.FACTORY_TICKET_ID ?? '').trim();
  if (!ticketId) return '';
  const trackerPath = join(root, 'docs', 'ai', 'ISSUES.md');
  const tracker = existsSync(trackerPath) ? readFileSync(trackerPath, 'utf8') : '';
  const escapedId = ticketId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escapedId}\\b[\\s\\S]*?(?=^##\\s+|(?![\\s\\S]))`, 'mi').exec(tracker)?.[0] ?? '';
}

function selectProfile(files) {
  if (requested !== 'AUTO') return { profile: requested, reason: 'explicit selection' };
  if (gate === 'release') return { profile: 'STANDARD', reason: 'default release integration gate' };

  const risk = (process.env.FACTORY_RISK ?? '').toLowerCase();
  if (risk === 'low') return { profile: 'FAST', reason: 'FACTORY_RISK=low' };
  if (['medium', 'high', 'critical'].includes(risk)) {
    return { profile: 'STANDARD', reason: `FACTORY_RISK=${risk}; focused sensitive checks remain mandatory` };
  }

  const ticketId = (process.env.FACTORY_TICKET_ID ?? '').trim();
  if (ticketId) {
    const section = canonicalTicketSection();
    const severity = /^- \*\*Severity:\*\*\s*(Critical|High|Medium|Low)\b/im.exec(section)?.[1]?.toLowerCase();
    if (severity === 'low') return { profile: 'FAST', reason: `${ticketId} severity low` };
    if (severity) return { profile: 'STANDARD', reason: `${ticketId} severity ${severity}` };
    console.log(`[factory:ticket] Ticket ${ticketId} has no readable severity; falling back to changed paths.`);
  }

  const infrastructureOnly = files.length > 0 && files.every((file) =>
    file === 'AGENTS.md'
      || file === '.gitignore'
      || file.startsWith('.agents/')
      || file.startsWith('.github/')
      || file.startsWith('docs/')
      || file.startsWith('tools/')
      || file === 'frontend/package.json',
  );
  if (infrastructureOnly) return { profile: 'FAST', reason: 'factory infrastructure/documentation-only change' };

  const sensitive = files.some((file) =>
    /(auth|security|permission|interceptor|repository|entity|migration|database|storage|offline)/i.test(file),
  );
  return {
    profile: 'STANDARD',
    reason: sensitive ? 'security, authorization, or persistence-sensitive path changed' : 'application code changed',
  };
}

function affectedAreas(files) {
  const ticket = canonicalTicketSection();
  const frontend = files.some((file) => file.startsWith('frontend/'))
    || Boolean((process.env.QUALITY_TARGET_SPECS ?? '').trim())
    || /\bfrontend\b|\bnpm\b|frontend\/src|src\/app/i.test(ticket);
  const backend = files.some((file) => file === 'pom.xml' || file.startsWith('src/'))
    || Boolean((process.env.FACTORY_MAVEN_TESTS ?? '').trim())
    || /\bbackend\b|\bmvn\b|src\/main|src\/test|Spring Boot/i.test(ticket);
  if (gate === 'release') return { frontend: true, backend: true, infrastructure: true };
  if (!frontend && !backend) return { frontend: false, backend: false, infrastructure: true };
  return { frontend, backend, infrastructure: true };
}

const files = changedFiles();
const selection = selectProfile(files);
const areas = affectedAreas(files);
const checks = [];

checks.push({ name: 'factory:config', command: process.execPath, args: [join(root, 'tools', 'validate-factory.mjs')], cwd: root });

if (areas.backend) {
  const selectedTests = (process.env.FACTORY_MAVEN_TESTS ?? '').trim();
  const testArgs = ['clean', 'compiler:compile', 'compiler:testCompile'];
  if (selectedTests) testArgs.push(`-Dtest=${selectedTests}`);
  testArgs.push('surefire:test');
  checks.push({ name: 'backend:test', command: process.platform === 'win32' ? 'mvn.cmd' : 'mvn', args: testArgs, cwd: root });
}

if (areas.frontend) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const frontendProfiles = {
    FAST: ['lint', 'typecheck', 'test:targeted'],
    STANDARD: ['lint', 'typecheck', 'test:targeted', 'test:integration', 'test:e2e', 'build'],
    DEEP: [
      'lint', 'typecheck', 'test:targeted', 'test:integration', 'test:e2e', 'build',
      'test:unit', 'audit:security', 'audit:accessibility', 'audit:resilience',
    ],
  };
  for (const script of frontendProfiles[selection.profile]) {
    checks.push({ name: `frontend:${script}`, command: npm, args: ['run', script], cwd: frontendRoot });
  }
}

if (gate === 'release' && selection.profile === 'DEEP') {
  checks.push({
    name: 'backend:package',
    command: process.platform === 'win32' ? 'mvn.cmd' : 'mvn',
    args: ['-DskipTests', 'package'],
    cwd: root,
  });
}

console.log(`[factory:${gate}] profile=${selection.profile} (${selection.reason})`);
console.log(`[factory:${gate}] scope=${areas.backend ? 'backend ' : ''}${areas.frontend ? 'frontend ' : ''}${areas.infrastructure ? 'factory' : ''}`.trim());
console.log(`[factory:${gate}] checks=${checks.map((check) => check.name).join(', ')}`);
if (gate === 'ticket' && /security|authorization|persistence|high|critical|AUD-SEC/i.test(selection.reason)) {
  console.log('[factory:ticket] Required: set FACTORY_MAVEN_TESTS or QUALITY_TARGET_SPECS for the affected trust boundary; generic gates are not a substitute.');
}
if (planOnly) process.exit(0);

const timestamp = new Date().toISOString().replaceAll(':', '-');
const resultRoot = join(root, '.factory-results');
const runRoot = join(resultRoot, `${timestamp}-${gate}-${selection.profile.toLowerCase()}`);
mkdirSync(runRoot, { recursive: true });
const results = [];

for (const check of checks) {
  const started = Date.now();
  console.log(`[factory:${gate}] RUN ${check.name}`);
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd,
    env: { ...process.env, CI: 'true' },
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    windowsHide: true,
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(check.command),
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const logPath = join(runRoot, `${check.name.replaceAll(':', '-')}.log`);
  writeFileSync(logPath, output, 'utf8');
  const exitCode = result.status ?? 1;
  results.push({
    check: check.name,
    exitCode,
    durationMs: Date.now() - started,
    log: relative(root, logPath).replaceAll('\\', '/'),
  });
  console.log(`[factory:${gate}] ${exitCode === 0 ? 'PASS' : 'FAIL'} ${check.name} (${results.at(-1).durationMs} ms)`);
  if (exitCode !== 0) {
    output.split(/\r?\n/).filter(Boolean).slice(-16).forEach((line) => console.error(line));
    if (gate === 'ticket') break;
  }
}

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  gate: gate.toUpperCase(),
  profile: selection.profile,
  reason: selection.reason,
  scope: areas,
  changedFiles: files,
  results,
};
const reportPath = join(resultRoot, `latest-${gate}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`[factory:${gate}] report=${relative(root, reportPath).replaceAll('\\', '/')}`);
process.exit(results.some((result) => result.exitCode !== 0) ? 1 : 0);

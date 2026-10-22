import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const frontendRoot = join(repositoryRoot, 'frontend');
const fallbackSpec = 'src/app/modules/core/services/recce-note-parser.service.spec.ts';

function gitLines(args) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
}

function siblingSpec(path) {
  if (!path.startsWith('frontend/')) {
    return null;
  }
  path = path.substring('frontend/'.length);
  if (path.endsWith('.spec.ts')) {
    return path;
  }
  if (path.endsWith('.component.html') || path.endsWith('.component.css')) {
    return path.replace(/\.component\.(?:html|css)$/, '.component.spec.ts');
  }
  if (path.endsWith('.ts')) {
    return path.replace(/\.ts$/, '.spec.ts');
  }
  return null;
}

const explicitSpecs = (process.env.QUALITY_TARGET_SPECS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const changedFiles = new Set([
  ...gitLines(['diff', '--name-only', '--diff-filter=ACMR']),
  ...gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
  ...gitLines(['ls-files', '--others', '--exclude-standard']),
]);

const baseSha = process.env.QUALITY_BASE_SHA;
if (baseSha && !/^0+$/.test(baseSha)) {
  gitLines(['diff', '--name-only', '--diff-filter=ACMR', `${baseSha}...HEAD`]).forEach((path) => changedFiles.add(path));
}

const discoveredSpecs = [...changedFiles]
  .map(siblingSpec)
  .filter((path) => path && existsSync(join(frontendRoot, path)));
const specs = [...new Set(explicitSpecs.length > 0 ? explicitSpecs : discoveredSpecs)];

if (specs.length === 0) {
  specs.push(fallbackSpec);
  console.log(`[quality:targeted] No directly affected spec found; using regression sentinel ${fallbackSpec}`);
} else {
  console.log(`[quality:targeted] Running ${specs.length} directly affected spec(s):`);
  specs.forEach((spec) => console.log(`- ${spec}`));
}

const angularCli = join(frontendRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
if (!existsSync(angularCli)) {
  console.error('[quality:targeted] Angular CLI is unavailable. Run npm ci before this gate.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [angularCli, 'test', '--watch=false', '--browsers=ChromeHeadless', ...specs.map((spec) => `--include=${spec}`)],
  {
    cwd: frontendRoot,
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  },
);

if (result.error) {
  console.error(`[quality:targeted] Could not start Angular tests: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

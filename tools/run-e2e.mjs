import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../frontend/', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
const angularJson = JSON.parse(readFileSync(join(repositoryRoot, 'angular.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
const project = angularJson.projects?.['recce-studio'];
const hasAngularTarget = Boolean(project?.architect?.e2e);
const playwrightConfigs = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs'];
const cypressConfigs = ['cypress.config.ts', 'cypress.config.js', 'cypress.config.mjs', 'cypress.config.cjs'];
const hasPlaywrightConfig = playwrightConfigs.some((path) => existsSync(join(repositoryRoot, path)));
const hasCypressConfig = cypressConfigs.some((path) => existsSync(join(repositoryRoot, path)));

function run(command, args) {
  const executable = process.platform === 'win32' ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`[quality:e2e] Could not start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (scripts['e2e:ci']) {
  run('npm', ['run', 'e2e:ci']);
}
if (hasAngularTarget) {
  const angularCli = join(repositoryRoot, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  const result = spawnSync(process.execPath, [angularCli, 'e2e'], {
    cwd: repositoryRoot,
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  });
  process.exit(result.status ?? 1);
}
if (hasPlaywrightConfig) {
  if (!existsSync(join(repositoryRoot, 'node_modules', '@playwright', 'test'))) {
    console.error('[quality:e2e] Playwright configuration exists, but @playwright/test is not installed.');
    process.exit(1);
  }
  run('npx', ['--no-install', 'playwright', 'test']);
}
if (hasCypressConfig) {
  if (!existsSync(join(repositoryRoot, 'node_modules', 'cypress'))) {
    console.error('[quality:e2e] Cypress configuration exists, but cypress is not installed.');
    process.exit(1);
  }
  run('npx', ['--no-install', 'cypress', 'run']);
}

console.error('[quality:e2e] FAIL: an E2E runner and configuration are required.');
process.exit(1);

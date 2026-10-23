import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
function fixture(scripts = {}, playwright = false) {
  const results = join(root, '.factory-results');
  mkdirSync(results, { recursive: true });
  const directory = mkdtempSync(join(results, 'e2e-runner-'));
  mkdirSync(join(directory, 'frontend'));
  mkdirSync(join(directory, 'tools'));
  copyFileSync(join(root, 'tools', 'run-e2e.mjs'), join(directory, 'tools', 'run-e2e.mjs'));
  writeFileSync(join(directory, 'frontend', 'package.json'), JSON.stringify({ scripts }));
  writeFileSync(join(directory, 'frontend', 'angular.json'), '{}');
  if (playwright) writeFileSync(join(directory, 'frontend', 'playwright.config.ts'), 'export default {};');
  return spawnSync(process.execPath, [join(directory, 'tools', 'run-e2e.mjs')], {
    encoding: 'utf8', timeout: 20_000, windowsHide: true,
  });
}

test('missing E2E harness fails instead of silently skipping', () => {
  const result = fixture();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /runner and configuration are required/);
  assert.doesNotMatch(result.stdout, /SKIP/);
});

test('a configuration without its installed runner fails', () => {
  const result = fixture({}, true);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@playwright\/test is not installed/);
});

test('the E2E command failure reaches the gate unchanged', () => {
  const result = fixture({ 'e2e:ci': 'node -e "process.exit(7)"' });
  assert.equal(result.status, 7);
});

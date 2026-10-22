import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const issues = [];
const required = [
  'AGENTS.md',
  'docs/quality-gates.md',
  'docs/ai/ISSUES.md',
  'docs/ai/AUDIT_REPORT.md',
  'docs/ai/QUALITY_BASELINE.md',
  '.github/workflows/quality-gates.yml',
  'frontend/package.json',
  'pom.xml',
];

for (const path of required) {
  if (!existsSync(join(root, path))) issues.push(`${path} is missing`);
}

const skillNames = ['factory-audit', 'factory-feature', 'factory-qa', 'factory-review', 'factory-ticket'];
for (const name of skillNames) {
  const path = join(root, '.agents', 'skills', name, 'SKILL.md');
  if (!existsSync(path)) {
    issues.push(`.agents/skills/${name}/SKILL.md is missing`);
    continue;
  }
  const content = readFileSync(path, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '';
  if (!new RegExp(`^name:\\s*${name}\\s*$`, 'm').test(frontmatter)) issues.push(`${name} has invalid name frontmatter`);
  if (!/^description:\s*\S.+$/m.test(frontmatter)) issues.push(`${name} has invalid description frontmatter`);
}

try {
  JSON.parse(readFileSync(join(root, 'frontend', 'package.json'), 'utf8'));
} catch (error) {
  issues.push(`frontend/package.json is invalid (${error.message})`);
}

try {
  const baseline = readFileSync(join(root, 'docs', 'ai', 'QUALITY_BASELINE.md'), 'utf8');
  const payload = /<!--\s*QUALITY_BASELINE_JSON\s*([\s\S]*?)-->/m.exec(baseline)?.[1];
  if (!payload) throw new Error('QUALITY_BASELINE_JSON block is missing');
  JSON.parse(payload);
} catch (error) {
  issues.push(`quality baseline is invalid (${error.message})`);
}

if (issues.length > 0) {
  console.error(`[factory:config] ${issues.length} issue(s) found:`);
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log('[factory:config] PASS');

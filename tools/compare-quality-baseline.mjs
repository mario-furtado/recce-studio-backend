import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const baselinePath = join(root, 'docs', 'ai', 'QUALITY_BASELINE.md');
const reportPath = join(root, '.factory-results', 'latest-release.json');
const validateOnly = process.argv.includes('--validate');

function loadBaseline() {
  const content = readFileSync(baselinePath, 'utf8');
  const match = /<!--\s*QUALITY_BASELINE_JSON\s*([\s\S]*?)-->/m.exec(content);
  if (!match) throw new Error('QUALITY_BASELINE_JSON block is missing');
  const parsed = JSON.parse(match[1]);
  if (parsed.schemaVersion !== 1 || typeof parsed.checks !== 'object') {
    throw new Error('Unsupported baseline schema');
  }
  return parsed;
}

let baseline;
try {
  baseline = loadBaseline();
} catch (error) {
  console.error(`[quality:baseline] ${error.message}`);
  process.exit(2);
}

if (validateOnly) {
  console.log(`[quality:baseline] PASS (${Object.keys(baseline.checks).length} machine-readable check signatures)`);
  process.exit(0);
}

if (!existsSync(reportPath)) {
  console.error('[quality:baseline] No release report found. Run node tools/run-quality-gate.mjs release DEEP first.');
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (report.gate !== 'RELEASE' || report.profile !== 'DEEP') {
  console.error('[quality:baseline] The latest report is not a DEEP RELEASE_GATE result.');
  process.exit(2);
}

let regression = false;
for (const result of report.results) {
  if (result.exitCode === 0) {
    console.log(`[quality:baseline] ${result.check}: PASS`);
    continue;
  }
  const known = baseline.checks[result.check];
  if (!known) {
    console.error(`[quality:baseline] ${result.check}: NEW FAILURE (no baseline entry)`);
    regression = true;
    continue;
  }
  const output = readFileSync(join(root, result.log), 'utf8');
  const missing = (known.signatures ?? []).filter((signature) => !output.includes(signature));
  if (missing.length > 0) {
    console.error(`[quality:baseline] ${result.check}: CHANGED FAILURE (missing signatures: ${missing.join(', ')})`);
    regression = true;
  } else {
    console.log(`[quality:baseline] ${result.check}: KNOWN FAILURE (${known.tickets.join(', ')})`);
  }
}

const executed = new Set(report.results.map((result) => result.check));
for (const check of Object.keys(baseline.checks)) {
  if (!executed.has(check)) {
    console.error(`[quality:baseline] ${check}: NOT VERIFIED in latest DEEP report`);
    regression = true;
  }
}

console.log('[quality:baseline] Comparison classifies signatures only; RELEASE_GATE failures remain blocking.');
process.exit(regression ? 1 : 0);

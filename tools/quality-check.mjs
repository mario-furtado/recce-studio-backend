import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../frontend/', import.meta.url));
const mode = process.argv[2];
const supportedModes = new Set(['lint', 'security', 'accessibility', 'resilience']);

if (!supportedModes.has(mode)) {
  console.error(`Usage: node tools/quality-check.mjs <${[...supportedModes].join('|')}>`);
  process.exit(2);
}

function repositoryPath(path) {
  return join(repositoryRoot, path);
}

function displayPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

function walk(directory, extensions) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(path, extensions);
    }

    return extensions.has(extname(entry.name)) ? [path] : [];
  });
}

function lineAt(content, offset) {
  return content.slice(0, offset).split(/\r?\n/).length;
}

function parseJson(path, issues) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    issues.push(`${displayPath(path)}: invalid JSON (${error.message})`);
    return null;
  }
}

function finish(label, issues) {
  if (issues.length > 0) {
    console.error(`[quality:${label}] ${issues.length} issue(s) found:`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
  }

  console.log(`[quality:${label}] PASS`);
}

function runLint() {
  const issues = [];
  const sourceFiles = walk(repositoryPath('src'), new Set(['.ts', '.html', '.css', '.json']));
  const inspectedFiles = [...sourceFiles, repositoryPath('server.mjs')].filter(existsSync);

  for (const path of inspectedFiles) {
    const content = readFileSync(path, 'utf8');
    const conflict = /^(<<<<<<<|=======|>>>>>>>)(?: .*)?$/m.exec(content);
    if (conflict) {
      issues.push(`${displayPath(path)}:${lineAt(content, conflict.index)} contains an unresolved merge marker`);
    }

    if (path.endsWith('.ts')) {
      const suppression = /^\s*\/\/\s*@ts-(?:ignore|nocheck)\b/m.exec(content);
      if (suppression) {
        issues.push(`${displayPath(path)}:${lineAt(content, suppression.index)} suppresses TypeScript diagnostics`);
      }
    }

    if (path.endsWith('.spec.ts')) {
      const focused = /\b(?:fdescribe|fit|xdescribe|xit)\s*\(|\.(?:only|skip)\s*\(/.exec(content);
      if (focused) {
        issues.push(`${displayPath(path)}:${lineAt(content, focused.index)} focuses or skips a test`);
      }
    }
  }

  for (const path of ['package.json', 'angular.json', 'ngsw-config.json', 'src/manifest.webmanifest']) {
    const absolutePath = repositoryPath(path);
    if (!existsSync(absolutePath)) {
      issues.push(`${path} is missing`);
      continue;
    }
    parseJson(absolutePath, issues);
  }

  finish('lint', issues);
}

function maskHtmlComments(content) {
  return content.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\r\n]/g, ' '));
}

function hasAccessibleAttribute(attributes, names) {
  return names.some((name) => new RegExp(`(?:^|\\s)(?:\\[(?:attr\\.)?)?${name.replace('.', '\\.')}(?:\\])?\\s*=`, 'i').test(attributes));
}

function staticAttribute(attributes, name) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attributes);
  return match?.[1];
}

function visibleText(body) {
  return body
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function runAccessibilityAudit() {
  const issues = [];
  const htmlFiles = walk(repositoryPath('src'), new Set(['.html']));

  for (const path of htmlFiles) {
    const original = readFileSync(path, 'utf8');
    const content = maskHtmlComments(original);
    const labelsFor = new Set(
      [...content.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]),
    );
    const labelRanges = [...content.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gi)].map((match) => [
      match.index,
      match.index + match[0].length,
    ]);

    for (const match of content.matchAll(/<img\b([^>]*)>/gi)) {
      if (!hasAccessibleAttribute(match[1], ['alt'])) {
        issues.push(`${displayPath(path)}:${lineAt(content, match.index)} image is missing alt text (use alt="" when decorative)`);
      }
    }

    for (const match of content.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      const [, tag, attributes, body] = match;
      if (tag.toLowerCase() === 'a' && !/(?:href|routerLink)\s*=/i.test(attributes)) {
        continue;
      }
      const named = hasAccessibleAttribute(attributes, ['aria-label', 'aria-labelledby', 'title']);
      if (!named && visibleText(body).length === 0) {
        issues.push(`${displayPath(path)}:${lineAt(content, match.index)} ${tag.toLowerCase()} has no accessible name`);
      }
    }

    for (const match of content.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      const [, tag, attributes] = match;
      if (/\btype\s*=\s*["']hidden["']/i.test(attributes)) {
        continue;
      }
      const id = staticAttribute(attributes, 'id');
      const isWrapped = labelRanges.some(([start, end]) => match.index > start && match.index < end);
      const named = hasAccessibleAttribute(attributes, ['aria-label', 'aria-labelledby', 'title']);
      if (!named && !isWrapped && !(id && labelsFor.has(id))) {
        issues.push(`${displayPath(path)}:${lineAt(content, match.index)} ${tag.toLowerCase()} has no associated label or accessible name`);
      }
    }

    for (const match of content.matchAll(/\btabindex\s*=\s*["']([1-9]\d*)["']/gi)) {
      issues.push(`${displayPath(path)}:${lineAt(content, match.index)} uses a positive tabindex (${match[1]})`);
    }

    const ids = new Map();
    for (const match of content.matchAll(/\bid\s*=\s*["']([^"'{}]+)["']/gi)) {
      if (ids.has(match[1])) {
        issues.push(`${displayPath(path)}:${lineAt(content, match.index)} duplicates static id "${match[1]}"`);
      } else {
        ids.set(match[1], match.index);
      }
    }
  }

  const indexPath = repositoryPath('src/index.html');
  const index = readFileSync(indexPath, 'utf8');
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(index)) {
    issues.push('src/index.html:1 document language is missing');
  }

  finish('accessibility', issues);
}

function runSecurityAudit() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['audit', '--json', '--audit-level=high'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
    shell: process.platform === 'win32',
  });

  if (result.error) {
    finish('security', [`npm audit could not start (${result.error.message})`]);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    const detail = result.stderr.trim() || `npm audit exited with code ${result.status ?? 'unknown'}`;
    finish('security', [`npm audit did not return a valid report (${detail})`]);
  }

  const vulnerabilities = report.metadata?.vulnerabilities;
  if (!vulnerabilities) {
    finish('security', ['npm audit report is missing vulnerability totals']);
  }

  const critical = Number(vulnerabilities.critical ?? 0);
  const high = Number(vulnerabilities.high ?? 0);
  const moderate = Number(vulnerabilities.moderate ?? 0);
  const low = Number(vulnerabilities.low ?? 0);
  console.log(`[quality:security] npm audit totals: critical=${critical}, high=${high}, moderate=${moderate}, low=${low}`);

  const issues = [];
  if (critical > 0 || high > 0) {
    issues.push(`npm audit reports ${critical} critical and ${high} high severity vulnerabilities`);
  }
  if ((result.status ?? 1) !== 0 && issues.length === 0) {
    issues.push(`npm audit exited with code ${result.status ?? 'unknown'} before establishing a clean result`);
  }
  finish('security', issues);
}

function runResilienceAudit() {
  const issues = [];
  const angular = parseJson(repositoryPath('angular.json'), issues);
  const serviceWorker = parseJson(repositoryPath('ngsw-config.json'), issues);
  const manifest = parseJson(repositoryPath('src/manifest.webmanifest'), issues);
  const project = angular?.projects?.['recce-studio'];
  const build = project?.architect?.build;
  const production = build?.configurations?.production;

  if (production?.serviceWorker !== 'ngsw-config.json') {
    issues.push('angular.json production build must enable ngsw-config.json');
  }
  if (production?.outputHashing !== 'all') {
    issues.push('angular.json production build must hash all generated assets');
  }
  if (!production?.budgets?.some((budget) => budget.maximumError)) {
    issues.push('angular.json production build must define at least one hard bundle budget');
  }
  if (!build?.options?.assets?.includes('src/manifest.webmanifest')) {
    issues.push('angular.json assets must include src/manifest.webmanifest');
  }

  if (serviceWorker?.index !== '/index.html') {
    issues.push('ngsw-config.json must use /index.html as the navigation fallback');
  }
  const appGroup = serviceWorker?.assetGroups?.find((group) => group.name === 'app');
  const appFiles = appGroup?.resources?.files ?? [];
  for (const requiredFile of ['/index.html', '/*.css', '/*.js']) {
    if (!appFiles.includes(requiredFile)) {
      issues.push(`ngsw-config.json app group is missing ${requiredFile}`);
    }
  }
  if (appGroup?.installMode !== 'prefetch') {
    issues.push('ngsw-config.json app shell must be prefetched for offline startup');
  }

  if (manifest?.display !== 'standalone') {
    issues.push('src/manifest.webmanifest must use standalone display mode');
  }
  for (const requiredSize of ['192x192', '512x512']) {
    const icon = manifest?.icons?.find((candidate) => candidate.sizes === requiredSize);
    if (!icon) {
      issues.push(`src/manifest.webmanifest is missing a ${requiredSize} icon`);
    } else if (!existsSync(repositoryPath(`src/${icon.src}`))) {
      issues.push(`src/manifest.webmanifest references missing icon ${icon.src}`);
    }
  }

  finish('resilience', issues);
}

if (mode === 'lint') {
  runLint();
} else if (mode === 'security') {
  runSecurityAudit();
} else if (mode === 'accessibility') {
  runAccessibilityAudit();
} else {
  runResilienceAudit();
}

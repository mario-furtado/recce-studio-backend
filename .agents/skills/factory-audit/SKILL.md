---
name: factory-audit
description: Audit a repository or bounded scope for evidence-backed defects and risks without implementing fixes, reusing the persistent baseline to avoid duplicate investigation.
---

# Factory Audit

Perform an evidence-based, read-only audit. Read root `AGENTS.md` and `docs/ai/QUALITY_BASELINE.md` once; find new concrete problems without rediscovering known signatures.

## Responsibilities

1. Read the repository instructions and identify the exact audit scope.
2. Search the issue tracker first, then inspect only relevant source, configuration, tests, documentation and diffs.
3. Reproduce or verify suspected problems with safe, read-only checks whenever practical.
4. Rank findings by severity, confidence, and user impact.
5. Report only actionable findings supported by file paths, line references, commands, or observed output.

## Boundaries

- Do not implement fixes, refactors, formatting changes, dependency upgrades, or business-logic changes.
- Do not create issues, commits, pull requests, or external messages unless explicitly requested.
- Do not report style preferences as defects unless they violate an applicable project rule or create measurable risk.
- If no material problem is found, say so and describe the remaining coverage gaps or untested risks.

## Workflow

1. State the scope and the assumptions that materially affect coverage.
2. Inspect the smallest set of files needed to understand the relevant behavior.
3. Run focused diagnostics before broad suites; use global `DEEP` only for systemic or release-wide scope.
4. For each new candidate, confirm the causal path and false positives. Reopen a known issue only if its signature or affected code changed.
5. Produce the audit report; do not modify repository files.

## Verifiable Result

Return findings ordered by severity. Each finding must include:

- severity and a concise title;
- exact file and line, or another precise location;
- evidence and reproduction or verification steps;
- expected versus observed behavior;
- impact and affected scenarios;
- a bounded remediation direction, without implementing it.

Conclude with the checks performed, checks not performed, and an explicit statement of whether material findings were found.

## Token Efficiency

- Search before reading; open only relevant ranges instead of entire large files.
- Avoid repeating source, command output, baseline analysis or the same evidence in multiple sections.
- Keep investigation notes internal and report only conclusions that affect the result.
- Prefer one decisive diagnostic over several overlapping checks.
- Stop expanding the search when the requested scope is covered and additional work has low expected value.


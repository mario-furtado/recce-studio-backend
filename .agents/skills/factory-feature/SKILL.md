---
name: factory-feature
description: Specify and implement a scoped product or engineering feature with a unique FEAT ID, a living document in docs/features/, risk-based QA, review, and separate ticket and release evidence. Use when a feature or repository change requires end-to-end delivery.
---

# Factory Feature

Deliver the smallest coherent feature through a persistent specification, implementation, QA and review. Root `AGENTS.md` is authoritative for profiles, gates and evidence reuse; consult `docs/quality-gates.md` for commands, not for a second policy.

## 1. Locate and specify

- Read applicable `AGENTS.md` once, the request, relevant diff and affected modules. Preserve existing changes; avoid unrelated refactors, upgrades or business-rule changes.
- Trace current behavior, components, dependencies, state transitions and relevant trust boundaries. Reproduce existing behavior when practical.
- Define objective, scope, functional/non-functional requirements, numbered verifiable acceptance criteria (prefer Given/When/Then), edge cases, expected errors and regression risks. Choose the simplest solution consistent with existing architecture and compatibility.
- Resolve routine implementation choices autonomously. Ask only about material product ambiguity, elevated unresolved risk or destructive actions. A placeholder alone is not a feature specification: obtain the missing objective before implementing.

## 2. Create the permanent document before implementation

- For a continuation, locate and reuse its existing document and ID. For a new feature, inspect `docs/features/FEAT-*.md`, including untracked documents; allocate the highest numeric ID plus one (start at 001; minimum three digits; do not fill gaps).
- Create `docs/features/FEAT-XXX-short-name.md` from [the document template](assets/feature-template.md). Check the ID across filenames, not only the proposed slug. Use exclusive creation; if a concurrent document claims the same ID, stop allocation and reconcile or choose the next ID before editing implementation. Never overwrite an existing feature or silently renumber it.
- Populate the specification and test plan with status `PLANNED`. Record the selected profile and reason according to `AGENTS.md`. Do not put a feature ID in `FACTORY_TICKET_ID` unless it also exists as a canonical audit ticket; use `FACTORY_RISK` when needed for AUTO selection.

## 3. Implement and maintain the document

- Move to `IN_PROGRESS` before implementation. Reuse existing patterns and dependencies; make only necessary, reviewable edits to code, configuration, tests and documentation.
- Automatically update the same Markdown document at each phase transition, scope/decision change, validation result or blocker, without waiting for a separate user request. Keep requirements, actual changed files, criterion/test/evidence matrix, limitations and dated history current. This is an agent workflow obligation, not a background watcher.
- Add meaningful tests for changed behavior; reproduce a pre-fix failure when practical. Do not create implementation-mirroring tests for low-impact documentation/configuration; validate their relevant contracts instead.

## 4. Test and review

- Apply `factory-qa` and `factory-review` as required by `AGENTS.md` or explicit user instructions. In FAST, perform focused QA/review inline unless their Skills are explicitly requested or concrete risk requires them. Load each needed Skill once; no independent agents unless separately authorized.
- Cover each acceptance criterion, normal/invalid/boundary cases and related regressions. Test permissions, isolation, persistence and recovery at affected boundaries when relevant. Run applicable unit/integration tests, build and E2E for changed journeys when an environment is available; record missing validation explicitly.
- Start with focused checks, then run one risk-selected ticket gate after stabilization using `docs/quality-gates.md`. Fix introduced defects and rerun affected checks; reuse unchanged valid evidence. Do not weaken assertions or skip failures.
- Set `IN_REVIEW` for final review. Inspect the full scoped diff, test strength, security, persistence, errors and related regressions. Record the review verdict and address blocking findings.
- Consult the baseline before investigating global failures. Keep unrelated known failures as release context; do not broaden the feature into their remediation. Run a release gate only when warranted by scope or requested.

## 5. Record and report

- Record exact commands, profile, executed results, evidence paths and limitations. Map every criterion to its tests/checks and observed outcome; mark unexecuted checks `UNVERIFIED`, never infer success. Keep long logs in `.factory-results/` and durable summaries in the feature document.
- Maintain independent `TICKET_GATE` and `RELEASE_GATE` with native outcomes from the repository contracts. For a requested `APPROVED / BLOCKED / UNVERIFIED` report, map PASS to APPROVED, FAIL/BLOCKED to BLOCKED and NOT_RUN/UNVERIFIED to UNVERIFIED, retaining the native result and reason in the document.
- Use `BLOCKED` when a dependency or environment prevents progress. Do not mark `COMPLETED` until all mandatory criteria and relevant tests are verified, the ticket gate passes, review approves, and no introduced failures remain. An independent known release failure can coexist with completion under `AGENTS.md`; an unexecuted release gate cannot imply release approval.
- Before handoff, update the document with final status and evidence. Report ID/name, fulfilled/pending criteria, actual tests/results, new regressions, both gates, document path and residual risks/decisions. State when no business logic changed. Never push, merge or deploy without explicit authorization.

## Efficiency

Search only relevant paths, load the template only when creating a document, and update concise sections rather than duplicating narratives. Reuse valid session evidence and existing fixtures. Stop at the accepted scope; list optional improvements without implementing them.


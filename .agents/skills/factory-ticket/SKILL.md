---
name: factory-ticket
description: Resolve one repository audit ticket end to end with risk-based validation, focused QA and review, and separate ticket and release verdicts. Use when a ticket ID from docs/ai/ISSUES.md or an audit report requires implementation.
---

# Factory Ticket

Resolve exactly one audit ticket with the smallest verified change. Treat the ticket as scope, not as permission for adjacent fixes.

## Preconditions

- Read the root `AGENTS.md` and `docs/quality-gates.md` once before changing files. Do not reload instructions already read in this task.
- Use `docs/ai/ISSUES.md` as the canonical tracker. Fall back to `docs/ai/AUDIT_REPORT.md` or another audit report only when the ID is absent, then add the ticket to the canonical tracker.
- Consult `docs/ai/QUALITY_BASELINE.md` before investigating a global failure; reuse matching evidence when affected code and environment are unchanged.
- Preserve unrelated working-tree changes. Do not merge, push, deploy, or mutate production/shared data without explicit approval.
- Process one ticket ID at a time. If it contains independent problems, record named subtasks under that ticket and complete or disposition each separately.

## Workflow

### 1. LOCALIZAR

Search for the exact ticket ID before opening broad files. Read only its tracker entry, linked evidence, applicable repository instructions, and the minimum surrounding code. Stop and request a valid ID if the ticket cannot be found unambiguously.

### 2. VALIDAR

Confirm the current behavior before editing, preferably with the recorded reproduction or regression test. Define objective, testable acceptance criteria and record the baseline result. If validation is unsafe or impossible, do not guess: mark verification `UNVERIFIED` and the ticket `BLOCKED` when no safe progress is possible, or `PARTIAL` when bounded useful work remains.

### 3. PLANEAR

Set the ticket to `IN_PROGRESS`. List the smallest affected components, trust/state boundaries, compatibility risks and required tests. Select `FAST`, `STANDARD` or `DEEP` under `AGENTS.md`; security or persistence risk requires strict focused tests, not automatic global `DEEP`.

### 4. IMPLEMENTAR

Fix only the validated problem. Keep the diff narrow, preserve public behavior outside the acceptance criteria, and avoid opportunistic refactors, formatting, dependency upgrades, or test weakening. When subtasks are required, keep them independently reviewable and tied to the parent ticket.

### 5. TESTAR

Run the focused reproduction/regression first, then `TICKET_GATE` at the selected profile. For security, authorization, privacy, persistence or data-loss changes, exercise the exact owner/non-owner, spoofing, recovery and persistence boundaries even under `STANDARD`. In `FAST`, perform focused QA inline; in `STANDARD` or `DEEP`, read and apply `../factory-qa/SKILL.md` when the request or risk requires it. Record actual commands and outcomes; never call an unexecuted, skipped or failing check successful.

### 6. REVER

Set the ticket to `IN_REVIEW` and inspect the complete ticket diff. In `FAST`, use a focused inline review; otherwise read and apply `../factory-review/SKILL.md` when required. Reuse QA evidence and expand only around a concrete risk. A blocking finding returns the ticket to `IN_PROGRESS`; rerun only affected checks.

### 7. REGISTAR

Update the canonical ticket with:

- final state and acceptance-criteria checklist;
- reproduction before and verification after;
- exact tests and outcomes;
- files changed and why;
- `TICKET_GATE`, `RELEASE_GATE` when observed, and review verdict;
- residual risks, blocked/conditional checks, and follow-up ticket IDs.

Use only `OPEN`, `IN_PROGRESS`, `IN_REVIEW`, `RESOLVED`, `BLOCKED`, or `PARTIAL`. Set `RESOLVED` when all criteria, relevant regressions and `TICKET_GATE` pass and review approves. A separately failing `RELEASE_GATE` does not block resolution when every failure is known, independent and recorded in the baseline. If a failure prevents verification or may be caused by this change, use `BLOCKED`, `PARTIAL` or `UNVERIFIED`.

### 8. ENTREGAR

Return a concise human-approval summary: ticket and final state, root cause, files changed, acceptance criteria, tests with outcomes, QA/review verdicts, and remaining risks. Do not claim merge or release readiness beyond the evidence collected.

## Scope and Safety Rules

- Do not change unrelated code or silently combine tickets.
- Reproduce bugs before fixing them when practical; preserve the failing-before/passing-after evidence.
- Do not remove, skip, loosen, or rewrite a regression merely to make it pass.
- Do not hide pre-existing or new failures. Distinguish ticket failures, environment failures and unrelated baseline failures; the latter remain blocking for `RELEASE_GATE`.
- Do not invent commands, results, ownership rules, or product decisions. Escalate material ambiguity.
- Keep tickets `PARTIAL` or `BLOCKED` when required ticket validation or review cannot complete.

## Token Efficiency

- Start with an exact ID search and reuse evidence, commands, and tests already recorded by the audit.
- Read targeted ranges and diffs; do not rescan the repository after each phase.
- Keep one compact working summary of acceptance criteria, affected files, and executed commands.
- Iterate with the narrowest relevant test; run the selected ticket gate once after stabilization and global release checks only when requested or materially relevant.
- Keep detailed logs in `.factory-results/`; report diagnostic lines and avoid repeating the ticket narrative across phases.

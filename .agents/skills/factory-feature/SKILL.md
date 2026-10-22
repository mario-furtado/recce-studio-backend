---
name: factory-feature
description: Implement a scoped product or engineering requirement with risk-based tests, documentation, and separate ticket and release evidence. Use when working repository changes are expected.
---

# Factory Feature

Implement the requested requirement with the smallest coherent change that fits the existing architecture and preserves unrelated behavior.

## Responsibilities

1. Translate the request into explicit acceptance criteria and identify affected components.
2. Read root `AGENTS.md` once and inspect only affected patterns before editing.
3. Implement the requirement across the necessary code, configuration, tests, and documentation.
4. Preserve compatibility unless the user explicitly authorizes a breaking change.
5. Verify behavior with focused tests and the risk-selected `TICKET_GATE`.

## Boundaries

- Change only what is necessary for the accepted requirement.
- Do not perform opportunistic refactors, unrelated cleanup, dependency upgrades, or broad formatting.
- Do not invent product decisions when an ambiguity would materially change behavior; surface the decision instead.
- Do not weaken validation, security controls, types, or tests to make the implementation pass.
- Preserve user changes and unrelated working-tree modifications.

## Workflow

1. Define concise acceptance criteria from the request.
2. Trace the current behavior and select the narrowest integration points.
3. Implement in small, reviewable edits following local conventions.
4. Add or update tests that fail without the feature and pass with it.
5. Run focused validation, then one `TICKET_GATE` at the profile selected by `AGENTS.md`. Security or persistence changes add explicit boundary tests without forcing global `DEEP`.
6. Review the diff for accidental scope growth and update relevant documentation.

## Verifiable Result

The final handoff must include:

- acceptance criteria and whether each is satisfied;
- files changed and the purpose of each change;
- tests or validation commands, `TICKET_GATE`, and any observed `RELEASE_GATE`;
- known limitations, assumptions, and unverified areas;
- an explicit note if no business logic was changed.

The feature is complete when its criteria, relevant tests and `TICKET_GATE` pass. Known unrelated baseline failures remain release concerns unless they prevent verification.

## Token Efficiency

- Use targeted search to find established patterns before opening broad file sets.
- Summarize large files and logs; quote only the lines needed to justify a decision.
- Prefer focused tests during iteration; run the selected ticket gate once after stabilization and global checks only for release or systemic risk.
- Avoid restating the request, acceptance criteria, and diff in multiple forms.
- Stop when all acceptance criteria are verified; list optional improvements instead of implementing them.


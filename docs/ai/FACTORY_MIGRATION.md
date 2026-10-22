# Factory Migration Record

Date: 2026-10-22

The AI Software Factory is owned by this repository, `recce-studio-backend`. Spring Boot lives at the root and Angular lives under `frontend/`.

Migrated and adapted:

- root `AGENTS.md`;
- `.agents/skills/factory-*`;
- `.github/workflows/quality-gates.yml`;
- `docs/quality-gates.md` and all `docs/ai` audit/tracker/baseline material;
- root quality tooling under `tools/`;
- frontend adversarial regression evidence at `frontend/src/app/audit-regressions.spec.ts`;
- local `.factory-results/` history, which remains intentionally ignored because logs are machine-specific.

The previous standalone `recce-studio` checkout retained only its unrelated application changes, feedback document and feedback-document generator. Factory files, audit tracker copies, quality scripts and transient Factory results were removed after validation in this target.

Verification performed in the target:

- `TICKET_GATE FAST`: PASS for Factory configuration, frontend lint, strict typecheck and targeted parser regression.
- `RELEASE_GATE STANDARD`: PASS for Factory configuration, clean backend compile/Surefire invocation, frontend lint/typecheck/targeted/integration checks, conditional E2E and production build.
- Backend limitation: the clean Maven run reports `No tests to run`.
- Known DEEP results are recorded in `QUALITY_BASELINE.md` and remain release-blocking when DEEP is selected.

No business logic, deployment, merge or push was performed by this migration.

# Quality Gates

The repository contains Spring Boot 2.7/Java 8 at the root and Angular 20.3/TypeScript 5.8 under `frontend/`. Frontend development and CI use Node.js 22 (`frontend/.nvmrc`; compatible alternatives are in `frontend/package.json` engines). The gates use Maven, Karma/Jasmine, Playwright, Chrome Headless, npm and the existing service-worker configuration.

## Execution profiles

| Profile | Ticket validation | Release validation |
| --- | --- | --- |
| `FAST` | Factory configuration plus affected Maven tests and/or frontend lint, typecheck and targeted specs | same checks across both application areas |
| `STANDARD` | `FAST`, frontend integration, applicable E2E and production build | default pull-request gate for backend and frontend |
| `DEEP` | `STANDARD` plus global checks only for systemic risk | full frontend regression/audits and backend package assembly |

Profile selection follows root `AGENTS.md`. High-risk authorization, security or persistence work normally uses `STANDARD` plus explicit focused tests; global `DEEP` is reserved for systemic risk or release preparation.

## Commands

```bash
cd frontend
npm run test:quick
cd ..

# TICKET_GATE; AUTO chooses FAST or STANDARD
node tools/run-quality-gate.mjs ticket AUTO
node tools/run-quality-gate.mjs ticket FAST
node tools/run-quality-gate.mjs ticket STANDARD
node tools/run-quality-gate.mjs ticket DEEP

# RELEASE_GATE
node tools/run-quality-gate.mjs release AUTO
node tools/run-quality-gate.mjs release FAST
node tools/run-quality-gate.mjs release STANDARD
node tools/run-quality-gate.mjs release DEEP

# Classify the latest DEEP release failures against the baseline
node tools/compare-quality-baseline.mjs
```

Set `FACTORY_TICKET_ID` to read severity from `docs/ai/ISSUES.md`, or `FACTORY_RISK=low|medium|high|critical` when no canonical ticket exists. Changed paths are the fallback. `FACTORY_MAVEN_TESTS` selects Maven test classes/patterns and `QUALITY_TARGET_SPECS` selects comma-separated Angular specs relative to `frontend/`. Preview selection with `node tools/run-quality-gate.mjs ticket AUTO --plan`.

Detailed output and machine-readable latest reports are stored under ignored `.factory-results/`; the console shows status and only the tail of failures. Commands preserve real exit codes. `TICKET_GATE` fails fast; `RELEASE_GATE` completes the selected profile to produce a complete release result.

## Gate semantics

`TICKET_GATE` answers whether the requested change meets its criteria without related regressions. `RELEASE_GATE` answers whether the complete application is integration or publication ready. A known baseline failure may be unrelated to a passing ticket but remains blocking for release. `baseline:compare` classifies signatures only and never changes `RELEASE_GATE` status.

The frontend retains `quality:fast`, `quality:standard` and `quality:deep` for frontend-only use. The root wrapper adds Maven, automatic affected-area selection, concise persisted logs and explicit gate identity.

## Check contracts

- `factory:config` validates the root policy, canonical docs, workflow, package JSON, baseline payload and all five Skills.
- `backend:test` compiles main/test Java and runs Surefire; `FACTORY_MAVEN_TESTS` narrows it to affected tests when available. Zero discovered/selected tests fail the check (`failIfNoTests` and `failIfNoSpecifiedTests`).
- `frontend:lint` rejects merge markers, TypeScript suppressions, focused/skipped Jasmine tests, invalid JSON and missing frontend configuration.
- `frontend:typecheck` compiles application and specs with `--noEmit`.
- `frontend:test:targeted` derives sibling specs from `frontend/` changes. `QUALITY_TARGET_SPECS` can explicitly select specs relative to `frontend/`; otherwise the parser suite is a mandatory sentinel.
- `npm run test:integration` executes the existing Angular component/TestBed specs.
- `npm run test:e2e` runs the E2E-wrapper regression checks and the mandatory Playwright harness (`e2e:ci`). It starts an isolated H2 backend and the compiled Angular frontend, uses real HTTP requests and fails for a missing runner/configuration, zero tests or a failed scenario. See [E2E setup and scope](e2e.md). No conditional skip is allowed.
- `npm run build` is the production Angular build. Existing warning and error budgets remain authoritative.
- `npm run audit:security` uses the lockfile-backed npm advisory audit and explicitly verifies its JSON severity totals, because older npm clients do not consistently return a failing exit code. High or critical vulnerabilities block the gate. Registry, malformed-report, or audit-service failures also fail because a clean result cannot be established.
- `npm run audit:accessibility` statically checks templates for image alternatives, accessible names, form labels, positive tab order, duplicate static IDs, and document language. It complements, but does not claim to replace, browser/assistive-technology testing.
- `npm run audit:resilience` validates production hashing, hard bundle budgets, service-worker activation and app-shell caching, installable manifest settings, and required icon files. The production build verifies the generated artifacts separately.

## CI policy

`.github/workflows/quality-gates.yml` runs blocking `RELEASE_GATE: STANDARD` for every pull request. Adding the `quality-deep` label selects blocking `DEEP`. Manual dispatch supports all profiles.

CI installs Playwright Chromium and its system dependencies, then STANDARD/DEEP execute both Java tests and E2E. Logs, reports and failure traces under `.factory-results/` are uploaded even on failure. `DEEP` is conditional by cost, not advisory: when selected, any regression, security, accessibility, resilience, build, or test failure fails the workflow.

## Limitations

- Automatic local selection is most precise with `FACTORY_TICKET_ID`; an unrelated dirty working tree can make path fallback conservatively choose `STANDARD` or include both application areas.
- Baseline comparison is signature-based and intentionally conservative. It classifies known output but cannot prove the absence of an additional symptom inside the same failing check.
- The selected E2E journeys use Chromium, real HTTP/JPA/H2 and local storage. Service-worker caching, hardware recording, S3/Postgres, concurrency and cross-browser journeys are outside this harness.
- Java regressions cover auth/token lifecycle, tenant/media isolation, GPX, offline replay and note persistence/Excel workflows. They are meaningful tests, not exhaustive coverage of every backend branch.

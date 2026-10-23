# Backend and browser journey tests

Use Node.js 22, Java 8 and Maven on PATH. Install locked frontend dependencies with `npm ci` in `frontend/`, then install the browser with `node node_modules/@playwright/test/cli.js install chromium` (CI uses `--with-deps chromium`). Alternatively, set `CHROME_BIN` to a local Chrome executable. Run `npm run test:e2e` from `frontend/`, or the repository ticket/release STANDARD gate.

The harness uses Playwright 1.64.1. The wrapper first tests its failure propagation and then runs `e2e:ci`. Missing configuration/runner, zero matching tests, focused tests or a failed journey cause a nonzero exit; retries and existing-server reuse are disabled. The backend also fails if Surefire discovers/selects no tests.

## Isolated execution

- Playwright starts Spring Boot on `127.0.0.1:18765` and the compiled frontend on `127.0.0.1:18766`. If either port is occupied, it fails instead of reusing another environment. There is no remote base-URL option.
- `tools/start-e2e-backend.mjs` compiles Java/test classes and resolves their classpath. The launcher `src/test/java/org/example/e2e/E2eServer.java` is not in the production jar. Its seed is a `@TestConfiguration`, excluded from normal application scanning.
- Command-line properties force an in-memory H2 database, create/drop schema, local storage, disabled H2 console and disabled production test-user bootstrap. An isolated upload directory is created below `.factory-results/e2e/`. Existing deployment datasource/storage environment variables cannot select a remote database or bucket for this launcher.
- Two fixture accounts are seeded through the real AuthService with a random per-run password inherited by workers. Login then goes through the real public HTTP endpoint. No public account-creation/reset/seed endpoint is enabled, no production credentials are used, and no tokens are injected into browser storage.
- The frontend build is served by `frontend/server.mjs` with its API URL pointing at the isolated backend. `FRONTEND_HOST=127.0.0.1` restricts this test server; the production default bind remains unchanged.
- Playwright owns both server process groups and terminates them at the end, including failures/timeouts. The in-memory database is disposable; logs/uploads stay in ignored `.factory-results/` for inspection. Browser contexts are fresh per scenario.

## Selected journeys

1. Reject invalid login; log in through the UI; follow new-recce selection; create a rally, PEC and note through the UI; reload and confirm persisted content; log out and verify that the old bearer is revoked at the API.
2. Create owner data through authenticated HTTP fixtures; log in as another account; verify list isolation, unavailable-PEC recovery, rejected direct mutation and unchanged owner data.
3. Revoke a live session at the real API and reload a protected route; verify redirect to login and removal of stale local authentication.

No API route interception, mocked backend response or test-only authorization bypass is used. Service workers are blocked in these journeys so requests reach the real API; offline cache/update behavior is not claimed. Hardware recording, external services, production database/storage, browser matrix and race conditions remain outside these selected journeys.

## Backend coverage and evidence

Existing auth, token, bootstrap, tenant/media, GPX and offline-replay regressions are retained. `NoteWorkflowIntegrationTest` adds HTTP/JPA tests for Excel export/edit/reimport, preservation after corrupt import, alignment of timed/untimed notes and completed-PEC write locks. Assertions check persisted values, not only HTTP success.

Use `node tools/run-quality-gate.mjs ticket AUTO` with `FACTORY_TICKET_ID=AUD-QA-001`. For a focused Java run, set `FACTORY_MAVEN_TESTS=NoteWorkflowIntegrationTest`; leave it unset for the full backend suite. The harness rebuilds its own frontend and compiles its backend when run standalone.

Detailed output: `.factory-results/e2e/backend-compile.log`, `backend-server.log`, `frontend-build.log`, `report/` and `artifacts/`. Failure screenshots/traces may contain ephemeral local test credentials; keep them in the test evidence store. CI uploads `.factory-results/` for seven days. No CI run is triggered by editing this workflow; local results and remote CI execution must be reported separately.

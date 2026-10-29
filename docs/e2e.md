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
4. Navigate through the SPA to previously unvisited profile/settings pages; verify deferred script requests and rendered content, then return without another script request or document reload.
5. Enter an offline session, navigate through tutorial/list/new recce, reject direct Notes access and resume through login without API requests.
6. Switch a real authenticated account offline and back online; verify the landing page and disabled/restored Notes link.
7. Create GPS/notes through the real sync API and upload a locally generated WebM; verify real satellite imagery, map/video seek, note selection, persisted offset, zoom/expansion and controlled tile failure without losing overlays.
8. Configure a personal notebook through the Presentation and Notebook areas in Notes, save and reload it, render existing notes in Studio, paginate a long sequence and export the actual print DOM to PDF. Assert all warnings remain, no block overflows, PDF page count/size match the preview and original note text/observations/times remain unchanged. The Studio link returns to /notes.
9. Reject invalid notebook settings and prevent printing oversized content with an actionable explanation.
10. Verify centralized Notes has explicit personal/team scopes, create a personal dictionary rule with meaning, reuse its symbol in presentation without duplication, retain unsaved drafts across areas and reload saved settings. Verify the team profile has no note forms and its PATCH cannot overwrite the base note system edited in Notes.
11. Complete the guided Notes tutorial through real components with memory-only demonstration providers. Verify highlights, explicit navigation, scope explanations, real overflow/recovery, exit/practice, reload and keyboard focus on a 390×844 viewport. Compare authenticated HTTP data and local storage before/after and reject any API writes during the demonstration. Repeat individual sections from Tutorial and launch help from Notes.
12. Create a symbol in Dictionary, configure its presentation with read-only identity fields, persist/reload its layout, then rename it in Dictionary. Verify the selector follows the dictionary, the previous presentation remains preserved as historical data, and the new symbol can be configured without duplication. The notebook PDF journey also defines its modifier in Dictionary before styling it.
13. Verify the compact Notes layout: closed help and team settings, contextual help operable with Enter, one selected symbol editor, styles retained across selection, no automatic writes, desktop header below 120px and a mobile layout without horizontal page overflow. Capture both viewports; existing journeys explicitly open secondary options and team configuration when needed.
14. Verify legacy notebook preferences default to centered rows, choose left/center/right and check actual geometry between margins. Export real PDFs for all three modes from the print document, preserve the sample text and reload the saved alignment. Unit tests additionally cover wrapped rows and backend HTTP/JPA tests cover optional/invalid values and separate users in the same team.
15. Complete the independent Rally, PEC, Recce and Studio tours, reverse/reload and exercise focus/keyboard/mobile controls. Real creation forms use per-demo memory providers; recce/media panels are explicit simulations. Compare real HTTP data and browser storage before/after, reject data API requests and IndexedDB writes, and trap device/recording/speech/audio access. Verify all guides in offline session mode and invalid-route recovery; no hardware or API success is mocked.

Notebook tests suppress only the native print dialog, then generate a real Chromium PDF from the same print document. They do not verify a physical printer or browser-specific dialog preferences. The E2E server explicitly excludes auxiliary `@TestConfiguration` classes from component scanning and refuses startup unless exactly one real user repository is present; no mocked persistence is accepted.

No API route interception, mocked backend response or test-only authorization bypass is used. The satellite journey requires outbound HTTPS access to `services.arcgisonline.com`; it first loads real imagery, then deliberately aborts only tile requests to test recovery/error presentation and verifies that tiles never receive API bearer credentials. A provider outage can block this external-image check. Run it separately with `npm --prefix frontend run e2e:ci -- --grep FEAT-003`. Service workers are blocked, so offline cache/update behavior is not claimed. Physical GPS/microphone/camera capture, other external services, production database/storage, browser matrix and race conditions remain outside these journeys.

## Backend coverage and evidence

Existing auth, token, bootstrap, tenant/media, GPX and offline-replay regressions are retained. `NoteWorkflowIntegrationTest` adds HTTP/JPA tests for Excel export/edit/reimport, preservation after corrupt import, alignment of timed/untimed notes and completed-PEC write locks. Assertions check persisted values, not only HTTP success.

Use `node tools/run-quality-gate.mjs ticket AUTO` with `FACTORY_TICKET_ID=AUD-QA-001`. For a focused Java run, set `FACTORY_MAVEN_TESTS=NoteWorkflowIntegrationTest`; leave it unset for the full backend suite. The harness rebuilds its own frontend and compiles its backend when run standalone.

Detailed output: `.factory-results/e2e/backend-compile.log`, `backend-server.log`, `frontend-build.log`, `report/` and `artifacts/`. Failure screenshots/traces may contain ephemeral local test credentials; keep them in the test evidence store. CI uploads `.factory-results/` for seven days. No CI run is triggered by editing this workflow; local results and remote CI execution must be reported separately.

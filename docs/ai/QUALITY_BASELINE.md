# Quality Baseline

Persistent record of known repository-wide failures. It prevents repeated diagnosis; it never converts a failing `RELEASE_GATE` into a pass. Reverify an entry only when related files change, its signature changes, or release validation is requested.

Last full observation: 2026-10-22. Environment: Windows, frontend lockfile dependencies, Chrome Headless 156, Java 8 and Maven.

| Check | Known state | Responsible ticket(s) | Last evidence |
| --- | --- | --- | --- |
| Frontend unit regression | PASS: 186/186 (frontend DEEP ticket recheck) | Historical regressions reverified during `AUD-DEP-001` | `frontend:test:unit` in DEEP ticket gate, 2026-10-23 |
| Dependency security | FAIL: 0 critical, 15 high, 4 moderate, 0 low; omit-dev audit clean | `AUD-DEP-001` PARTIAL; remaining high root: braces | full `frontend:audit:security` and separate `npm audit --omit=dev --json`, 2026-10-23 |
| Static accessibility | PASS: 0 findings (focused recheck) | `AUD-ACC-001` resolved | `npm --prefix frontend run audit:accessibility`, 2026-10-23 |
| Backend automated tests | PASS compilation, but zero tests discovered | `AUD-QA-001`; security tickets remain unverified in this checkout | clean `backend:test`, 2026-10-22 |
| Production bundle | PASS with 663.44 kB initial bundle / 500 kB warning budget | `AUD-PERF-001`; observed during `AUD-DEP-001` | `frontend:build`, 2026-10-23 |
| E2E | CONDITIONAL SKIP: no runner/configuration | `AUD-QA-001` | `frontend:test:e2e`, 2026-10-22 |

Original full-observation passes (2026-10-22): Factory configuration, clean backend compilation, frontend lint, strict app/spec typecheck, targeted parser regression, 5/5 component integration tests, production build and resilience audit. The backend reports `No tests to run`; no `AUD-SEC-001` pass is claimed.

Areas not verified: browser E2E journeys, real assistive-technology behavior, production data migration, production object storage, multi-process concurrency, and deployment configuration.

Focused update, 2026-10-22 (`AUD-SEC-001`): `FACTORY_TICKET_ID=AUD-SEC-001`, `FACTORY_MAVEN_TESTS=TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`, `QUALITY_TARGET_SPECS=src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`; `node tools/run-quality-gate.mjs ticket AUTO` selected STANDARD and passed. Contrary to the earlier zero-test observation above, this checkout contains Java regressions: the selected clean backend run passed 9 tests; targeted browser tests passed 4/4 and component integration passed 9/9. Production build passed with a 610.25 kB initial bundle warning. E2E remained a conditional skip. These are focused ticket observations, not a new full release baseline; global failure signatures above remain historical and were not re-executed. Detailed evidence: `.factory-results/latest-ticket.json` and `AUD-SEC-001-ticket.log`. `TICKET_GATE: PASS`; `RELEASE_GATE: NOT_RUN`.

Focused update, 2026-10-23 (`AUD-ACC-001`): the unchanged static accessibility audit reproduced 40 findings before correction and passed afterwards. Removed its historical failure signature from the active machine-readable known-failure list. STANDARD ticket gate passed: targeted 8/8, component integration 84/84, Factory config, lint, typecheck and production build. Bundle warning 627.16 kB / 500 kB; E2E conditional skip. Local-browser login label/Tab/Shift+Tab checks passed; seven rendered-template browser tests verified names, label focus and conditional/session-specific associations. No full release, real screen-reader session or authenticated keyboard journey was executed. Other global entries above remain historical observations and were not re-investigated. Evidence: `.factory-results/AUD-ACC-001-before.log`, `AUD-ACC-001-after.log`, `AUD-ACC-001-focused-final.log`, `AUD-ACC-001-ticket.log`, `AUD-ACC-001-qa-review.md`. `TICKET_GATE: PASS`; `RELEASE_GATE: NOT_RUN`.

Focused update, 2026-10-23 (`AUD-DEP-001`): the fresh original-lock audit returned 4 critical, 51 high, 22 moderate, 4 low (the historical moderate count was 24). After Angular 20.3/toolchain update, full audit FAIL: critical=0, high=15, moderate=4, low=0. Separate omit-dev audit: zero findings; this does not replace the full security gate. All 15 high entries inherit braces GHSA-vfj7-8cjw-p6xm, with no published patched release; moderate roots are postcss-selector-parser and uuid. Risk acceptance/owner assignment remains pending, proposed accountable role: frontend/toolchain maintainer. DEEP selected for cross-cutting framework migration, not security severity alone. Ticket gate failed at security after config, lint, strict typecheck, targeted 33/33, integration 84/84, full unit regression 186/186 and build passed. The historical unit-regression failure signature is removed following this actual full-suite pass. E2E conditional SKIP. Build warnings: 663.44 kB initial bundle (500 kB warning budget), plus unused RouterLink in PecsListComponent detected by the new compiler. Accessibility and resilience audits passed separately after fail-fast stopped the ticket pipeline; generated service-worker hash validation passed for 22 files, and a production-build browser smoke test passed login/empty validation/offline navigation/logout. No backend or full release gate executed. Triage: [AUD-DEP-001.md](AUD-DEP-001.md). Logs: `.factory-results/AUD-DEP-001-audit-before.json`, `AUD-DEP-001-audit-after.json`, `AUD-DEP-001-audit-runtime.json`, `AUD-DEP-001-ticket.log`, `AUD-DEP-001-qa-review.md`. `TICKET_GATE: FAIL`; `RELEASE_GATE: NOT_RUN` (security failure remains release-blocking).

The following block is consumed by `node tools/compare-quality-baseline.mjs`. Signatures classify an observed failure as previously known; they do not prove that no additional symptom exists and do not alter the release command's exit status.

<!-- QUALITY_BASELINE_JSON
{
  "schemaVersion": 1,
  "checks": {
    "frontend:audit:security": {
      "tickets": ["AUD-DEP-001"],
      "signatures": ["critical=0, high=15, moderate=4, low=0"]
    }
  }
}
-->

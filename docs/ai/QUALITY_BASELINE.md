# Quality Baseline

Persistent record of known repository-wide failures. It prevents repeated diagnosis; it never converts a failing `RELEASE_GATE` into a pass. Reverify an entry only when related files change, its signature changes, or release validation is requested.

Last full observation: 2026-10-22. Environment: Windows, frontend lockfile dependencies, Chrome Headless 156, Java 8 and Maven.

| Check | Known state | Responsible ticket(s) | Last evidence |
| --- | --- | --- | --- |
| Frontend unit regression | FAIL: 6 of 41 | `AUD-SEC-004`, `AUD-REC-001`, `AUD-UI-001`, `AUD-OFF-001`, `AUD-OFF-002`, `AUD-OFF-003` | `npm --prefix frontend run test:unit`, 2026-10-22 |
| Dependency security | FAIL: 4 critical, 51 high, 24 moderate, 4 low | `AUD-DEP-001` | `npm --prefix frontend run audit:security`, 2026-10-22 |
| Static accessibility | PASS: 0 findings (focused recheck) | `AUD-ACC-001` resolved | `npm --prefix frontend run audit:accessibility`, 2026-10-23 |
| Backend automated tests | PASS compilation, but zero tests discovered | `AUD-QA-001`; security tickets remain unverified in this checkout | clean `backend:test`, 2026-10-22 |
| Production bundle | PASS with 609.78 kB warning | `AUD-PERF-001` | `frontend:build`, 2026-10-22 |
| E2E | CONDITIONAL SKIP: no runner/configuration | `AUD-QA-001` | `frontend:test:e2e`, 2026-10-22 |

Current verified passes: Factory configuration, clean backend compilation, frontend lint, strict app/spec typecheck, targeted parser regression, 5/5 component integration tests, production build and resilience audit. The backend reports `No tests to run`; no `AUD-SEC-001` pass is claimed.

Areas not verified: browser E2E journeys, real assistive-technology behavior, production data migration, production object storage, multi-process concurrency, and deployment configuration.

Focused update, 2026-10-22 (`AUD-SEC-001`): `FACTORY_TICKET_ID=AUD-SEC-001`, `FACTORY_MAVEN_TESTS=TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`, `QUALITY_TARGET_SPECS=src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`; `node tools/run-quality-gate.mjs ticket AUTO` selected STANDARD and passed. Contrary to the earlier zero-test observation above, this checkout contains Java regressions: the selected clean backend run passed 9 tests; targeted browser tests passed 4/4 and component integration passed 9/9. Production build passed with a 610.25 kB initial bundle warning. E2E remained a conditional skip. These are focused ticket observations, not a new full release baseline; global failure signatures above remain historical and were not re-executed. Detailed evidence: `.factory-results/latest-ticket.json` and `AUD-SEC-001-ticket.log`. `TICKET_GATE: PASS`; `RELEASE_GATE: NOT_RUN`.

Focused update, 2026-10-23 (`AUD-ACC-001`): the unchanged static accessibility audit reproduced 40 findings before correction and passed afterwards. Removed its historical failure signature from the active machine-readable known-failure list. STANDARD ticket gate passed: targeted 8/8, component integration 84/84, Factory config, lint, typecheck and production build. Bundle warning 627.16 kB / 500 kB; E2E conditional skip. Local-browser login label/Tab/Shift+Tab checks passed; seven rendered-template browser tests verified names, label focus and conditional/session-specific associations. No full release, real screen-reader session or authenticated keyboard journey was executed. Other global entries above remain historical observations and were not re-investigated. Evidence: `.factory-results/AUD-ACC-001-before.log`, `AUD-ACC-001-after.log`, `AUD-ACC-001-focused-final.log`, `AUD-ACC-001-ticket.log`, `AUD-ACC-001-qa-review.md`. `TICKET_GATE: PASS`; `RELEASE_GATE: NOT_RUN`.

The following block is consumed by `node tools/compare-quality-baseline.mjs`. Signatures classify an observed failure as previously known; they do not prove that no additional symptom exists and do not alter the release command's exit status.

<!-- QUALITY_BASELINE_JSON
{
  "schemaVersion": 1,
  "checks": {
    "frontend:test:unit": {
      "tickets": ["AUD-SEC-004", "AUD-REC-001", "AUD-UI-001", "AUD-OFF-001", "AUD-OFF-002", "AUD-OFF-003"],
      "signatures": ["AUD-SEC-004", "AUD-REC-001", "AUD-UI-001", "AUD-OFF-001", "AUD-OFF-002", "AUD-OFF-003"]
    },
    "frontend:audit:security": {
      "tickets": ["AUD-DEP-001"],
      "signatures": ["critical=4, high=51, moderate=24, low=4"]
    }
  }
}
-->

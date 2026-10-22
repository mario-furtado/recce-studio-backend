# Quality Baseline

Persistent record of known repository-wide failures. It prevents repeated diagnosis; it never converts a failing `RELEASE_GATE` into a pass. Reverify an entry only when related files change, its signature changes, or release validation is requested.

Last full observation: 2026-10-22. Environment: Windows, frontend lockfile dependencies, Chrome Headless 156, Java 8 and Maven.

| Check | Known state | Responsible ticket(s) | Last evidence |
| --- | --- | --- | --- |
| Frontend unit regression | FAIL: 6 of 41 | `AUD-SEC-004`, `AUD-REC-001`, `AUD-UI-001`, `AUD-OFF-001`, `AUD-OFF-002`, `AUD-OFF-003` | `npm --prefix frontend run test:unit`, 2026-10-22 |
| Dependency security | FAIL: 4 critical, 51 high, 24 moderate, 4 low | `AUD-DEP-001` | `npm --prefix frontend run audit:security`, 2026-10-22 |
| Static accessibility | FAIL: 40 findings | `AUD-ACC-001` | `npm --prefix frontend run audit:accessibility`, 2026-10-22 |
| Backend automated tests | PASS compilation, but zero tests discovered | `AUD-QA-001`; security tickets remain unverified in this checkout | clean `backend:test`, 2026-10-22 |
| Production bundle | PASS with 609.78 kB warning | `AUD-PERF-001` | `frontend:build`, 2026-10-22 |
| E2E | CONDITIONAL SKIP: no runner/configuration | `AUD-QA-001` | `frontend:test:e2e`, 2026-10-22 |

Current verified passes: Factory configuration, clean backend compilation, frontend lint, strict app/spec typecheck, targeted parser regression, 5/5 component integration tests, production build and resilience audit. The backend reports `No tests to run`; no `AUD-SEC-001` pass is claimed.

Areas not verified: browser E2E journeys, real assistive-technology behavior, production data migration, production object storage, multi-process concurrency, and deployment configuration.

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
    },
    "frontend:audit:accessibility": {
      "tickets": ["AUD-ACC-001"],
      "signatures": ["40 issue(s) found"]
    }
  }
}
-->

# Audit Issue Tracker

Canonical tracker for tickets raised by repository audits. Process one ticket at a time with `factory-ticket`.

## Ticket format

Every ticket must retain these fields:

- **ID:** stable audit identifier.
- **Severity:** Critical, High, Medium, or Low, with conditions where relevant.
- **Description:** bounded problem and user/system impact.
- **Evidence:** reproducible observation, source location, or audit command.
- **Acceptance criteria:** objective checklist required for resolution.
- **State:** `OPEN`, `IN_PROGRESS`, `IN_REVIEW`, `RESOLVED`, `BLOCKED`, or `PARTIAL`.
- **Verification:** `VERIFIED` or `UNVERIFIED`.
- **Tests:** exact existing/required commands and their latest observed results.
- **Delivery record:** files changed, QA verdict, review verdict, residual risks, and date.

Lifecycle: `OPEN → IN_PROGRESS → IN_REVIEW → RESOLVED`. Use `BLOCKED` when safe progress requires unavailable input or infrastructure, and `PARTIAL` when only part of the acceptance criteria is complete. `UNVERIFIED` describes evidence quality and never means passed.

## AUD-SEC-001 — Isolation between teams is absent

- **Severity:** High
- **Description:** A valid user can access domain data created by another team because authentication is not translated into resource ownership.
- **Evidence:** The 2026-10-09 audit reproduced cross-team rally access. Repository migration verification on 2026-10-22 found only `AuthUserEntity.teamProfileId`; owned rally/car fields, tenant-scoped repositories, `TenantContext`, `OwnershipMigration`, and `src/test` are absent from the current target checkout.
- **Acceptance criteria:** [ ] Ownership is persisted for ralis and team cars, with PECs/notes/sync/assets inheriting the rally boundary and profile operations using the authenticated `teamProfileId`. [ ] List/read/write/delete deny cross-team access. [ ] A/B integration matrix passes without UI-only enforcement.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Historical 2026-10-09 results are preserved in `AUDIT_REPORT.md`; they are not reproducible from this checkout because the referenced Java regressions are absent. Required next test: recreate and run the A/B integration matrix in this repository before any state change.
- **Delivery record:** 2026-10-22 — Factory migration reconciled the canonical ticket with the actual Git target. The earlier implementation record was not present in this checkout and is retained only as historical audit context; no business-logic correction was claimed during the infrastructure migration.

## AUD-SEC-002 — Recce audio and video are public

- **Severity:** High
- **Description:** Audio and video endpoints bypass authentication, exposing private recordings to anyone who knows an ID.
- **Evidence:** Public media bypass in `ApiAuthInterceptor` and exclusions in `WebConfig`; anonymous regression receives access.
- **Acceptance criteria:** [ ] Anonymous requests receive 401. [ ] Authenticated non-owner receives 403/404. [ ] Owner can still stream supported media.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `mvn "-Dtest=ApiAuthInterceptorAuditTest" test` — latest result: FAIL, anonymous request allowed.
- **Delivery record:** None.

## AUD-SEC-003 — GPX parser accepts external XML entities

- **Severity:** High
- **Description:** GPX parsing does not disable DTD/external entity processing, creating XXE/SSRF/resource-consumption risk.
- **Evidence:** `PecAssetService.parseGpx()` uses a default `DocumentBuilderFactory`; hostile temporary-file fixture is not rejected.
- **Acceptance criteria:** [ ] DOCTYPE/external entities are rejected without resolution. [ ] Valid GPX still parses. [ ] Parser limits and failure response are deterministic.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `mvn "-Dtest=PecAssetServiceXmlSecurityAuditTest" test` — latest result: FAIL, no rejection.
- **Delivery record:** None.

## AUD-SEC-004 — Bearer token is attached to external origins

- **Severity:** Medium
- **Description:** The Angular interceptor authenticates unrelated absolute URLs instead of limiting credentials to the configured API.
- **Evidence:** `AUD-SEC-004` observes an Authorization header sent to `third-party.invalid`.
- **Acceptance criteria:** [ ] Only trusted API requests receive the bearer token. [ ] Login/register/offline behavior remains correct. [ ] Relative and configured absolute API URLs are covered.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `npm --prefix frontend run test:unit -- --include src/app/audit-regressions.spec.ts` — latest relevant case: FAIL.
- **Delivery record:** None.

## AUD-SEC-005 — Known test credentials are enabled by default

- **Severity:** High when an environment is exposed
- **Description:** Non-production-labelled deployments default to a known enabled test account while the server binds to all interfaces.
- **Evidence:** Defaults in backend `application.properties` and narrow prod-name detection in `TestUserBootstrap`.
- **Acceptance criteria:** [ ] Test user is opt-in. [ ] Unsafe exposed environments fail closed. [ ] Production/staging configuration tests cover missing and explicit flags.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Required: focused configuration/bootstrap tests; no deployment access permitted.
- **Delivery record:** None.

## AUD-SEC-006 — Tokens do not expire or revoke on logout

- **Severity:** High
- **Description:** Server validity is only token existence plus active user; logout removes local storage but leaves the server credential valid indefinitely.
- **Evidence:** `AuthService.isTokenValid`, `AuthUserEntity`, and absence of a logout/revocation endpoint.
- **Acceptance criteria:** [ ] Tokens have enforced expiry. [ ] Logout revokes the active credential. [ ] Expired/revoked/rotated token tests fail closed.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Required: auth service and HTTP lifecycle integration tests.
- **Delivery record:** None.

## AUD-OFF-001 — Interrupted synchronization remains stuck

- **Severity:** High
- **Description:** A persisted `syncing` session has no retry or recovery path after restart.
- **Evidence:** `AUD-OFF-001` reloads a synthetic `syncing` session and receives the same unusable state.
- **Acceptance criteria:** [ ] Startup safely recovers stale synchronization. [ ] Retry does not duplicate remote data. [ ] Current-session progress remains visible.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Frontend audit regression `AUD-OFF-001` — latest result: FAIL.
- **Delivery record:** None.

## AUD-OFF-002 — Missing referenced audio is treated as success

- **Severity:** High
- **Description:** A missing Blob returns upload success and allows deletion of the local session.
- **Evidence:** `AUD-OFF-002` supplies `audioBlobId` with no Blob; `uploadSessionAudio()` returns true.
- **Acceptance criteria:** [ ] Missing referenced audio is an explicit failure. [ ] Session and metadata are preserved. [ ] Retry/error messaging is actionable.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Frontend audit regression `AUD-OFF-002` — latest result: FAIL.
- **Delivery record:** None.

## AUD-OFF-003 — Offline sessions leak between local accounts

- **Severity:** High
- **Description:** IndexedDB records from a previous account are listed to the next account in the same browser.
- **Evidence:** `AUD-OFF-003` returns both own and foreign synthetic session IDs.
- **Acceptance criteria:** [ ] Authenticated users only see authorized local sessions. [ ] Anonymous/offline ownership migration is explicit. [ ] Foreign sessions cannot continue, sync, or delete.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Frontend audit regression `AUD-OFF-003` — latest result: FAIL.
- **Delivery record:** None.

## AUD-REC-001 — GPS denial leaves recording active

- **Severity:** High
- **Description:** Permission denial resolves startup as false but leaves internal recording enabled, allowing markers without the promised GPS state.
- **Evidence:** `AUD-REC-001` simulates denied geolocation and `registerClick()` still creates a marker.
- **Acceptance criteria:** [ ] Denial returns an idle, non-recording state. [ ] Watches/timeouts are cleared. [ ] Retry after granting permission works.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Frontend audit regression `AUD-REC-001` — latest result: FAIL.
- **Delivery record:** None.

## AUD-REC-002 — Leaving a recce can lose audio

- **Severity:** High
- **Description:** Component destruction stops capture without persisting the Blob, and an error message claims a JSON backup that its branch does not create.
- **Evidence:** Control-flow inspection of `completeOfflineSession()` and `ngOnDestroy()` in `recce-mode.component.ts`.
- **Acceptance criteria:** [ ] Navigation/refresh has a defined preservation or confirmation path. [ ] Audio is persisted or loss is explicitly prevented. [ ] Any announced backup is actually downloadable.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Required: MediaRecorder/navigation integration or E2E harness plus focused unit coverage.
- **Delivery record:** None.

## AUD-UI-001 — Selectable accent themes silently revert

- **Severity:** Medium
- **Description:** Settings expose blue and green accents, but validation accepts only red while still reporting success.
- **Evidence:** `AUD-UI-001` selects `midnight-blue` and observes `racing-red` in state/storage.
- **Acceptance criteria:** [ ] Every displayed accent persists and applies. [ ] Invalid stored values fall back safely. [ ] Success feedback matches the applied theme.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Frontend audit regression `AUD-UI-001` — latest result: FAIL.
- **Delivery record:** None.

## AUD-ROUTE-001 — New-recce route implicitly edits `pec-1`

- **Severity:** Medium
- **Description:** `/new-recce` opens the PEC editor without an ID, which falls back to a literal existing ID.
- **Evidence:** `app.routes.ts`, `PecsEditorComponent` initialization, and active sidebar link.
- **Acceptance criteria:** [ ] New-recce has an explicit create/select flow. [ ] No hard-coded PEC is loaded or synchronized. [ ] Missing/invalid targets have a recoverable route.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** Required: routing/component regression for no-ID and invalid-ID cases.
- **Delivery record:** None.

## AUD-ACC-001 — Controls lack accessible names

- **Severity:** Medium
- **Description:** Static accessibility analysis found 40 form controls without an associated label or accessible name.
- **Evidence:** `npm --prefix frontend run audit:accessibility` fails across login, offline recces, PEC/rally views, and team profile.
- **Acceptance criteria:** [ ] Static audit passes. [ ] Labels remain visually and semantically correct. [ ] Critical forms receive keyboard/browser spot checks.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `npm --prefix frontend run audit:accessibility` — latest result: FAIL, 40 issues.
- **Delivery record:** None.

## AUD-DEP-001 — High and critical dependency advisories

- **Severity:** High, triage pending
- **Description:** The lockfile contains critical/high advisories whose runtime reachability and safe upgrade paths have not been assessed.
- **Evidence:** Security gate reports 4 critical, 51 high, 24 moderate, and 4 low on the target repository lockfile (2026-10-22).
- **Acceptance criteria:** [ ] Each critical/high advisory is triaged for runtime reachability. [ ] Applicable fixes preserve tests/build. [ ] Accepted residual risks have owner and rationale.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `npm --prefix frontend run audit:security` — latest result: FAIL.
- **Delivery record:** None.

## AUD-QA-001 — Backend and E2E coverage gaps

- **Severity:** Medium
- **Description:** The backend previously had zero Java tests, and no E2E runner/configuration exists for critical journeys.
- **Evidence:** Clean backend gate reports `No tests to run`; `npm --prefix frontend run test:e2e` reports a conditional skip.
- **Acceptance criteria:** [ ] Critical backend services/controllers have meaningful tests. [ ] Selected user journeys run through an actual E2E harness. [ ] CI executes both without silent skips.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `node tools/run-quality-gate.mjs release STANDARD` confirms clean backend compilation with zero tests; `npm --prefix frontend run test:e2e` conditionally skips; implementation-specific tests remain required.
- **Delivery record:** None.

## AUD-PERF-001 — Initial bundle exceeds warning budget

- **Severity:** Low
- **Description:** The production initial bundle exceeds the configured warning threshold by 109.78 kB.
- **Evidence:** `npm --prefix frontend run build` reports 609.78 kB against a 500 kB warning budget.
- **Acceptance criteria:** [ ] Bundle meets the agreed budget or the budget change is evidence-based. [ ] Functional and lazy-loading regressions pass. [ ] Size result is recorded.
- **State:** OPEN
- **Verification:** VERIFIED
- **Tests:** `npm --prefix frontend run build` — latest result: PASS with budget warning.
- **Delivery record:** None.

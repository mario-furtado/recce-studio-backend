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
- **Description:** Authenticated teams must not read, overwrite, transfer or delete another team's rallies, cars, PECs, notes or assets, including through client-supplied identifiers and storage references.
- **Evidence:** On 2026-10-22 this checkout already contained persisted ownership, scoped repositories, `TenantContext`, `OwnershipMigration` and three passing isolation tests, contrary to the earlier migration record. Expanded MockMvc reproductions failed before correction: POST with team A's rally ID reassigned it to team B; POST with team A's note ID moved it to team B's PEC; team B received 200 for team A's recording; a supplied logo storage reference was persisted. Logs: `.factory-results/AUD-SEC-001-before.log` and `AUD-SEC-001-storage-before.log`.
- **Acceptance criteria:** [x] Ownership is persisted for ralis and team cars, with PECs/notes/sync/assets inheriting the rally boundary and profile operations using the authenticated `teamProfileId`. [x] List/read/write/delete deny cross-team access. [x] A/B integration matrix passes without UI-only enforcement.
- **State:** RESOLVED
- **Verification:** VERIFIED
- **Tests:** `mvn.cmd compiler:compile compiler:testCompile "-Dtest=TenantIsolationAuditTest,ApiAuthInterceptorAuditTest" surefire:test`: PASS, 9 tests. With `FACTORY_TICKET_ID=AUD-SEC-001`, `FACTORY_MAVEN_TESTS=TenantIsolationAuditTest,ApiAuthInterceptorAuditTest` and `QUALITY_TARGET_SPECS=src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`, `node tools/run-quality-gate.mjs ticket AUTO`: PASS, automatically selected STANDARD; clean backend 9/9, Factory configuration, lint, typecheck, targeted browser tests 4/4, component integration 9/9 and production build passed. E2E is a conditional SKIP (no harness), not an executed journey. Build warning: 610.25 kB initial bundle versus 500 kB warning budget. `git diff --check`: PASS. Evidence: `.factory-results/latest-ticket.json`, `AUD-SEC-001-ticket.log`, `AUD-SEC-001-qa-review.md` and per-check logs linked by the JSON report.
- **Delivery record:** 2026-10-22 — `RallyController` and `NoteExcelParserService` discard client IDs on creation; `RallyEntity`/`TeamCarEntity` expose storage references as read-only JSON; `ApiAuthInterceptor`, `WebConfig`, `PecAssetService` and `PecAssetController` authenticate/scoped-check recordings and prevent media caching. Angular `pecs.service.ts`/`pecs-editor.component.ts` fetch video as an authenticated Blob, cancelling pending requests and revoking replaced/destroyed object URLs. `TenantIsolationAuditTest` and the new `pecs-editor.component.spec.ts` cover the regressions, authenticated profile identity, tenant-specific sync retries and existing migration cases. QA: PASS; focused review: APPROVE WITH NOTES, no blocking findings. **TICKET_GATE: PASS. RELEASE_GATE: NOT_RUN** (no global release run; known unrelated baseline failures were not re-investigated). Local H2/local storage and Chrome Headless 155 were used; PostgreSQL/S3, production migration, multi-process concurrency and real large-video playback were not verified. Video now downloads fully before playback and requires browser memory for the Blob. npm dependencies and browser execution required running outside the sandbox; the first browser fixture used the wrong response type and was corrected without changing assertions. Media evidence overlaps AUD-SEC-002, whose separate ticket lifecycle is unchanged. No push, merge or deploy.

## AUD-SEC-002 — Recce audio and video are public

- **Severity:** High
- **Description:** Audio and video endpoints bypass authentication, exposing private recordings to anyone who knows an ID.
- **Evidence:** Historical cause: public media bypass in `ApiAuthInterceptor`, route exclusions in `WebConfig` and unscoped media lookups. The issue is no longer reproducible at current HEAD `d19e70c` (AUD-SEC-001 correction): recordings require authentication and inherited rally ownership, use no-store, and the Angular player fetches authenticated Blobs. Prior session evidence is retained in `.factory-results/AUD-SEC-001-before.log`, `AUD-SEC-001-qa-review.md` and `AUD-SEC-001-gate.json`; fresh AUD-SEC-002 regressions verify the current behavior without reverting the correction.
- **Acceptance criteria:** [x] Anonymous requests receive 401. [x] Authenticated non-owner receives 403/404. [x] Owner can still stream supported media.
- **State:** RESOLVED
- **Verification:** VERIFIED
- **Tests:** `mvn.cmd compiler:compile compiler:testCompile "-Dtest=TenantIsolationAuditTest,ApiAuthInterceptorAuditTest" surefire:test`: PASS, 12 tests (4 interceptor cases and 8 integration tests). `FACTORY_TICKET_ID=AUD-SEC-002`, `FACTORY_MAVEN_TESTS=TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`, `node tools/run-quality-gate.mjs ticket AUTO`: PASS, automatically selected STANDARD, backend + Factory scope; clean backend 12/12 and Factory configuration passed. HTTP matrix covers anonymous/invalid/query-only credentials (401), foreign team (404), owner exact audio/video bytes and HEAD metadata (200), denied anonymous/foreign Range requests, owner video Range (206, exact Content-Range and bytes), no-store and existing owner upload/delete. Frontend 4/4 focused, 9/9 component integration, lint/typecheck/build evidence from AUD-SEC-001 is reused because its code and environment are unchanged; those checks were not re-executed for this ticket. `git diff --check`: PASS.
- **Delivery record:** 2026-10-22 — No additional production correction was necessary; the fix is already in `d19e70c`. Extended `ApiAuthInterceptorAuditTest` from audio GET to audio/video GET/HEAD and strengthened the existing media matrix in `TenantIsolationAuditTest` for invalid credentials, query-token spoofing, HEAD and Range authorization/compatibility. QA: PASS; focused review: APPROVE, no blocking findings or weakened assertions. **TICKET_GATE: PASS. RELEASE_GATE: NOT_RUN.** Logs: `.factory-results/AUD-SEC-002-focused.log`, `AUD-SEC-002-ticket.log`, `AUD-SEC-002-qa-review.md`, and `.factory-results/latest-ticket.json`. Local H2/local storage transport and video partial responses were verified; S3, actual media codecs/large-file playback and browser E2E were not. Existing full-Blob video memory/latency tradeoff remains. No global release run or baseline failure re-investigation; no push, merge or deploy.

## AUD-SEC-003 — GPX parser accepts external XML entities

- **Severity:** High
- **Description:** GPX parsing does not disable DTD/external entity processing, creating XXE/SSRF/resource-consumption risk.
- **Evidence:** Reproduced on 2026-10-22: the existing hostile temporary-file fixture was accepted by the default `DocumentBuilderFactory`; `PecAssetServiceXmlSecurityAuditTest` failed with "Expected java.lang.reflect.InvocationTargetException to be thrown, but nothing was thrown". Before log: `.factory-results/AUD-SEC-003-before.log`. After correction, the fixture is rejected with a SAX exception, and the loopback HTTP matrix records zero external requests.
- **Acceptance criteria:** [x] DOCTYPE/external entities are rejected without resolution. [x] Valid GPX still parses. [x] Parser limits and failure response are deterministic.
- **State:** RESOLVED
- **Verification:** VERIFIED
- **Tests:** Before: `mvn.cmd compiler:compile compiler:testCompile "-Dtest=PecAssetServiceXmlSecurityAuditTest" surefire:test`: FAIL, 1/1 (XXE document accepted). After: `mvn.cmd compiler:compile compiler:testCompile "-Dtest=PecAssetServiceXmlSecurityAuditTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest" surefire:test`: PASS, 18/18. Final `FACTORY_TICKET_ID=AUD-SEC-003`, `FACTORY_MAVEN_TESTS=PecAssetServiceXmlSecurityAuditTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest`, `node tools/run-quality-gate.mjs ticket AUTO`: PASS, automatically selected STANDARD, backend + Factory; clean backend 18/18, zero failures/errors/skips, and Factory configuration passed. Matrix covers file XXE, HTTP external DTD/general/parameter entities, internal entities, disabled XInclude/schema retrieval, valid default-namespace GPX coordinates/order, exact byte/depth limits, stable HTTP 400 for invalid GPX, foreign-team 404, unchanged persisted reference on failed reads, valid replacement recovery and unchanged GPS JSON parsing. `git diff --check`: PASS. Logs: `.factory-results/AUD-SEC-003-before.log`, `AUD-SEC-003-focused.log`, `AUD-SEC-003-ticket.log`, `AUD-SEC-003-qa-review.md` and `.factory-results/latest-ticket.json`.
- **Delivery record:** 2026-10-22 — `PecAssetService` enables secure processing, forbids DOCTYPE, disables external entities/DTD loading and XInclude, denies external DTD/schema protocols, and rejects entity resolution without fallback. GPX input is limited to **10 MiB (10,485,760 bytes)** before DOM parsing and **64 XML element levels**; exact limits are accepted and one byte/level above is rejected. GPX SAX/coordinate errors return HTTP 400 with the fixed message `Ficheiro GPX invalido ou nao permitido.`, without raw parser/path details or default parser stderr. `PecAssetServiceXmlSecurityAuditTest` strengthens the original regression and adds adversarial/compatibility/limit tests; `TenantIsolationAuditTest` adds HTTP authorization, stable failure, persistence, recovery and JSON compatibility checks. Upload behavior is preserved: GPX files are stored inertly, with rejection when `/gps/track` parses them. QA: PASS; focused review: APPROVE WITH NOTES, no blocking findings. **TICKET_GATE: PASS. RELEASE_GATE: NOT_RUN.** Tested with Java 11.0.12 compiling for Java 8, H2 and local storage; native Java 8 execution, other JAXP providers, S3 and production data were not verified. New GPX limits are intentional compatibility restrictions; no frontend changes, global failure re-investigation, push, merge or deploy.

## AUD-SEC-004 — Bearer token is attached to external origins

- **Severity:** Medium
- **Description:** The Angular interceptor authenticates unrelated absolute URLs instead of limiting credentials to the configured API.
- **Evidence:** Reproduced on 2026-10-22 with a focused interceptor suite: 9 of 16 cases failed before correction, including a stored bearer attached to `https://third-party.invalid/telemetry`, protocol-relative/absolute third-party API paths and non-API URLs. The old substring exclusion also suppressed authentication for protected URLs whose query contained `/api/auth/login`. Log: `.factory-results/AUD-SEC-004-before.log`. Requests were intercepted by test handlers; no credentials were sent to external servers.
- **Acceptance criteria:** [x] Only trusted API requests receive the bearer token. [x] Login/register/offline behavior remains correct. [x] Relative and configured absolute API URLs are covered.
- **State:** RESOLVED
- **Verification:** VERIFIED
- **Tests:** From `frontend/`, `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless --include=src/app/modules/core/interceptors/auth.interceptor.spec.ts`: before correction, FAIL (9 failed, 7 passed). Final focused command adds `--include=src/app/modules/core/services/api.config.spec.ts --include=src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`: PASS, 47/47. With `FACTORY_TICKET_ID=AUD-SEC-004` and `QUALITY_TARGET_SPECS=src/app/modules/core/interceptors/auth.interceptor.spec.ts,src/app/modules/core/services/api.config.spec.ts,src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`, `node tools/run-quality-gate.mjs ticket AUTO`: PASS, automatically selected STANDARD, frontend + Factory; configuration, lint, typecheck, 47 targeted tests, 9 component integration tests and production build passed. E2E is a conditional SKIP, not an executed journey. Build warning: 610.78 kB versus 500 kB warning budget. `git diff --check`: PASS. Logs: `.factory-results/AUD-SEC-004-before.log`, `AUD-SEC-004-focused.log`, `AUD-SEC-004-focused-final.log`, `AUD-SEC-004-ticket.log`, `AUD-SEC-004-qa-review.md` and `.factory-results/latest-ticket.json`.
- **Delivery record:** 2026-10-22 — `api.config.ts` adds URL-based destination classification: trust same-origin `/api` proxy routes and the configured API origin/path, with exact scheme/host/port and path-segment boundaries. Malformed/non-HTTP URLs, userinfo, encoded path separators, foreign origins, wrong ports/schemes, path-prefix spoofs and invalid API configuration receive no stored bearer. `auth.interceptor.ts` injects only for classified API requests and exempts exact login/register paths (optional trailing slash); query strings cannot create a public-route exemption. Existing no-token/offline behavior and caller-supplied external credentials remain unchanged. Added `auth.interceptor.spec.ts` and `api.config.spec.ts` for adversarial destinations, configured base paths, relative URLs, real AuthService login/register/validation/offline lifecycle and media compatibility. One new test initially assumed a protocol-relative URL inherited the configured API's protocol; corrected it to verify the document protocol and require rejection on mismatch, preserving both positive and negative assertions. Original audit regressions remain unchanged. QA: PASS; focused review: APPROVE, no blocking findings. **TICKET_GATE: PASS. RELEASE_GATE: NOT_RUN.** Verified in Chrome Headless 155 with simulated HTTP; browser E2E, deployed proxy/configuration and real external network behavior were not verified. Global unit/audit failures were not re-investigated; no backend changes, push, merge or deploy.

## AUD-SEC-005 — Known test credentials are enabled by default

- **Severity:** High when an environment is exposed
- **Description:** Non-production-labelled deployments default to a known enabled test account while the server binds to all interfaces.
- **Evidence:** Reproduced on 2026-10-22 with the actual `application.properties` loaded into isolated Spring contexts: 23 of 27 tests failed before correction. The effective default flag was true; missing flags provisioned users outside narrowly recognized prod labels, explicit property-based enable in prod returned silently, and staging/unknown labels, exposed binds, active production profiles and missing explicit credentials were not rejected consistently. Log: `.factory-results/AUD-SEC-005-before.log`. No deployment was contacted.
- **Acceptance criteria:** [x] Test user is opt-in. [x] Unsafe exposed environments fail closed. [x] Production/staging configuration tests cover missing and explicit flags.
- **State:** RESOLVED
- **Verification:** VERIFIED
- **Tests:** Before: `mvn.cmd compiler:compile compiler:testCompile "-Dtest=TestUserBootstrapAuditTest" surefire:test`: FAIL, 23 failed / 4 passed. After correction: same command PASS, 38/38. Final `FACTORY_TICKET_ID=AUD-SEC-005`, `FACTORY_MAVEN_TESTS=TestUserBootstrapAuditTest,TestUserBootstrapPersistenceAuditTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest,PecAssetServiceXmlSecurityAuditTest`, `node tools/run-quality-gate.mjs ticket AUTO`: PASS, automatically selected STANDARD, backend + Factory; clean backend 57/57 (38 configuration, 1 H2 startup/persistence/login, 18 related security regressions), no failures/errors/skips, and Factory configuration passed. Matrix covers missing/false/invalid flags, Spring property and environment-variable opt-in, production/staging/preview/unknown labels, Railway overrides, active/default profiles, missing/weak credentials, exposed/unspecified/IPv4/IPv6 bind, no repository/profile interaction on rejection, BCrypt credentials, valid token, repeated bootstrap without duplicate accounts, and login. `git diff --check`: PASS. Logs: `.factory-results/AUD-SEC-005-before.log`, `AUD-SEC-005-focused.log`, `AUD-SEC-005-ticket.log`, `AUD-SEC-005-qa-review.md` and `.factory-results/latest-ticket.json`.
- **Delivery record:** 2026-10-22 — `application.properties` now defaults the test-user flag to false and removes default email/password. `TestUserBootstrap` requires a local environment allowlist (`local`, `dev`, `development`, `test`), compatible active/default Spring profiles, an explicit loopback bind and no Railway environment; unsafe opt-in fails before profile/user access, regardless of flag source. The effective disabled flag returns without persistence access. New `TestUserBootstrapAuditTest` and `TestUserBootstrapPersistenceAuditTest` cover configuration and real H2 persistence; `docs/test-user.md` records opt-in settings, deployment restrictions and existing-account handling. QA: PASS; focused review: APPROVE WITH NOTES, no blocking diff findings. **TICKET_GATE: PASS. RELEASE_GATE: NOT_RUN.** This fixes provisioning defaults and bootstrap configuration; it deliberately does not delete/deactivate existing accounts or revoke persisted tokens. Previously seeded accounts need explicit operational review/deactivation before exposure; no production data or deployment state was inspected or changed. A loopback service must not be exposed through a proxy/tunnel. Tests used Java 11.0.12 targeting Java 8 and local H2; native Java 8, PostgreSQL, deployed network/proxy and global release validation were not executed. No frontend changes, push, merge or deploy.

## AUD-SEC-006 — Tokens do not expire or revoke on logout

- **Severity:** High
- **Description:** Server validity is only token existence plus active user; logout removes local storage but leaves the server credential valid indefinitely.
- **Evidence:** Reproduced on 2026-10-22 with H2/MockMvc: legacy token without expiry received 200 instead of 401, and POST logout received 404 instead of 204 (2 failures / 3 backend tests). Angular logout made no revocation HTTP request (1 failing test). Logs: `.factory-results/AUD-SEC-006-backend-before.log` and `AUD-SEC-006-frontend-before.log`. Existing login rotation passed before the change and is preserved.
- **Acceptance criteria:** [x] Tokens have enforced expiry. [x] Logout revokes the active credential. [x] Expired/revoked/rotated token tests fail closed.
- **State:** RESOLVED
- **Verification:** VERIFIED
- **Tests:** Backend reproduction: `mvn.cmd compiler:compile compiler:testCompile "-Dtest=AuthTokenLifecycleAuditTest" surefire:test`: FAIL, 2/3. Frontend reproduction from `frontend/`: `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless --include=src/app/modules/core/services/auth.service.spec.ts`: FAIL, 1/1. Focused after: backend 21/21; Angular 59/59. Final `FACTORY_TICKET_ID=AUD-SEC-006`, `FACTORY_MAVEN_TESTS=AuthTokenLifecycleAuditTest,AuthTokenSettingsAuditTest,AuthTokenSchemaUpgradeAuditTest,TestUserBootstrapAuditTest,TestUserBootstrapPersistenceAuditTest,TenantIsolationAuditTest,ApiAuthInterceptorAuditTest,PecAssetServiceXmlSecurityAuditTest`, `QUALITY_TARGET_SPECS=src/app/modules/core/services/auth.service.spec.ts,src/app/modules/core/guards/auth.guard.spec.ts,src/app/modules/core/shared/components/sidebar/sidebar.component.spec.ts,src/app/modules/core/interceptors/auth.interceptor.spec.ts,src/app/modules/core/services/api.config.spec.ts,src/app/modules/features/pecs/pecs-editor/pecs-editor.component.spec.ts`, `node tools/run-quality-gate.mjs ticket AUTO`: PASS, automatically selected STANDARD for backend + frontend + Factory. Clean backend 69/69, targeted Angular 59/59, component integration 11/11, Factory config, lint, typecheck and production build passed. E2E is a conditional SKIP (no harness); build warning is 612.00 kB versus 500 kB warning budget. `git diff --check`: PASS. Evidence: `.factory-results/AUD-SEC-006-ticket.log`, `AUD-SEC-006-qa-review.md`, focused/before logs and `.factory-results/latest-ticket.json`.
- **Delivery record:** 2026-10-22 — `AuthUserEntity` persists nullable epoch-millisecond expiry; `AuthService` issues bounded tokens on login/service registration and checks active user plus non-null future expiry on every authentication path, using injectable UTC Clock. TTL defaults to 28800 seconds (8h), configurable with positive, non-overflowing `RECCE_AUTH_TOKEN_TTL_SECONDS`. `AuthUserRepository` atomically revokes only the supplied current token by clearing expiry; stale logout cannot revoke a rotated login. `AuthController` adds idempotent POST logout (bearer supplied: 204; absent/malformed header: 401), with no-store on login/validate/logout; public beta registration remains disabled. Angular AuthService waits for server acknowledgement before clearing local credentials, reports failure/10s timeout with retry credentials retained, handles offline-only logout locally and protects newer sessions from old responses. Guard/sidebar validation callbacks also bind logout to the session that failed validation. Test bootstrap does not grant an authenticated token and invalidates an earlier session on reprovisioning; existing tenant fixtures now explicitly seed bounded sessions, while dedicated tests reject legacy null-expiry tokens. Added lifecycle, settings, old-schema H2 upgrade, UI failure/retry/offline/race tests, plus `docs/auth-sessions.md` and updated test-user documentation. QA: PASS; focused review: APPROVE WITH NOTES, no blocking findings. **TICKET_GATE: PASS. RELEASE_GATE: NOT_RUN.** Old persisted tokens are intentionally rejected until fresh login; nullable BIGINT schema addition was verified with Hibernate update on an old H2 schema, not PostgreSQL/production. Externally managed schemas need the documented column change before rollout. No actual deployments, browser E2E, native Java 8 or multi-process race tests were executed; server clocks need synchronization. An online logout without confirmation is not reported as successful; a request already authorized before revocation is not cancelled retroactively. No unrelated baseline investigation, push, merge or deploy.

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

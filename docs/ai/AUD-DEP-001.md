# AUD-DEP-001 — Dependency advisory triage

Observation: 2026-10-23. Scope: frontend npm lockfile; Maven dependencies were not assessed. Counts are affected npm package entries (including inherited findings), not unique exploits. Original audit: 4 critical, 51 high, 22 moderate, 4 low. Historical baseline had 24 moderate; the fresh response changed that count. Final full audit: 0 critical, 15 high, 4 moderate, 0 low. Final omit-dev audit: zero findings. Full audit remains failing.

## Decision and boundaries

Angular 17 cannot be fixed within its existing major range. Angular 20.3 is the nearest currently supported major outside the affected runtime ranges; framework packages resolve to 20.3.34, CLI/build tooling to 20.3.41, TypeScript to 5.8.3 and Zone.js to 0.15.1. Node 22 is used in CI and documented locally (minimum compatible Node 20: 20.19.0). [Angular compatibility](https://angular.dev/reference/versions). No forced/legacy peer resolution, advisory exclusion, production-only gate substitution or modified security thresholds.

A clean temporary resolver was needed because npm rejected the stale Angular 17 peer tree. The generated v2 lockfile was then installed in frontend with npm ci. Direct dependency ranges unrelated to this fix were preserved; transitive versions were resolved within their supported ranges. The single override is webpack-dev-middleware ^7.4.6, a patch within the 7.x API required by both installed consumers. [Maintainer advisory](https://github.com/webpack/webpack-dev-middleware/security/advisories/GHSA-g84c-rxfj-3j2c). No business code was changed. One GPS test fixture implements toJSON required by the upgraded DOM typings, without changing its assertions or GPS data.

## Reachability evidence

- R1: app.config.ts uses provideRouter/provideHttpClient/provideServiceWorker without hydration or transfer cache. angular.json builds a browser application; server.mjs is a Node built-in static file server, without Angular SSR or npm package imports. Router SSR/transfer-cache/hydration vectors were not found in this checkout.
- R2: templates and source were searched for i18n, innerHTML, bypassSecurityTrust, dynamic template/namespace APIs. No matching production sinks were found. SVG drawings exist with explicit bindings. This limits demonstrated exploitability; it is not proof that the framework vulnerabilities are harmless. Framework/compiler packages were upgraded rather than waived.
- R3: number pipes in team-profile, recce-mode and pecs-editor use constant digitsInfo strings. Offline dates use the component's native date helper, not Angular formatDate/DatePipe. No attacker-controlled Angular format strings were found.
- R4: app.config.ts enables the production service worker. ngsw-config.json caches app/assets, with no dataGroups. The request forwarding boundary exists; cross-origin redirect handling was fixed by the framework update, but no live service-worker redirect exploit was executed.
- R5: auth.interceptor.ts and API services construct HttpClient requests. XSRF/URL handling remains a relevant framework boundary; existing bearer-origin regressions are exercised. No live XSRF-cookie exploit was performed.
- D: tooling entries are marked dev in the lock and are absent from the omit-dev audit. CLI/install/build inputs can be untrusted (archives, CSS/globs, workspace content); Karma/Vite/webpack servers can expose developer endpoints when run. These are developer/CI risks, not production request handlers in server.mjs. No arbitrary archives, code-execution or denial-of-service payloads were run against shared services.

## Every original critical/high advisory

50 unique advisory IDs, covering 54 distinct package/advisory pairs. Individual affected ranges and paths are preserved in .factory-results/AUD-DEP-001-audit-before.json and AUD-DEP-001-triage-before.jsonl. 'Cleared' means absent from the final audit after updating/removing the affected version, not an exploit test or a waiver.

| Advisory | Packages | Severity | Reachability assessment | Final disposition |
| --- | --- | --- | --- | --- |
| [GHSA-58c5-g7wp-6w37](https://github.com/advisories/GHSA-58c5-g7wp-6w37) — Angular is Vulnerable to XSRF Token Leakage via Protocol-Relative URLs in Angular HTTP Client | @angular/common | high | HttpClient request boundary present; exploit not reproduced (R5) | Cleared in final audit |
| [GHSA-48r7-hpm6-gfxm](https://github.com/advisories/GHSA-48r7-hpm6-gfxm) — @angular/common: Denial of Service (DoS) via OOM in Date Formatting (formatDate) | @angular/common | high | No Angular formatDate/DatePipe call found (R3) | Cleared in final audit |
| [GHSA-39pv-4j6c-2g6v](https://github.com/advisories/GHSA-39pv-4j6c-2g6v) — @angular/common: Weak 32-Bit Cache Key Hashing in `HttpTransferCache` Leading to Cross-Request Data Leakage and State Poisoning | @angular/common | high | SSR/hydration/transfer cache absent (R1) | Cleared in final audit |
| [GHSA-p3vc-36g9-x9gr](https://github.com/advisories/GHSA-p3vc-36g9-x9gr) — @angular/common: Denial of Service (DoS) via OOM in Number Formatting (digitsInfo) | @angular/common | high | Number pipes use constant format strings (R3) | Cleared in final audit |
| [GHSA-q6f4-qqrg-jv6x](https://github.com/advisories/GHSA-q6f4-qqrg-jv6x) — @angular/common: Information Leak via Default Caching of Credentialed Requests in HttpTransferCache | @angular/common | high | SSR/hydration/transfer cache absent (R1) | Cleared in final audit |
| [GHSA-jhpw-976m-542j](https://github.com/advisories/GHSA-jhpw-976m-542j) — Angular: Cache-Key Ambiguity in HttpTransferCache Leading to Cross-Request Response Reuse and State Poisoning | @angular/common | high | SSR/hydration/transfer cache absent (R1) | Cleared in final audit |
| [GHSA-g93w-mfhg-p222](https://github.com/advisories/GHSA-g93w-mfhg-p222) — Angular vulnerable to XSS in i18n attribute bindings | @angular/compiler, @angular/core | high | No i18n template attributes/catalogues found (R2) | Cleared in final audit |
| [GHSA-jrmj-c5cx-3cw6](https://github.com/advisories/GHSA-jrmj-c5cx-3cw6) — Angular has XSS Vulnerability via Unsanitized SVG Script Attributes | @angular/compiler, @angular/core | high | Template sanitization boundary; exploit vector not demonstrated (R2) | Cleared in final audit |
| [GHSA-v4hv-rgfq-gp49](https://github.com/advisories/GHSA-v4hv-rgfq-gp49) — Angular Stored XSS Vulnerability via SVG Animation, SVG URL and MathML Attributes | @angular/compiler | high | Template sanitization boundary; exploit vector not demonstrated (R2) | Cleared in final audit |
| [GHSA-jj27-h5hq-8x99](https://github.com/advisories/GHSA-jj27-h5hq-8x99) — Angular i18n: Cross-Site Scripting (XSS) via event-handler attributes | @angular/compiler, @angular/core | high | No i18n template attributes/catalogues found (R2) | Cleared in final audit |
| [GHSA-prjf-86w9-mfqv](https://github.com/advisories/GHSA-prjf-86w9-mfqv) — Angular i18n vulnerable to Cross-Site Scripting | @angular/core | high | No i18n template attributes/catalogues found (R2) | Cleared in final audit |
| [GHSA-rgjc-h3x7-9mwg](https://github.com/advisories/GHSA-rgjc-h3x7-9mwg) — Angular Client Hydration DOM Clobbering & Response-Cache Poisoning | @angular/core | high | SSR/hydration/transfer cache absent (R1) | Cleared in final audit |
| [GHSA-ff3f-86qr-9cv3](https://github.com/advisories/GHSA-ff3f-86qr-9cv3) — Angular Server-Side Rendering (SSR): Denial of Service via Numeric URL Matrix Parameters | @angular/router | high | SSR/hydration/transfer cache absent (R1) | Cleared in final audit |
| [GHSA-62vg-58rm-qff7](https://github.com/advisories/GHSA-62vg-58rm-qff7) — @angular/router: Denial of Service via Unmatched Empty-Path Outlet Route Matching in Server-Side Rendering (SSR) | @angular/router | high | SSR/hydration/transfer cache absent (R1) | Cleared in final audit |
| [GHSA-qxh6-94w6-9r5p](https://github.com/advisories/GHSA-qxh6-94w6-9r5p) — @angular/service-worker: Sensitive Header Leakage on Cross-Origin Redirects in Angular Service Worker | @angular/service-worker | high | Production service worker enabled; header/redirect boundary present (R4) | Cleared in final audit |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) — brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion | brace-expansion | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) — brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion | brace-expansion | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — braces vulnerable to stack-exhaustion denial of service through deeply nested patterns | braces | high | Development/build/test only (D); no production import | OPEN; no patched release |
| [GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95) — compression vulnerable to Denial of Service via memory leak on premature response close | compression | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-2gc4-cqfq-p2gv](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv) — Socket.IO: Engine.IO Protocol Revision Mismatch DoS | engine.io | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8) — follow-redirects array-form headers bypass cross-origin credential stripping | follow-redirects | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-8r9p-f939-6h3c](https://github.com/advisories/GHSA-8r9p-f939-6h3c) — follow-redirects sensitiveHeaders regex escaping can expose credential headers | follow-redirects | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) — http-cache-semantics max-stale handling can disclose cross-user cached responses | http-cache-semantics | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) — js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources | js-yaml | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) — launch-editor: `fs.existsSync()` existence check can be bypassed on Windows | launch-editor, vite | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — nanoid: custom generators can loop indefinitely when size is zero | nanoid | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) — node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements | node-forge | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-w4pp-8pjf-rmxw](https://github.com/advisories/GHSA-w4pp-8pjf-rmxw) — pacote is vulnerable to Denial of Service (DoS) via the addGitSha function | pacote | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) — Picomatch has a ReDoS vulnerability via extglob quantifiers | picomatch | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-x9g3-xrwr-cwfg](https://github.com/advisories/GHSA-x9g3-xrwr-cwfg) — piscina: Prototype Pollution Gadget → RCE via inherited options.filename | piscina | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-67c8-pqhq-4rmx](https://github.com/advisories/GHSA-67c8-pqhq-4rmx) — piscina: Prototype-pollution gadget in ThreadPool.options allows RCE via execArgv / loadBalancer / env | piscina | critical | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) — PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments | postcss | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure | postcss | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) — proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet | proxy-addr | critical | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) — Serialize JavaScript is Vulnerable to RCE via RegExp.flags and Date.prototype.toISOString() | serialize-javascript | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) — shell-quote: `quote()` command injection via a line terminator in a token after a `{ comment }` token | shell-quote | critical | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-52v5-jr5w-gjxr](https://github.com/advisories/GHSA-52v5-jr5w-gjxr) — sigstore's `certificateOIDs` verification constraints are silently dropped and never enforced | sigstore | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) — source-map-js allows event-loop denial of service through indexed source-map section offsets | source-map-js | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) — node-tar Vulnerable to Arbitrary File Creation/Overwrite via Hardlink Path Traversal | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) — node-tar is Vulnerable to Arbitrary File Overwrite and Symlink Poisoning via Insufficient Path Sanitization | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx) — Arbitrary File Read/Write via Hardlink Target Escape Through Symlink Chain in node-tar Extraction | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) — tar has Hardlink Path Traversal via Drive-Relative Linkpath | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256) — node-tar Symlink Path Traversal via Drive-Relative Linkpath | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) — Race Condition in node-tar Path Reservations via Unicode Ligature Collisions on macOS APFS | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw) — node-tar: Decompression/parse DoS via unlimited input | tar | critical | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-8x88-c5mf-7j5w](https://github.com/advisories/GHSA-8x88-c5mf-7j5w) — node-tar: Negative tar entry size causes infinite loop in archive replace | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) — node-tar: Uncontrolled recursion in mapHas/filesFilter allows uncatchable stack-overflow DoS via crafted long-path tar with member selection | tar | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65) — tmp has Path Traversal via unsanitized prefix/postfix that enables directory escape | tmp | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) — vite: `server.fs.deny` bypass on Windows alternate paths | vite | high | Development/build/test only (D); no production import | Cleared in final audit |
| [GHSA-g84c-rxfj-3j2c](https://github.com/advisories/GHSA-g84c-rxfj-3j2c) — webpack-dev-middleware vulnerable to Path Traversal via non-slash-terminated publicPath | webpack-dev-middleware | high | Development/build/test only (D); no production import | Cleared in final audit |

## Affected package entries, including inherited findings

| Package | Original versions | Exposure | Final high/critical status |
| --- | --- | --- | --- |
| @angular-devkit/build-angular | 17.3.17 | D | high; inherited braces risk except braces itself |
| @angular-devkit/core | 17.3.17 | D | Cleared |
| @angular/cli | 17.3.17 | Framework; see R1–R5 | Cleared |
| @angular/common | 17.3.12 | Framework; see R1–R5 | Cleared |
| @angular/compiler | 17.3.12 | Framework; see R1–R5 | Cleared |
| @angular/compiler-cli | 17.3.12 | Framework; see R1–R5 | Cleared |
| @angular/core | 17.3.12 | Framework; see R1–R5 | Cleared |
| @angular/router | 17.3.12 | Framework; see R1–R5 | Cleared |
| @angular/service-worker | 17.3.12 | Framework; see R1–R5 | Cleared |
| @npmcli/run-script | 7.0.4 | D | Cleared |
| @parcel/watcher | 2.5.1 | D | high; inherited braces risk except braces itself |
| @sigstore/sign | 2.3.2 | D | Cleared |
| @sigstore/tuf | 2.3.4 | D | Cleared |
| @tailwindcss/cli | 4.3.3 | D | high; inherited braces risk except braces itself |
| brace-expansion | 2.1.4, 1.1.18 | D | Cleared |
| braces | 3.0.3 | D | high; inherited braces risk except braces itself |
| cacache | 18.0.4 | D | Cleared |
| chokidar | 3.6.0 | D | high; inherited braces risk except braces itself |
| compression | 1.8.1 | D | Cleared |
| copy-webpack-plugin | 11.0.0 | D | Cleared |
| engine.io | 6.6.9 | D | Cleared |
| fast-glob | 3.3.2 | D | high; inherited braces risk except braces itself |
| follow-redirects | 1.16.0 | D | Cleared |
| globby | 13.2.2 | D | Cleared |
| http-cache-semantics | 4.2.0 | D | Cleared |
| http-proxy-middleware | 2.0.8 | D | high; inherited braces risk except braces itself |
| js-yaml | 4.3.1, 3.15.1 | D | Cleared |
| karma | 6.4.4 | D | high; inherited braces risk except braces itself |
| karma-jasmine | 5.1.0 | D | high; inherited braces risk except braces itself |
| karma-jasmine-html-reporter | 2.1.0 | D | high; inherited braces risk except braces itself |
| launch-editor | 2.14.1 | D | Cleared |
| make-fetch-happen | 13.0.1 | D | Cleared |
| micromatch | 4.0.8 | D | high; inherited braces risk except braces itself |
| nanoid | 3.3.17 | D | Cleared |
| node-forge | 1.4.0 | D | Cleared |
| node-gyp | 10.3.1 | D | Cleared |
| npm-registry-fetch | 16.2.1 | D | Cleared |
| pacote | 17.0.6 | D | Cleared |
| picomatch | 4.0.1 | D | Cleared |
| piscina | 4.4.0 | D | Cleared |
| postcss | 8.4.35 | D | Cleared |
| proxy-addr | 2.0.7 | D | Cleared |
| sass | 1.71.1 | D | Cleared |
| selfsigned | 2.4.1 | D | Cleared |
| serialize-javascript | 6.0.2 | D | Cleared |
| shell-quote | 1.10.0 | D | Cleared |
| sigstore | 2.3.1 | D | Cleared |
| source-map-js | 1.2.1 | D | Cleared |
| tailwindcss | 3.4.19 | D | high; inherited braces risk except braces itself |
| tar | 6.2.1 | D | Cleared |
| tmp | 0.0.33 | D | Cleared |
| tuf-js | 2.2.1 | D | Cleared |
| vite | 5.4.21 | D | Cleared |
| webpack-dev-middleware | 6.1.2, 5.3.4 | D | Cleared |
| webpack-dev-server | 4.15.1 | D | high; inherited braces risk except braces itself |

## Residual risks — not accepted

Accountable role proposed for follow-up: repository frontend/toolchain maintainer; no named owner or risk acceptance is inferred. Acceptance remains pending. The ticket cannot be marked resolved while the security check fails.

- High: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces <=3.0.3. The current latest published release is 3.0.3 and the advisory lists no patched version. Recursive glob/brace patterns can exhaust the Node process stack. Reachable through developer-controlled build/watch/test glob inputs, not an imported production dependency. Fifteen affected package entries inherit this one remaining high advisory. Upgrading Angular further does not remove Karma/Tailwind dependencies on braces. Downgrading Karma as suggested by npm is not a compatible fix; neither forcing peers nor disguising a vulnerable package is acceptable. Keep developer servers local and avoid untrusted workspace/glob inputs; these are mitigations, not a patch or accepted waiver.
- Moderate: postcss-selector-parser <7.1.6 (via Tailwind 3/postcss-nested) and uuid <11.1.1 (via sockjs/webpack-dev-server), four affected entries total. Build-time selector parsing / development server UUID paths; absent from the omit-dev audit. Major overrides/migration of CSS or socket tooling were not imposed to clear a report; follow-up belongs to the same toolchain maintainer. No acceptance is recorded.

## Verification record

Detailed command output is under .factory-results/AUD-DEP-001-*.json/log. See ISSUES.md for final gate results and .factory-results/AUD-DEP-001-qa-review.md for executed validation and review. The security gate continues to inspect the complete lockfile. No push, merge or deploy was performed; no production environment was changed.

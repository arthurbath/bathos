# Dependency Security Refresh Evaluation

**Date:** 2026-08-08
**Category:** Security / Dependency Maintenance
**OpenSpec Change:** `refresh-august-2026-dependency-security-baseline`

## Outcome

Completed. The approved high-priority and update-soon dependency set is patched and aligned without a major-version migration. Root audit exposure fell from 31 package nodes, including 28 high-severity nodes, to four lower-severity nodes with no credible BathOS runtime reachability. The isolated PowerSync spike now audits cleanly. Complete web, synchronization, Edge, native, browser, and performance regression checks found no user-facing regression attributable to the refresh.

## Scope

This phase applies the BathOS findings from the August 8 weekly dependency assessment. It covers the root npm graph, the isolated PowerSync spike, exact Supabase browser and Edge dependency evidence, and the repository Node runtime policy. It does not authorize an unrelated major upgrade, forced audit remediation, Edge deployment, database or RLS change, migration, secret change, or production-data mutation.

## Baseline

| Surface | Installed | Finding Or Robustness Gap | Target |
|---|---:|---|---:|
| Root `js-yaml` through `@eslint/eslintrc` | 4.3.0 | GHSA-5p4m-2wfm-xmqj, quadratic CPU consumption while resolving attacker-controlled `!!omap`; ESLint parses developer-controlled configuration in BathOS | 4.3.1 |
| Root Nano ID through PostCSS | 3.3.16 | GHSA-2v37-7h3g-55p8, zero-size custom generators can loop indefinitely; BathOS does not pass user-controlled sizes to this build dependency | 3.3.18 |
| Root PostCSS | 8.5.25 | Owner of the affected Nano ID node; compatible patch also advances its minimum Nano ID range | 8.5.26 |
| Spike PostCSS through Vite | 8.5.20 | GHSA-fxqj-rqcc-2cmp file disclosure requires attacker-controlled CSS and an unset `from`; the spike processes repository CSS only | compatible patched 8.5.x |
| Spike Nano ID through PostCSS | 3.3.16 | GHSA-2v37-7h3g-55p8 on a development-only build path | 3.3.18 |
| Root Supabase JS and Auth | 2.112.0 | Two-patch maintenance gap | exact 2.112.2 |
| Hand-maintained and generated Edge Supabase JS | 2.112.0 | Must remain aligned to one reviewed exact version | exact 2.112.2 |
| PowerSync spike Supabase JS | 2.110.7 | Stale exact pin relative to the accepted browser and Edge baseline | exact 2.112.2 |
| Node policy | no manifest floor | Supabase JS 2.112.2 requires Node 22 or newer; the repository does not enforce it | `>=22.0.0`, local Node 24 LTS pin |

The root audit initially reports 31 package nodes: zero critical, 28 high, two moderate, and one low. Those counts are ownership propagation, not 31 distinct vulnerabilities. The spike reports four package nodes: two high and two moderate, representing the Nano ID and PostCSS advisories propagated through Vite and its React plugin.

## Compatibility And Security Invariants

- Use only versions admitted by existing owner ranges or explicitly approved direct patch targets. Do not use `npm audit fix --force` or an out-of-range override.
- Preserve browser session restoration, bounded GET/HEAD retry, mutation non-replay, offline queue and convergence behavior, Edge authorization and method boundaries, and generated MCP determinism.
- Keep all Supabase packages exact and aligned. Supabase JS 2.112.2 declares Node `>=22.0.0` and exact 2.112.2 Auth, Functions, PostgREST, Realtime, and Storage dependencies.
- Keep production and remote Supabase systems unchanged. Every Edge check in this phase is local.
- Preserve residual Lovable MCP findings only if their vulnerable Windows-specific static or development-server paths remain unreachable and the owner still offers no compatible patched graph.

## Official Evidence

- [Supabase changelog](https://supabase.com/changelog?tags=javascript) records the Node 20 support removal for Supabase JavaScript clients. No 2.112.0 to 2.112.2 breaking change relevant to BathOS was identified.
- [Node.js release policy](https://github.com/nodejs/Release) lists Node 24 as Active LTS through October 2026 and supported through April 2028.
- [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) identifies js-yaml 4.3.1 as the fixed release.
- [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) identifies Nano ID 3.3.17 as the first fixed release; the current registry patch is 3.3.18.
- [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) identifies PostCSS 8.5.23 as the first fixed 8.x release.

## Post-Change Dependency And Advisory Evidence

- Root Supabase JS and Auth, all hand-maintained Edge maps, generated MCP source, and the PowerSync spike now use exact 2.112.2. Root and spike dependency trees resolve the matching Supabase family at 2.112.2.
- Root and spike PostCSS resolve to 8.5.26, Nano ID resolves to 3.3.18, and root js-yaml resolves to 4.3.1. Fresh checks no longer contain GHSA-5p4m-2wfm-xmqj, GHSA-2v37-7h3g-55p8, or GHSA-fxqj-rqcc-2cmp.
- A clean temporary root install resolved 732 packages, passed `npm ls --all`, and verified 732 registry signatures and 88 attestations. A clean spike install resolved 48 packages and passed its dependency-tree check.
- The final root audit reports four package nodes: zero critical, zero high, three moderate, and one low. These reduce to two underlying Lovable MCP development-tool advisories: Hono path traversal, GHSA-frvp-7c67-39w9, propagated across three owner nodes, and a nested esbuild Windows development-server file-read issue, GHSA-g7r4-m6w7-qqqr. BathOS does not run the Lovable MCP server in the shipped application, the esbuild condition is Windows-specific, and no compatible owner update removes either finding. They remain accepted, unreachable development-tool risk.
- The final spike audit reports zero vulnerabilities.
- Reminder and widget Deno lock regeneration was deterministic. Repeated outputs retained SHA-256 hashes `20a4fccd31e32eb436829eb8c3e28337680e4ea40283f6b4f29034ce17e94265` and `9da2160c37f7bcacaf19a9184843f98e252ba80f91e636a4b01071644b2f7108`, respectively. Repeated MCP generation retained SHA-256 `b7369bb84d5e51b27b78a37ae0e405a514c0b451b956bf7881b3d30ddbd1308c`.

## Regression Evidence

- The complete Vitest run passed 192 files and 1,579 tests. Nine integration or performance files containing 17 tests remained intentionally gated and were exercised separately where applicable.
- `npm run typecheck:tasks`, `npm run lint`, development and production builds, root and spike `npm ls --all`, strict OpenSpec validation, and `git diff --check` passed. Lint retained one pre-existing Fast Refresh warning and no errors.
- Hand-maintained Edge Function typechecks, the 13.2 MB Tasks Edge bundle check, and all-function local HTTP startup checks passed across ten functions. The expected unauthenticated reminder request returned method rejection rather than executing protected work.
- The restored disposable PowerSync harness passed offline persistence, multi-client convergence, preservation/recovery, and a ten-minute sustained run: 300 cycles, 300 tasks, 1,050 history records, 150 offline conflicts, 150 stale MCP conflicts, 300 capture retries, 300 transition retries, and 12 service restarts.
- macOS and iOS native test targets each passed all 61 tests. The iOS run covered the app, widget, and watch targets in a dedicated simulator.
- An authenticated local browser smoke created a task through the normal Return-key workflow and independently read the exact revision-one row back from Postgres with the expected Today, Now, and Anytime state. Local signup notification delivery returned a configuration-only 500 because the disposable stack lacks the external email-service secret; authentication, Tasks startup, persistence, and synchronization were unaffected.
- Disposable test accounts, replication fixtures, containers, volumes, networks, simulator state, and temporary build or benchmark artifacts were removed after verification. No remote Supabase system, Edge Function, database, native container, or web deployment was changed.

## Performance Comparison

Ten alternating cold samples per version and three production builds per version compared untouched `HEAD` with the final dependency graph. Mean 100-row practical rendering changed from 191.54 ms to 193.63 ms, a 1.1% increase. Mean 1,000-row stress rendering changed from 1,961.57 ms to 1,983.93 ms, a 1.1% increase. Mean Quick Find over 10,000 tasks changed from 954.25 ms to 972.49 ms, a 1.9% increase. Mean production build time improved from 6,072.75 ms to 6,008.16 ms, a 1.1% decrease. JavaScript output increased by 808 uncompressed bytes and 229 gzip bytes, both below 0.1%.

Two isolated updated search-index outliers in the first comparison did not reproduce. A follow-up 20-pair alternating run produced a lower updated mean, 10.66 ms versus 11.67 ms, and lower updated maximum, 33.69 ms versus 36.51 ms. Neither version exceeded 100 ms. The pre-existing two-second 1,000-row stress threshold and one-second 10,000-task dialog threshold remain noisy near their boundaries in both graphs. The repeated averages do not indicate serious performance degradation, so no performance repair is justified by this refresh.

## Residual Risk And Rollback

The two remaining underlying advisories are confined to an unused Lovable MCP development-tool path and have no credible production, browser, Edge, native, or local synchronization reachability. They should remain visible in weekly audits and be removed when the owner publishes a compatible fixed graph. The stale Browserslist-data and large-chunk build warnings are unchanged maintenance observations, not regressions from this package refresh.

If an unobserved compatibility issue appears, the rollback unit is the root and spike manifests and locks, `.nvmrc`, Edge maps and locks, generated MCP source, dependency-pin tests, and the corresponding durable specifications. No database, deployed-function, or production-data rollback is required because this work made no remote or schema mutation.

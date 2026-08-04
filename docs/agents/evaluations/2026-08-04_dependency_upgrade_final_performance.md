# Dependency Upgrade Final Performance Assessment

**Date:** 2026-08-04
**Category:** Performance / Dependency Maintenance
**Conclusion:** No serious average degradation

## Decision

The completed dependency upgrade does not meet the program's definition of serious performance degradation. Repeated equivalent runs show that the final state is neutral or faster on the user-facing Tasks metrics, produces slightly less total JavaScript, and is modestly faster across matched Safari module-route samples. The one consistent regression is a 4 to 5 percent production build-time increase, which is minor and not user-facing.

The temporary performance waiver therefore expires with this assessment. Future changes are again subject to the durable performance gates.

## Compared States

| State | Source | Package-lock SHA-256 |
| --- | --- | --- |
| Baseline | `aebfe908605893d29e3d7d982a02cc21bcbf128d`, immediately before the dependency-hardening program | `d1e222dc85d0c575ad1173bc80a23b20bb19673f4100589213a0bf916cbf00cf` |
| Final | Current working state based on `26dde69e8e5005e8d53d3f72b7ceb5f69c878995`, including the Supabase browser and Edge phases | `df052af8956322d0ffebd985bb5e6f557091fbbf53369c82a7eaddcf44e00f0f` |

Both states used isolated temporary trees and clean `npm ci` installations. The identical performance test instrumentation was copied to the baseline so the package graphs, not test behavior, differed. Runs alternated baseline and final order to reduce time-order bias.

Host conditions were macOS 27.0 on a 10-core Apple M4 with 16 GiB RAM and Node 24.12.0. Host load averages moved from approximately 7.34 to 5.37 during the paired suite, with 1.4 to 1.5 GiB free memory. This is a contended environment, so the assessment emphasizes repeated paired results rather than individual wall-clock samples.

## Cold Tasks Performance Suite

Each revision ran in ten fresh serial Vitest processes. For the derivation and text metrics, each cold-run sample is that test's internally measured p95. The table then summarizes those ten cold-run samples. Pass frequency uses the durable ceiling for that metric.

| Metric | Baseline mean / median / p95 | Final mean / median / p95 | Baseline range | Final range | Final mean / median change | Pass frequency baseline -> final |
| --- | --- | --- | --- | --- | --- | --- |
| Today view, 10,000 records | 0.45 / 0.40 / 1.03 ms | 0.41 / 0.39 / 0.66 ms | 0.28-1.03 | 0.29-0.66 | -9.8% / -2.5% | 10/10 -> 10/10 |
| Upcoming view, 10,000 records | 63.24 / 61.32 / 83.95 ms | 65.10 / 69.02 / 74.42 ms | 57.82-83.95 | 57.89-74.42 | +2.9% / +12.6% | 10/10 -> 10/10 |
| Anytime view, 10,000 records | 0.42 / 0.38 / 0.97 ms | 0.39 / 0.40 / 0.57 ms | 0.26-0.97 | 0.29-0.57 | -6.4% / +5.3% | 10/10 -> 10/10 |
| Someday view, 10,000 records | 0.52 / 0.43 / 0.97 ms | 0.49 / 0.40 / 1.02 ms | 0.31-0.97 | 0.28-1.02 | -6.2% / -7.0% | 10/10 -> 10/10 |
| Done view, 10,000 records | 2.67 / 2.54 / 3.59 ms | 2.64 / 2.56 / 3.10 ms | 2.44-3.59 | 2.47-3.10 | -1.0% / +0.8% | 10/10 -> 10/10 |
| Search-index construction | 10.31 / 9.32 / 17.64 ms | 11.48 / 11.19 / 19.59 ms | 8.08-17.64 | 8.06-19.59 | +11.4% / +20.1% | 10/10 -> 10/10 |
| Indexed text filtering | 0.40 / 0.40 / 0.46 ms | 0.42 / 0.38 / 0.57 ms | 0.37-0.46 | 0.37-0.57 | +4.0% / -5.0% | 10/10 -> 10/10 |
| Tasks-shell render, 1,000 rows | 2,202.51 / 2,138.44 / 2,619.01 ms | 2,109.01 / 2,109.91 / 2,202.81 ms | 2,044.89-2,619.01 | 1,992.66-2,202.81 | -4.2% / -1.3% | 0/10 -> 1/10 |
| Open Quick Find, 10,000 records | 1,164.67 / 1,122.31 / 1,838.38 ms | 1,070.19 / 1,075.75 / 1,127.70 ms | 1,041.38-1,838.38 | 1,031.21-1,127.70 | -8.1% / -4.1% | 0/10 -> 0/10 |
| Practical Tasks render, 100 rows | 217.44 / 211.38 / 254.55 ms | 215.82 / 217.14 / 233.32 ms | 200.78-254.55 | 202.27-233.32 | -0.7% / +2.7% | No durable ceiling |

The two-second threshold is only the synthetic JSDOM time to construct and synchronously render 1,000 complete Tasks rows. It is not an application-load threshold. The baseline breached it in every sample, while the final graph passed once and was 4.2 percent faster on average. This is existing nonvirtualized linear DOM cost, not a dependency-upgrade regression.

Quick Find similarly breached its one-second synthetic ceiling in both revisions, but improved by 8.1 percent on average. Search-index construction regressed moderately in percentage terms, but remained between 8 and 20 ms and passed its 100 ms ceiling in every run. It is not a serious or currently user-visible regression.

## Production Build

Three alternating clean-output builds ran per revision.

| Metric | Baseline | Final | Change |
| --- | --- | --- | --- |
| Build time, mean / median / p95 | 5.24 / 5.21 / 5.54 s | 5.46 / 5.49 / 5.91 s | +4.1% mean, +5.4% median |
| Total emitted JavaScript | 2,850,144 bytes | 2,830,623 bytes | -0.7% |
| Total emitted JavaScript, gzip | 814,014 bytes | 811,995 bytes | -0.2% |
| Main application chunk | 1,451,869 bytes, 410,418 gzip | 1,481,180 bytes, 422,110 gzip | +2.0%, +2.8% gzip |
| Tasks chunk | 668,364 bytes, 185,409 gzip | 649,335 bytes, 181,361 gzip | -2.8%, -2.2% gzip |
| Tasks Markdown chunk | 14,883 bytes, 4,965 gzip | 14,430 bytes, 4,844 gzip | -3.0%, -2.4% gzip |

The main-chunk increase is consistent with the newer browser Supabase client, while Vite 7 produced smaller Tasks and SQLite-support chunks. Because total JavaScript and the route-specific Tasks chunks are smaller, the main-chunk increase does not establish a net loading regression.

## Safari Development and Preview

Safari sampled authentication routing, launcher navigation, and every registered module route three times in local development and production-preview builds. A disposable local user isolated the runs from production. The accessibility readiness probe imposes roughly one second of fixed observation overhead, so these figures are comparative rather than page-navigation API timings.

| Matched six-module samples | Baseline mean / median | Final mean / median | Change |
| --- | --- | --- | --- |
| Development | 1,324.67 / 1,310.80 ms | 1,222.77 / 1,229.65 ms | -7.7% / -6.2% |
| Production preview | 1,255.62 / 1,214.57 ms | 1,192.11 / 1,194.39 ms | -5.1% / -1.7% |

No matched module route showed a repeatable material interaction delay. Development reported 17 of 18 baseline and 15 of 18 final module readiness matches. Preview reported 17 of 18 baseline and 16 of 18 final matches. The discarded probes were sporadic Safari focus or readiness-observation misses, not visible application errors, and their occurrence did not cluster in the final revision.

Authenticated preview startup was approximately 4.4 to 4.8 seconds in both revisions because local Supabase session initialization dominated the readiness probe. No application or network-error surface appeared. Development terminals recorded the same known Garage dialog accessibility warning in both revisions and no new console error. All six modules had already passed the Phase 4 authenticated Safari functional smoke test in the final dependency state.

## Attribution and Improvement Theory

No evidence supports rolling back a package upgrade for performance. The result separates as follows:

- **Package-attributable:** production builds are approximately 4 to 5 percent slower, the main gzip chunk is 2.8 percent larger, and total JavaScript is 0.2 percent smaller. These are minor tradeoffs.
- **Test-runtime noise:** individual samples varied with host load and garbage collection. Alternating revisions and ten cold processes removed the apparent large regressions seen in isolated earlier runs.
- **Existing application cost:** the 1,000-row Tasks render and 10,000-result Quick Find open are linear, nonvirtualized DOM work. They breached their ceilings before and after the upgrade.
- **Practical behavior:** a 100-row Tasks view remained approximately 216 ms and Safari module readiness improved modestly on average.

Although there is no serious upgrade regression, the existing stress-budget failures are worth addressing separately. Ranked options are:

1. Profile production-browser Tasks rendering at the owner's actual visible-row distribution and establish stable, isolated benchmark infrastructure before changing UI architecture.
2. Incrementally render or window Quick Find results so opening the dialog does not synchronously mount the complete 10,000-record result surface.
3. Prototype Tasks row virtualization that always retains the focused, edited, and adjacent rows. Any implementation must preserve keyboard traversal, assistive-technology DOM order, focus restoration, drag behavior, and inline editing.
4. Split the enlarged main application chunk only if browser profiling shows it affects startup. The current total emitted JavaScript is already slightly smaller, so chunk work should follow measured network or parse cost rather than raw size alone.

## Post-Assessment Regression Gate

The first post-assessment full suite exposed two timing-related DataGrid test defects under sustained load: a focus-restoration retry could outlive the unmounted grid, and the editing helper could target a control remounted by that retry. The narrow repair stops retries after unmount and makes the test re-resolve the same row and column before retrying. It does not change mounted DataGrid behavior.

The complete repository suite then passed 1,433 tests in 174 files, with 9 opt-in files and 17 opt-in tests skipped as designed. The complete DataGrid focus file passed five consecutive runs before the final full-suite pass. TypeScript, production build, lint with no errors, dependency-tree resolution, and all 53 strict OpenSpec items also passed. The repair added only 109 uncompressed JavaScript bytes to the measured final build and does not execute in the Tasks performance surfaces, so it does not change the performance conclusion.

## Cleanup

No production data or deployed function changed. The disposable user and its profile were deleted, with zero remaining auth-user, profile, task, and history rows on independent readback. Temporary servers stopped and the isolated performance trees and package caches are removed during closeout.

No spec impact: this assessment and its test instrumentation do not change product behavior or durable performance requirements.

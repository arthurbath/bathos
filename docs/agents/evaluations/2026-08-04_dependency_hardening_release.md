# Dependency Hardening Release

**Date:** 2026-08-04
**Category:** Security / Reliability / Release
**Conclusion:** Released and operational across local, web, Edge, Safari, and the signed Mac Tasks container

## Release Decision

BathOS is in running shape after the dependency-hardening program. The supported package graph, exact Edge dependency pins, browser Supabase alignment, router security boundary, and Vite 7 toolchain are on `main` and published. The authenticated Safari application and signed Mac Tasks container both reached healthy synchronization with no pending writes after one narrow stale-system-maintenance conflict repair.

No critical advisory remains. Six npm advisories remain: one low, three moderate, and two high. The high React Router advisory applies to React Server Components, which BathOS does not use, while the Hono and esbuild paths are development or deployment tooling and remain owner-blocked pending compatible upstream movement. Their dependency paths, reachability, and fix status remain documented in the phase evaluations.

## Source And Deployment Identity

| Surface | Released identity |
| --- | --- |
| Dependency-hardening release commit | `0e607d2c6b4b74de607e16108bd3d8f93eea25b5` |
| Stale system-sync repair commit | `37163cd6a86cc2564bffa1841715c017a442e829` |
| Lovable project | `7c1d4dc0-64ea-4b04-af52-969809fecdfe` |
| Final Lovable deployment | `bab1e0b1-c16a-4bca-af57-1a36e913857f` |
| Production origin | `https://os.bath.garden/` |
| Main application asset | `/assets/index-BbeXFLEp.js` |
| Tasks application asset | `/assets/TasksIndex-BPZ3bLQL.js` |
| Stylesheet asset | `/assets/index-CWdtYM6B.css` |
| BathOS Supabase project | `rsqfokyqntmtdejfwmjs` |

The custom production origin returned HTTP 200 with the final Lovable deployment identifier after publication. The final HTML referenced the same assets produced by the validated local build.

## Edge Deployment

Nine changed Edge Functions were deployed to the BathOS project and independently read back as active:

| Function | Version |
| --- | ---: |
| `delete-user-account` | 96 |
| `send-feedback-email` | 96 |
| `admin-delete-users` | 83 |
| `check-auth-rate-limit` | 44 |
| `notify-new-signup` | 43 |
| `submit-help-request` | 39 |
| `mcp` | 20 |
| `dispatch-task-reminders` | 3 |
| `tasks-widget-actions` | 4 |

A brief 502 during propagation recovered without intervention. Controlled unauthenticated boundary checks and the authenticated MCP identity check then passed. No database migration, secret, PowerSync topology, or unrelated Edge Function changed.

## Local Regression Evidence

The final repair state passed:

- Clean npm installation, valid dependency tree, package-signature verification, and audit classification
- 174 Vitest files and 1,437 tests, with 9 opt-in files and 17 opt-in tests skipped as designed
- Tasks TypeScript compilation
- ESLint with zero errors and one pre-existing Fast Refresh warning
- Production Vite build
- Strict OpenSpec validation
- Edge dependency resolution, bundle, and local HTTP-startup checks

The production build emitted a 1,481.18 kB main chunk at 422.11 kB gzip and a 649.59 kB Tasks chunk at 181.34 kB gzip. The existing chunk-size advisory remains informational and is covered by the separate performance assessment.

## Performance Closeout

The temporary upgrade-period performance waiver expired after the repeated baseline comparison. The final dependency graph did not seriously degrade average performance:

- The 1,000-row synthetic Tasks render was 4.2 percent faster on average.
- Quick Find with 10,000 records was 8.1 percent faster on average.
- The practical 100-row Tasks render was effectively neutral.
- Total emitted JavaScript was 0.7 percent smaller, although the main gzip chunk was 2.8 percent larger.
- Production build time increased approximately 4 to 5 percent, a minor non-user-facing tradeoff.

The two-second gate measures a synthetic synchronous render of 1,000 complete task rows, not application startup. It failed before and after the upgrade and remains an existing nonvirtualized rendering cost. Durable performance gates are active again.

## Authenticated Web Acceptance

Safari retained its authenticated session and rendered the launcher plus Budget, Drawers, Garage, Snake, Tasks, Wardrobe, and Administration routes without a visible application error. The final Tasks repair then produced the following readback:

- Sync health changed from Upload Error to Healthy.
- Pending writes changed from 22 to 0.
- Twenty-one stale system-maintenance writes received content-free `system_mutation_superseded` receipts.
- The remaining write was already applied remotely.
- The absent August 2 recurrence instance was not recreated.
- The valid August 9 successor remained authoritative.

The repair did not clear browser storage, modify SQLite directly, or replay the stale system queue manually.

## Native Container Acceptance

`/Applications/Tasks.app` remains signed with the Apple Development identity as bundle `garden.bath.tasks`, version 1.0 build 2. No native source or signed artifact changed during this release.

The Mac container initially retained 15 durable user or actor-absent writes while its shared PowerSync worker remained in Upload Error. A webview reload preserved the queue but did not restart that worker. A full app restart preserved the same local database, restarted synchronization, drained all 15 writes, and produced this independent readback:

- Native Settings reported Healthy with zero pending writes and a current successful-sync timestamp.
- The authenticated MCP hierarchy showed 10 distinct authoritative task records updated during the exact drain window, accounting for sequential writes to repeated records.
- No new rejection or conflict receipt was recorded.

Physical iPhone and Watch acceptance remains unverified because CoreDeviceService timed out and `xctrace` reported no connected devices. This is a device-availability limitation, not evidence of an application or dependency failure.

## Operational Follow-up

- Keep the Saturday 3:00 a.m. dependency report focused on critical alerts, reachability, supported versions, and reliability value.
- Reassess the owner-blocked React Router, Hono, and esbuild advisories when compatible upstream releases become available.
- Treat repeated native Upload Error with a live queue as a shared-worker recovery problem first: preserve the database, inspect the queue, and restart the app before considering any data repair.
- Run physical iPhone and Watch smoke tests when the devices are available.

The release required no production data rewrite, no direct queue deletion, no secret change, no database migration, and no native rebuild.

# Personal Tasks Sustained Parallel-Use Validation

**Date:** 2026-07-20
**Category:** Trust / Endurance
**Status:** Automated Gate Passed, Migration Not Approved

## Purpose

Exercise the production task schema and active client contracts continuously long enough to expose cumulative synchronization, retry, restart, and history-integrity failures that a short conflict matrix might miss. The run used synthetic local accounts and records only. It did not read task content from Things, write to Things, connect Inbox Manager, or use a production BathOS service.

## Environment

- Local Supabase with the full BathOS migration history
- Disposable self-hosted PowerSync Service 1.23.3
- Two persistent PowerSync SQLite clients representing concurrent web installations
- The production task repository, Supabase connector, Raycast-aware creation service, and MCP mutation service
- One synthetic owner and generated nonpersonal task content

## Endurance Matrix

Each cycle performed the following sequence:

1. Submitted one Raycast-channel creation twice concurrently with one idempotency key.
2. Required both calls to resolve to one task through `created` and `already_applied` outcomes.
3. Required both persistent local clients to receive revision one.
4. Alternated conflict winners. One cycle queued an offline web edit before an MCP edit won the shared base revision. The next accepted an online web edit before rejecting a stale MCP edit.
5. Required both local clients to converge on the accepted revision and title.
6. Completed the task through MCP and replayed the identical completion request.
7. Required both local clients to converge on one completed task at revision three.
8. Closed and reopened the secondary client from the same SQLite file every 25 cycles, then proved the restarted projection remained complete.

The test ran at a two-second cadence for at least ten minutes.

## Result

| Measure | Result |
|---|---:|
| Duration | 600,430 ms |
| Completed cycles | 300 |
| Unique task rows | 300 |
| Accepted history events | 900 |
| Offline web conflicts reconciled locally | 150 |
| Stale MCP conflicts rejected remotely | 150 |
| Exact Raycast capture retries | 300 |
| Exact MCP completion retries | 300 |
| Persistent secondary-client restarts | 12 |
| Missing or duplicate tasks | 0 |
| Stuck upload queues | 0 |
| Replica convergence failures | 0 |
| History count mismatches | 0 |

Every logical task produced exactly one creation, one accepted edit, and one completion history event. Both local projections ended with all 300 tasks completed at revision three. The authoritative database contained the same 300 tasks and exactly 900 history events. The primary client recorded exactly the 150 expected stale-offline conflict receipts and no unexplained conflict count.

## Trust Failures and Boundaries

No unresolved product defect appeared inside the automated matrix. The following replacement-readiness boundaries remain unresolved:

- This run is synthetic automation, not days or weeks of the owner's lived parallel use.
- Production hosting, production PowerSync operations, and real network transitions remain unproven.
- Safari and iPhone rendering, background suspension, notification permission, and device notification delivery remain outside this Node-based gate.
- No native Apple editing client exists. A future native client must join the same convergence and restart matrix.
- Inbox Manager dual-writing remains disabled and has not been evaluated against ordinary personal Mail processing.
- Migration and rollback tooling do not exist because migration has not been requested or approved.
- Things remains the authoritative personal system. Passing this gate does not authorize a source-of-truth switch or any write to Things.

## Decision

The automated sustained-use requirement is satisfied. The evidence supports beginning deliberate real-world parallel use when the module is made available, but it does not establish replacement readiness. Task 6.9 remains gated, the Things library remains untouched, and any migration decision requires a later explicit review of lived trust evidence.

## Repeatability

With the documented disposable Supabase and PowerSync services running:

```sh
npm run test:tasks:sustained
```

The default gate runs for ten minutes with at least 20 cycles. `TASKS_SUSTAINED_DURATION_MS`, `TASKS_SUSTAINED_CADENCE_MS`, and `TASKS_SUSTAINED_MINIMUM_CYCLES` may shorten a development smoke pass, but a replacement-readiness evidence run must retain the ten-minute duration.

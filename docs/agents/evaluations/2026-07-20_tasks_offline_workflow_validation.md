# Personal Tasks Offline Workflow Validation

**Date:** 2026-07-20
**Category:** Trust / Integration
**Status:** Passed

## Purpose

Validate the complete core task mutation contract against durable SQLite and real synchronization, not repository mocks. The test uses only synthetic local accounts and task titles. It does not connect personal task data or a production service.

## Environment

- Local Supabase with the full BathOS migration history
- Self-hosted PowerSync Service 1.23.3
- PowerSync Node SDK 0.19.4 with `better-sqlite3` 12
- The production task schema, repository, Supabase connector, template service, and recurrence service
- One temporary SQLite file opened by three sequential database instances

## Executed Workflow

1. Create and synchronize two ordered Today tasks and one template source.
2. Capture a template, create a calendar recurrence, evaluate it, and download the generated occurrence.
3. Disconnect the client.
4. Create a task offline.
5. Edit and reschedule an existing task offline.
6. Reorder and complete another existing task offline.
7. Complete the generated recurrence occurrence offline.
8. Delete and restore one task offline.
9. Delete another task and close the database with a nonempty upload queue.
10. Open the same SQLite file in a new database process and verify every local state and queued mutation survived.
11. Restore the remaining deleted task, reconnect, and wait for the queue to drain.
12. Verify the authoritative Supabase rows match the intended titles, planning dates, lifecycle states, dispositions, and revisions.
13. Open the synchronized SQLite file in a third database process and verify the final state remains present with a zero queue and no duplicate logical tasks.

## Result

The workflow passed. Offline creation, editing, rescheduling, ordering, completion, recoverable deletion, restoration, and generated-occurrence completion survived restart and reconciled to their expected authoritative revisions. The synchronized file survived a second restart without duplication.

Template capture and recurrence definition changes remain intentionally connected operations because the server owns immutable revisions and logical occurrence generation. Once generated, recurrence occurrences are ordinary task records and support the complete offline mutation contract.

## Defects Found and Fixed

### Owner-safe RPC hydration

Template and recurrence RPCs intentionally omit `owner_id` from returned records. The client parsers previously required the omitted field, so real template and recurrence creation failed even though mocked service tests passed. Services now receive the authenticated owner explicitly and hydrate only missing owner fields from that trusted context. Synchronized rows continue to validate their stored owner identifier.

### Empty restoration SQL

Restoring work that could return to its existing container produced an empty dynamic patch followed by a comma, yielding invalid SQLite. Restoration now emits optional assignments only when a container fallback is required. Focused tests cover both an empty task restoration patch and a project whose missing area is cleared.

## Repeatability

The gate is implemented in `src/modules/tasks/integration/offlinePersistence.integration.test.ts` and runs with:

```sh
npm run test:tasks:offline
```

The disposable service setup and cleanup commands remain in `spikes/tasks-module-reconnection/README.md`.

## Remaining Boundaries

- This gate validates the data and synchronization plane. Rendered browser interaction and responsive behavior are covered separately.
- Overlapping multi-client mutations remain task 7.2.
- Backup, export, and restore validation remains task 7.5.
- Sustained parallel use remains task 7.8 and is required before any migration decision.

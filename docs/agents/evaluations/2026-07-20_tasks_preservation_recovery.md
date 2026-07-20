# Personal Tasks Preservation and Recovery Validation

**Date:** 2026-07-20
**Category:** Trust / Integration
**Status:** Passed

## Purpose

Validate undo, recoverable Trash behavior, portable backup, checksum rejection, total source-account loss, owner-rebound restore, exact replay, and post-restore Trash recovery as one production-path exercise. The test uses only synthetic local accounts and records. It does not connect personal task data or a production service.

## Environment

- Local Supabase rebuilt from the complete BathOS migration history
- Self-hosted PowerSync Service 1.23.3
- PowerSync Node SDK 0.19.4 with `better-sqlite3` 12
- The production task repositories, synchronization connector, Mail service, template service, recurrence service, reminder service, portable export client, and MCP recovery mutation
- One temporary SQLite file representing the web client

## Representative Backup Graph

The source owner contains at least one row in every collection in portable export schema version 10:

- Area, project, heading, to-dos, and checklist items
- Append-only task and hierarchy history
- Planning settings
- Structured Mail source and Mail retirement events
- Template definition, immutable revision, and instantiation
- Recurrence definition, revisions, occurrence, evaluation, and status events
- Reminder intent and logical occurrence

Delivery endpoints, credentials, claims, and operational diagnostics remain deliberately excluded.

## Executed Workflow

1. Build and synchronize the representative graph.
2. Edit a task, synchronize its history event, invoke inverse undo, and verify the prior title and notes return as revision three with the source event recorded.
3. Move that task to Trash and restore it through the hierarchy operation path.
4. Move a second task to Trash and leave it there for backup.
5. Serialize a schema-version-10 export, parse the JSON round trip, verify all 21 collection counts are nonzero, and verify active and deleted task states.
6. Change exported task content without changing its manifest checksum and verify dry-run restore rejects it.
7. Disconnect and delete the entire synthetic source account, cascading every server row.
8. Preview the backup under a different authenticated owner and verify every row is classified as an insert without writing anything.
9. Merge the backup and verify all 21 collections are rebound to the target owner without conflict or partial application.
10. Replay the exact backup and verify every collection is classified as a match with no writes.
11. Restore the task that remained in Trash inside the backup through the current MCP hierarchy-recovery path.
12. Export again and verify the recovered task is present and no longer carries a deletion root.

## Result

The complete workflow passed. Undo produced a new synchronized revision, recoverable deletion preserved restoration state, checksum tampering was rejected, source-account deletion removed every source row, dry run wrote nothing, the merge restored every current portable collection to the new owner, exact replay produced only matches, and a task preserved in backup Trash remained recoverable after restoration.

## Defects Found and Fixed

### SQLite checklist boolean binding

Checklist creation and updates passed JavaScript booleans directly to SQLite. The browser adapter tolerated that path, but the official Node adapter rejected it. The hierarchy repository now normalizes boolean bindings to SQLite integers while retaining boolean domain values. Focused tests cover both unchecked insert and checked update bindings.

### Mail source identity in current export validators

Portable versions 8, 9, and 10 used a generic validator that required every record to expose `id`. Structured Mail sources are intentionally keyed by `task_id`, so a valid current export containing a Mail source could not be restored. The validator compatibility layer now supplies the task key only for generic validation while leaving the canonical envelope and legacy Mail graph checks unchanged.

### False conflicts on exact current-schema replay

The current restorer delegated base classification through legacy schema conversions. Those conversions omit fields introduced by later schemas, so the oldest classifier marked exact modern tasks as conflicting and cascaded the false conflict onto their history even though the restored current rows matched the export. The v10 entry point now performs a strict current-schema, owner-aware exact-replay classification first. It returns `already_applied` only when every exported row matches, then falls through to the existing compatibility chain for inserts, partial matches, and real conflicts.

## Repeatability

The gate is implemented in `src/modules/tasks/integration/preservationRecovery.integration.test.ts` and runs with:

```sh
npm run test:tasks:preservation
```

The disposable service setup and cleanup commands remain in `spikes/tasks-module-reconnection/README.md`.

## Remaining Boundaries

- Replace restore remains intentionally unavailable until it has a verified pre-restore backup and separate confirmation workflow.
- Sustained parallel use remains task 7.8 and is required before any migration decision.

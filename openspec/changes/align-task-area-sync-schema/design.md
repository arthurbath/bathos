## Context

The browser Tasks repository writes one shared metadata object for Areas and checklist items. That object includes `last_operation_id`, but only `tasks_checklist_items` and `tasks_todos` have that Supabase column. The PowerSync Area table currently accepts the extra local field, and the connector forwards all Area insert fields to PostgREST. PostgREST rejects the Area insert with `PGRST204`, then dependent task and checklist inserts fail with `23503`.

## Goals / Non-Goals

**Goals:**

- Make the local Area shape exactly match the deployed Supabase Area contract.
- Preserve checklist and to-do operation-group metadata.
- Make preservation tests fail immediately when setup uploads produce sync issues.

**Non-Goals:**

- Add operation-group metadata to Supabase Areas.
- Change the Tasks publication, RLS, database schema, or hierarchy lifecycle semantics.
- Repair or replay writes previously rejected by an older client.

## Decisions

- Remove `last_operation_id` from the local `tasks_areas` schema and omit it from Area create and update writes. This follows the generated Supabase types and deployed table instead of expanding the server schema for metadata that Area history does not consume.
- Keep `last_operation_id` on checklist items and to-dos. Their existing history triggers use it to group undoable work.
- Give Area and checklist update parsing distinct allowed metadata sets. An unexpected Area operation identifier is rejected locally as an invalid mutation instead of reaching PostgREST.
- Retain the preservation test's explicit empty-sync-issues assertion after initial hierarchy creation. Queue count alone proves that PowerSync finished processing writes, not that every remote write was accepted.

## Risks / Trade-offs

- [Risk] An existing local database contains the removed Area column. -> PowerSync owns local schema evolution, and focused restart coverage will verify that current rows and queued supported fields remain usable.
- [Risk] Removing shared metadata handling could accidentally remove checklist operation grouping. -> Focused repository, schema, connector, and preservation tests assert the checklist field remains present and uploads normally.
- [Trade-off] Rejected writes from an already released mismatched client are not replayed automatically. -> This repair prevents new invalid Area writes and keeps recovery of historical rejected writes outside this prerequisite.

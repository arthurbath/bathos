## Why

Tasks creates Areas with a local `last_operation_id` field that does not exist on the Supabase `tasks_areas` table. PowerSync therefore rejects an offline Area upload, after which dependent task and checklist uploads fail their foreign keys while the queue can still appear drained.

## What Changes

- Align the local PowerSync Area shape and repository writes with the deployed Supabase Area schema.
- Reject unexpected Area operation metadata before it reaches the remote store.
- Strengthen preservation integration coverage so rejected setup writes cannot masquerade as a drained queue.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require locally created Areas and their dependent task hierarchy to upload without rejected writes before preservation and recovery work proceeds.

## Impact

- Tasks PowerSync schema, hierarchy repository, upload connector, and focused tests.
- Local and disposable Supabase/PowerSync test infrastructure only. No database migration, dependency change, production-data mutation, or Edge Function deployment.

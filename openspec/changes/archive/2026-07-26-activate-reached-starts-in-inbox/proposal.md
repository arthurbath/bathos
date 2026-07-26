## Why

Newly reached future Starts currently enter Today Next, while unfinished prior-day Today work resets to Inbox. That distinction weakens the daily re-planning ritual because some work enters the new day already prioritized without the user reconsidering it.

## What Changes

- **BREAKING**: Activate every newly reached task Start into Today Inbox instead of Today Next.
- Apply the same rule in the local-first repository and the server activation function so offline, synchronized, and scheduled activation converge.
- Preserve the existing order of operations: prior-day Today rollover completes before newly reached Starts activate.
- Do not rewrite existing task rows as part of deployment.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change reached-Start activation from Today Next to Today Inbox.

## Impact

- Tasks local activation in `src/modules/tasks/data/taskRepository.ts`
- Tasks runtime and repository tests
- The private Supabase `tasks_private.activate_due_roots` function and database rollover tests
- The durable Tasks specification
- No new table, publication, PowerSync entity, Edge Function, or corrective data rewrite

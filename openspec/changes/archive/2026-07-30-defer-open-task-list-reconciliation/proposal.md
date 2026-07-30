## Why

An autosaved metadata edit can currently remove or reposition an open to-do while the user is still working in its expanded drawer. The editing session needs a stable list location regardless of whether the change came from an editor control or a keyboard shortcut, with projection changes applied only after the drawer closes.

## What Changes

- Retain an open to-do in its current list, visible bucket, and ordering slot while metadata edits autosave.
- Apply accepted metadata immediately inside the open summary row and editor without projecting it into a different list, bucket, filter result, or automatic-sort position.
- Reconcile the current list projection exactly once after the ordinary drawer-close path completes.
- Apply the same behavior to pointer, keyboard, and other editor-owned metadata controls.
- Add regression coverage for same-list regrouping and current-list departure through both UI and keyboard mutation paths.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Clarify and enforce stable open-editor placement until close across every task metadata mutation path.

## Impact

- **Module:** Tasks only.
- **Code:** Task list projection, expanded editor state, metadata mutation commands, and their tests under `src/modules/tasks/`.
- **Data and APIs:** No schema, Supabase, PowerSync, MCP, native, or persistence contract changes. Metadata continues to autosave immediately.
- **Blast radius:** Current-list rendering while one task drawer is open and the one-time projection reconciliation performed when it closes.

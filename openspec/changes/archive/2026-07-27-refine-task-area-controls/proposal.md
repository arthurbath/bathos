## Why

Projects have been removed from Tasks, but Area controls still retain organization-era chrome and interaction patterns. The remaining Area experience should be simpler, keyboard-first, and consistent with BathOS DataGrid conventions without keeping a visible Quick Find affordance that the user no longer wants.

## What Changes

- Simplify the expanded task Area selector to a flat list and omit it entirely when the owner has no Areas.
- Change the Tasks-specific Control+V command from opening Area selection to cycling through No Area and the owner's ordered Areas, including deterministic convergence for mixed bulk selections.
- Replace the custom Areas editor on Tasks Config with the shared card DataGrid pattern for inline naming and ellipsis-menu ordering and deletion.
- Remove visible Quick Find buttons from Tasks routes while preserving global type-to-search and the complete search-results route.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine Area presentation, Area keyboard commands, Area configuration, and Quick Find entry behavior.

## Impact

- Tasks components, keyboard-command mapping, task-domain helpers, and related tests.
- Shared grid-width registry receives one Tasks Areas grid key and default-width definition.
- No Supabase schema, RLS, RPC, Edge Function, dependency, or production migration changes.
- Other BathOS modules retain their existing DataGrid and search behavior.

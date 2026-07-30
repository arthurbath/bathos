## Why

Quick Find currently presents a full modal even though its primary job is to accept a short query and expose a few immediate matches. A smaller keyboard-first palette can preserve the existing exhaustive search handoff while keeping the current list visible and making result navigation faster.

## What Changes

- Replace the titled Quick Find dialog with a compact centered palette containing only the query input, up to three results, and Continue Search.
- Keep DOM and text-cursor focus in the query input while Up and Down move a separate preliminary selection through the visible results and Continue Search.
- Let Enter activate the preliminary selection, Escape dismiss the palette, and the first outside pointer action dismiss without activating the underlying interface.
- Remove repeated task checkbox icons and row separators from Quick Find results while distinguishing recurrence definitions with the established repeat icon.
- Route a regular task result to its natural list, open it, and align its expanded summary near the top of the visible content.
- Route a recurrence-definition result to Upcoming, keep recurrence management closed, and keyboard-focus and reveal the recurrence row.
- Preserve the live `/tasks/search` continuation route for exhaustive results.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine Quick Find presentation, keyboard selection, dismissal, and task-result destination behavior.

## Impact

The change is confined to the Tasks module and its OpenSpec contract. It affects the Quick Find component, Tasks shell result-selection orchestration, recurrence projection search presentation, and focused component tests. It requires no database migration, Supabase deployment, dependency, or cross-module import.

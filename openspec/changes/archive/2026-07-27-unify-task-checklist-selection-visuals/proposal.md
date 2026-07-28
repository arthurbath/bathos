## Why

Task rows and checklist items expose closely related focus and multi-selection interactions but currently use different control icons and highlight colors. A shared visual language will make selection state immediately recognizable at both levels without hiding checklist completion state.

## What Changes

- Canonicalize Lucide `Circle` and `CircleCheck` as the inactive and active Tasks selection indicators.
- While checklist multi-selection is active, replace checklist completion controls with selection controls that toggle item selection while preserving completion strike-through styling.
- Use the existing checklist selection blue highlight for keyboard-focused and bulk-selected task rows across active and Done views.
- Transition an opened task from the blue focus/selection highlight to the existing gray expanded-task surface.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Unify task and checklist selection controls, selected-row color, and the opened-task transition.

## Impact

- Tasks checklist editor selection controls and tests.
- Tasks list-row focus, bulk-selection, open-state styling, and tests.
- Canonical Tasks iconography registry and documentation.
- No database, Supabase, sync, MCP, or external API changes.

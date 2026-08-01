## Why

The neutral checked task box does not provide enough visual confirmation that a completion action succeeded. Restoring semantic success green to the completed task icon makes pointer and keyboard completion feedback immediately legible without reviving the removed green hover treatment.

## What Changes

- Render a completed to-do's contained checked-square icon in semantic success green.
- Apply the same green completion state during the brief optimistic completion feedback shown before an active task leaves its list.
- Keep open task boxes neutral, keep task completion controls free of green hover styling, and leave checklist-item completion colors unchanged.
- Preserve the established information-blue task and checklist selection controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Distinguish completed to-do controls from neutral open task and checklist controls with semantic success green.

## Impact

- Tasks row completion-control styling and focused component tests.
- The durable `personal-tasks-module` completion-control visual contract.
- No database, API, dependency, migration, widget, or checklist behavior changes.

## Why

An expanded task editor can fall out of sync with accepted task mutations made through keyboard commands, and dismissing an editor-owned select popover can incorrectly cascade into closing the complete task editor. The editor must remain a coherent view of the current task while nested controls retain their own dismissal boundary.

## What Changes

- Reconcile the expanded editor's controlled Actionability and Organization values when the accepted task record changes outside those controls.
- Make dismissing the Actionability or Organization popover consume only the nested select layer, leaving the task editor open.
- Add regression coverage for Control+G synchronization and pointer dismissal through both editor-owned selects.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define expanded-editor synchronization and nested-select dismissal as durable task editing behavior.

## Impact

The change is limited to the BathOS Tasks shell, its expanded editor, and its component tests. It does not alter shared Select behavior, persisted task schemas, database policies, synchronization topology, or external APIs.

## Why

The visible Quick Find button adds unnecessary list-header noise now that Tasks supports immediate type-to-search and a touch pull-down gesture. Removing it preserves the feature while keeping list actions focused on operations that require visible controls.

## What Changes

- Remove the Quick Find button from the top list-action row on every Tasks list.
- Preserve printable-key activation on point-and-click devices.
- Preserve the touch pull-down Quick Find gesture on touch devices.
- Remove the obsolete visible-list-search requirement that contradicts the established typing-only Quick Find contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Remove the visible list Search action while preserving typing and touch-gesture access to Quick Find.

## Impact

- Tasks list-action rendering and focused Tasks shell tests.
- Personal Tasks durable interaction contract.
- No database, API, dependency, or native-wrapper changes.

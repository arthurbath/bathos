## Why

Quick Find retains unnecessary empty space below its input when it has no results or status message, making the compact palette look vertically unbalanced. The palette should remain compact in its input-only state while preserving deliberate spacing when results or feedback are present.

## What Changes

- Give the input-only Quick Find palette equal top and bottom inset around the input.
- Preserve balanced separation and outer padding when result rows, loading feedback, errors, or empty-result messages are displayed.
- Add regression coverage for both the input-only and content-bearing layouts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refine the compact Quick Find palette's spacing across empty and content-bearing states.

## Impact

This is a Tasks web UI refinement affecting `TaskQuickFind.tsx`, its focused tests, and the personal Tasks behavior contract. It changes no database schema, synchronization behavior, native companion implementation, dependency, or public API.

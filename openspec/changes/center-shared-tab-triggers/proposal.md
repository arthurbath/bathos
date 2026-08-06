## Why

The shared high-resolution tab control allows its active trigger to exceed the tab list's usable inner height, leaving visibly uneven top and bottom spacing. The control should retain the standard input height while centering every trigger rectangle and label within that fixed geometry.

## What Changes

- Make shared tab triggers fill the tab list's available inner height instead of deriving a taller height from vertical padding.
- Preserve the tab list's existing standard-input height, border, padding, active treatment, and keyboard behavior.
- Add a regression test for the shared tab geometry and verify the sign-in tabs in the rendered application.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-visual-foundations`: Require shared high-resolution tab triggers to be vertically centered within a standard-input-height tab list.

## Impact

- Shared UI primitive: `src/components/ui/tabs.tsx`
- Shared UI regression coverage
- Every BathOS surface using the shared Tabs primitive, including authentication and household setup
- No API, dependency, database, migration, or native-companion impact

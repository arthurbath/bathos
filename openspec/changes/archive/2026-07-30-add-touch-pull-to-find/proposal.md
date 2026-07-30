## Why

Quick Find is efficient from a keyboard but needs an equally direct touch gesture and a discoverable pointer affordance on task lists.

## What Changes

- Add a touch-only pull-down gesture at the top of Tasks lists.
- Fade in a magnifying-glass indicator as pull distance approaches the threshold.
- Open Quick Find when the user releases beyond the threshold.
- Restore a top-right Search button on list views.
- Keep the gesture unavailable on non-touch devices and off the Settings page.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Add touch and pointer entry points to the existing Quick Find surface.

## Impact

- Tasks list shell, touch gesture handling, Quick Find launcher, and tests.
- No database, API, dependency, or migration changes.

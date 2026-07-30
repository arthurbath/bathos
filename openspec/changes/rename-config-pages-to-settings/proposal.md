## Why

BathOS currently exposes the abbreviated label "Config" for pages that users understand as Settings. The inconsistent name is less clear and diverges from the established Settings icon.

## What Changes

- Rename every user-visible Config page, navigation item, heading, shortcut description, and empty-state link to Settings.
- Use Lucide `settings` for Settings page concepts.
- Preserve existing `/config` routes and keyboard shortcuts for compatibility.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform-navigation`: Canonize Settings naming and iconography across BathOS without changing route contracts.

## Impact

- Platform and module navigation labels, page titles, help copy, empty states, and tests.
- No route, database, API, or migration changes.

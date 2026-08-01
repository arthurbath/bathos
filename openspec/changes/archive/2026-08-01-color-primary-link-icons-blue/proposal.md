## Why

Primary Link icons currently use the same neutral gray as passive metadata even though they are actionable destinations. A consistent blue treatment will make external web and application links easier to distinguish across the Tasks app and its native widgets.

## What Changes

- Render every actionable Primary Link identity icon in a task summary row with BathOS's semantic info blue.
- Render the same Primary Link identity icons with native system blue in the shared iOS and macOS large-widget task rows.
- Preserve existing generic and protocol-specific icon selection, routing, and accessibility labels.
- Omit the task-row Primary Link slot entirely when the editable Primary Link is blank, regardless of retained source provenance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Primary Link identity icons in task summary rows gain a semantic blue action treatment.
- `tasks-ios-companion`: The shared Apple widget Primary Link icon treatment becomes native system blue on iOS and macOS.
- `tasks-macos-companion`: The macOS large widget explicitly preserves the shared blue Primary Link treatment.

## Impact

- Tasks web component styling and focused component tests.
- Shared SwiftUI widget rendering consumed by the iOS and macOS widget targets.
- No database, sync, cache-schema, link-routing, entitlement, or migration changes.

## Why

Reminder intent currently outlives the Start planning that makes it meaningful, and the Start picker and shortcut still offer reminders for unplanned or Someday work. Separately, Apple widget horizon symbols and the Watch capture control have inconsistent native presentation, while equal-rank mixed Upcoming rows can still activate into Today in an order that differs from the list the user arranged.

## What Changes

- Make task reminders valid only while an open task has a Today horizon or a future Start date, and retire the reminder after its alert is delivered.
- Hide reminder controls for unplanned and Someday tasks, and make the reminder keyboard command explain that Start must be set first.
- Cancel a reminder immediately when Start becomes unplanned, Someday, or a same-day time that has already elapsed.
- Give the four Today widget horizon symbols one consistent apparent stroke weight on both Apple widget surfaces.
- Refine the Watch add control with the established darker-green fill and lighter-green outline treatment.
- Preserve the exact mixed Upcoming display order at midnight even when ordinary tasks and recurrence prototypes share an ordering key.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Restrict reminders to current or future Start intent, retire delivered reminders, and make midnight activation honor the exact mixed Upcoming display order.
- `tasks-ios-companion`: Standardize the apparent stroke weight of Today horizon symbols in the shared Apple widget renderer.
- `tasks-macos-companion`: Preserve the shared horizon-symbol presentation in the native Mac widget.
- `tasks-watch-companion`: Apply the established green circular action treatment to the Watch capture control.

## Impact

- Tasks Start-picker rendering, keyboard-command handling, reminder projections, and reminder tests.
- Supabase reminder lifecycle functions, activation ordering, migrations, and database tests.
- Shared iOS/macOS WidgetKit horizon rendering and Watch SwiftUI capture presentation.
- No new tables, routes, dependencies, credentials, or notification channels.

## Why

BathOS Tasks still has several interaction gaps between touch, keyboard, web, and native surfaces: touch Quick Find does not reliably begin text entry, list scrolling lacks native-feeling elasticity, future recurrence ordering is incomplete, and macOS widget registration has regressed. BathOS also still carries hover-only styling and disclosure patterns that conflict with its touch-first, input-mode-neutral design.

## What Changes

- Make pull-down Quick Find focus its query input and summon the software keyboard, and replace Continue Search with a conditional See All Results action that appears whenever the Search page would return at least one result.
- Restore touch-only top and bottom list elasticity and integrate the top pull affordance with Quick Find without shifting fixed navigation controls.
- Let Upcoming recurrence projections participate in manual ordering within their visible date bucket, persist that order, and make midnight occurrence activation place those tasks after rolled-over Today work while preserving the preplanned Upcoming order.
- Rename the selection-mode dismissal action from Cancel to Done.
- Make every detected blue Notes URL directly activatable even while its source line is in raw-edit presentation.
- Restore the locally built macOS Tasks widget extension to macOS widget discovery without disrupting the companion iOS widget relationship.
- Render the selected-current-date Star with a dark foreground that remains visible on the light selected-day background.
- **BREAKING**: Remove hover visual states and hover-only disclosure throughout BathOS. Information and actions previously revealed only by hover become persistently visible, tap/click activated, or removed when redundant.

## Capabilities

### New Capabilities

- `hover-independent-interactions`: Shared BathOS contract requiring complete information, actions, and feedback without hover-only presentation or activation.

### Modified Capabilities

- `personal-tasks-module`: Refine touch Quick Find, list elasticity, selection dismissal language, Notes links, Upcoming recurrence ordering, and midnight Inbox placement.
- `shared-date-picker-indicators`: Require selected-current-day Star contrast.
- `tasks-macos-companion`: Restore a discoverable, installable macOS widget extension that remains associated with Tasks.

## Impact

- Tasks shell, Quick Find palette, list scrolling, task rows, Notes editor, Upcoming drag/drop projection, recurrence activation, ordering persistence, selection toolbar, and focused tests.
- Shared button, link, tooltip, navigation, DataGrid, and module-specific styles or event handlers that currently depend on hover.
- Shared date-picker day rendering and tests.
- macOS Xcode project, widget extension packaging, signing/embedding, installed app verification, and native tests.
- Supabase Tasks recurrence/activation functions and database tests; a forward-only migration may be required if durable Upcoming recurrence order cannot be represented by current task order fields.

## Why

The macOS Global Quick Entry panel still exposes native and web loading as two consecutive spinner states, flickers during warm presentation and dismissal, and can become impossible to dismiss when loading fails. Its form also needs a reliable checklist disclosure, balanced horizontal padding, explicit Save and Cancel actions, and a movable native panel.

## What Changes

- Make the native panel own the complete loading presentation until the quick-entry editor reports that it is ready, so only one spinner is ever visible.
- Keep Escape and the global shortcut available as native cancellation commands throughout loading, ready, and failed states.
- Reveal and dismiss the whole panel atomically instead of fading or flashing its inner web content separately.
- Permit the user to reposition the overlay by dragging its noninteractive background or top region.
- Increase the panel's left and right editor padding while preserving its established height and top padding.
- Restore checklist creation from an empty or partially completed quick-entry draft.
- Present an always-available outlined Cancel action and a filled primary Save action.
- Reuse the warm web document where possible so subsequent invocations avoid unnecessary reload work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-macos-companion`: Refine Global Quick Entry loading ownership, window movement, atomic presentation, resilient native dismissal, and visible action styling.
- `personal-tasks-module`: Require the native quick-entry form to create checklist drafts reliably and expose explicit Save and Cancel controls.

## Impact

- Native macOS panel lifecycle and keyboard handling in `macos/TasksCompanion/TasksMac/`.
- Tasks WebKit bridge readiness messages in `src/modules/tasks/native/`.
- Native quick-entry rendering and checklist behavior in `src/modules/tasks/components/TasksShell.tsx` and `src/index.css`.
- macOS and React tests for loading, dismissal, panel geometry, actions, and checklist creation.

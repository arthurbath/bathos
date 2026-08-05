## Why

The Tasks editor, reminder feedback, native synchronization, and Apple widget presentation have accumulated several inconsistencies that make ordinary task capture and review feel unreliable. The editor order no longer matches the user's workflow, blank-summary handling can restore stale data, the macOS companion can remain stale until refresh, and the native widgets do not yet match the intended compact typography and empty-state treatment.

## What Changes

- Reorder the expanded task editor so Start, Deadline, Area, and Actionability appear immediately after Summary and before Notes, Primary Link, and Checklist.
- Replace the Summary-to-Notes cursor handoff with a dedicated Control+N Notes command, and make Start-clearing commands close an open Start picker.
- Keep an open Today task visually anchored until close even when clearing Start will move it to Anytime, then reconcile its list membership when the editor closes.
- Treat an empty Summary as valid when Notes, Primary Link, or Checklist content exists, and trash a task closed without any of those meaningful fields instead of restoring stale Summary text.
- Make native macOS Tasks converge on externally created or changed tasks without requiring a manual refresh, using the same authoritative synchronization expectations as the web surface.
- Show a far-future Upcoming task's Start month and day in its metadata line after Area and before Reminder.
- Format in-app reminder toasts with a time-prefixed task summary and a smaller Reminder icon.
- Match the iOS Lock Screen mini-widget task typography to Calendar's compact task-text treatment.
- Center Apple widget empty states in the remaining content area and use the closest native Sparkles symbol instead of the ordinary completion checkmark.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `personal-tasks-module`: Refine task-editor ordering and commands, deferred list reconciliation, meaningful blank-summary persistence, native convergence, Upcoming metadata, and reminder-toast presentation.
- `tasks-ios-companion`: Refine Lock Screen mini-widget typography and shared Apple-widget empty-state presentation.
- `tasks-macos-companion`: Require live externally originated task convergence in the native host and consume the shared Apple-widget empty-state presentation.

## Impact

- Task editor and keyboard-command components under `src/modules/tasks/`
- Tasks list projection, open-editor anchoring, persistence, and PowerSync/native-host lifecycle logic
- Reminder delivery toast rendering
- Shared iOS/macOS WidgetKit source and native companion tests
- Focused web, domain, synchronization, widget, and native build verification

## Why

The Today-progress complication currently opens the Tasks watch app at its plus control, requiring another tap before the user can dictate or type a task. The complication should serve as a direct capture shortcut and open the system task-summary input immediately.

## What Changes

- Give the complication a dedicated watch-app capture URL.
- When the watch app receives that URL, present the same system text-entry workflow used by the plus control without requiring an intermediate tap.
- Preserve ordinary watch-app launches at the existing plus-control screen and preserve cancellation and submission behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tasks-watch-companion`: Change complication activation from opening at the plus control to opening the task-summary input directly.

## Impact

- watchOS SwiftUI app launch handling
- WidgetKit complication activation URL
- Shared watch launch-route policy and native tests
- No database, API, credential, task-creation, or complication-progress changes

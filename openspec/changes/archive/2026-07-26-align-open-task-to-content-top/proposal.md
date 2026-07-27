## Why

Opening a task currently performs only a minimal reveal of the Summary input, which can leave much of the expanded metadata drawer below the viewport. Aligning the task's summary row with the top of the visible content area makes the greatest possible portion of the editor immediately usable.

## What Changes

- Scroll an opened task so its summary row reaches the top of the visible content area below the sticky BathOS header.
- Defer ordinary-motion alignment until the expanded editor reaches its final layout height.
- Let the browser clamp the movement when a short list or document boundary does not provide enough scroll range for exact alignment.
- Preserve the existing disclosure animation, title focus, reduced-motion behavior, and task-list focus behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace minimal title reveal scrolling with best-effort top alignment for the whole opened task.

## Impact

- Tasks editor disclosure and scroll coordination in `src/modules/tasks/components/TasksShell.tsx`
- Shared top-header identification in `src/platform/components/ToplineHeader.tsx`
- Tasks shell regression coverage and rendered browser QA
- No database, Supabase, PowerSync, route, or dependency changes

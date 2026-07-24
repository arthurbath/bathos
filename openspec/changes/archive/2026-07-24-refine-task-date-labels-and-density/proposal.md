## Why

Tasks date controls and collapsed rows expose more date detail and whitespace than the user's daily scanning workflow needs. Nearby dates should read naturally at the editing surface, urgent deadlines should be unmistakable in lists, and compact rows should show more work without sacrificing hierarchy or accessibility.

## What Changes

- Present Yesterday, Today, and Tomorrow in Start and Deadline inputs instead of explicit calendar dates.
- Use numeric digits for relative day counts in task-row Start and Due metadata.
- Render Due metadata in the destructive semantic color when its deadline is today or earlier.
- Reduce collapsed to-do row height, horizontal spacing, and title-to-metadata spacing while retaining a uniform bounded layout.
- Add focused domain, component, and rendered regression coverage for the revised presentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Refines nearby date summaries, overdue deadline emphasis, and compact to-do row density.

## Impact

- Affects Tasks date-formatting helpers, Start and Deadline input summaries, collapsed task rows, and their tests.
- May add one presentation override to the shared date-picker trigger without changing its selection or navigation behavior.
- Does not change task data, Supabase objects, synchronization, reminders, routing, or other BathOS modules.

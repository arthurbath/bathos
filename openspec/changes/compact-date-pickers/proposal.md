## Why

The shared calendar and the Tasks start-date picker are tall enough that constrained list positions can leave no satisfactory anchored placement. A denser but still touch-appropriate presentation will reduce clipping and make these controls easier to use without changing their behavior.

## What Changes

- Reduce the vertical size and spacing of shared calendar date cells while retaining adequate touch targets and the existing fixed six-week grid.
- Use compact controls for the Tasks start picker's Reminder field and its Clear and Someday actions.
- Move the Tasks start picker's Today label into a vertical rail beside the horizon controls so the Today section consumes less height.
- Reduce the Tasks start picker to the same width as the shared calendar so its horizon, Reminder, and terminal-action sections do not create unused horizontal space.
- Give weekday labels the same cell geometry as calendar dates, and italicize dates whenever they are disabled.
- Use the compact button height for the shared date picker's Clear action, including the Tasks Deadline picker.
- Treat the fixed six-week day view as the keyboard navigation grid, page months only when horizontal traversal crosses a grid endpoint, and let vertical traversal exit to composed controls above or below the grid.
- Let the previous and next month or year navigation buttons page when the user presses the matching outward arrow, while respecting each field's selectable limits.
- Separate committed-value styling from provisional keyboard focus: selected dates and their selected month use the same rounded gray background, while focus contributes only the existing white border and ring.
- Keep the in-month Today star yellow whenever Today is selectable and render it in the disabled-date gray only when Today cannot be selected.
- Use solid semantic colors rather than whole-control opacity for adjacent-month and disabled date values so the provisional focus border always remains fully bright and committed adjacent-month dates retain their normal selected background.
- Right-align the Tasks Deadline picker to its field, present the Reminder hour action with only a left divider, and keep Start and its task editor open when the nested Reminder hour menu is dismissed.
- Present the Reminder hour action as a stable white button without hover styling, and standardize rich single-select popover menus on a leading checkmark for the committed value plus a light-gray provisional highlight.
- Preserve date availability, reminder behavior, and date selection semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Shared calendar grids use compact, rhythmically aligned weekday and date-cell geometry, independent committed-value and focus styling, semantic Today-star color, a compact Clear action, predictable fixed-grid arrow traversal, and rich single-select popover menus use the standard committed-value checkmark and provisional highlight.
- `personal-tasks-module`: The Tasks start-date picker uses a compact Today horizon layout, contained Reminder control, and terminal action row, while the Deadline picker aligns to the right edge of its field.

## Impact

- Shared calendar styling in `src/components/ui/calendar.tsx` and focused component tests.
- Tasks start-picker presentation in `src/modules/tasks/components/TaskStartPicker.tsx` and focused Tasks tests.
- No database, Supabase, PowerSync, dependency, routing, or native-project changes.

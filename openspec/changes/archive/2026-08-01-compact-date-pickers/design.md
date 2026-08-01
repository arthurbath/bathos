## Context

BathOS shares one calendar grid across form date pickers. Its fixed six-week day view currently reserves 318px and uses 36px-square date cells. The Tasks Start picker adds a labeled Today block, the shared calendar, a full-height Reminder group, and full-height terminal actions, so it can be taller than the available space around a task even when the popover placement logic chooses the better side.

The experiment should reduce that height without changing date semantics or focus movement. The first pass preserved the Start picker's 320px width, but rendered review showed that the shared 276px calendar width provides enough room for every Start-specific control while eliminating unused horizontal space.

## Goals / Non-Goals

**Goals:**

- Reduce the height of every shared six-week day calendar while keeping all seven columns and six rows stable.
- Make the Tasks Start picker's Today section, Reminder row, and terminal actions denser.
- Match the Tasks Start picker to the shared calendar width.
- Align weekday labels to the same geometry as date cells and distinguish disabled dates with italics.
- Use the compact button height for shared date-picker Clear actions.
- Preserve pointer, touch, arrow-key, Tab, Return, Space, and Escape behavior.
- Resolve the conflict between adjacent-month focus and composed-control traversal by making the visible six-week grid the arrow-key navigation surface.
- Make committed selection and provisional focus visually independent so both states remain legible when they coincide.
- Keep the shared calendar width stable while allowing the wider Tasks Start wrapper to contract to it.
- Keep provisional focus chrome at full opacity on adjacent-month dates and preserve the committed background when the selected date is shown outside the displayed month.
- Keep nested Reminder-hour dismissal local to that menu and align the Tasks Deadline calendar with the field's right edge.

**Non-Goals:**

- Changing which dates can be selected or introducing deadline minimum dates.
- Changing the shared calendar width, month-picker layout, popover anchoring, or collision detection.
- Adding a new global compact Input or Button variant.
- Changing reminder parsing, scheduling, or availability rules.

## Decisions

- Shared day cells will keep their existing 36px column width but use a 32px height, with tighter row spacing and a correspondingly smaller reserved viewport height. This preserves horizontal target room and the predictable six-row grid while reclaiming vertical space.
- The Tasks Today heading will become a narrow vertical rail immediately left of the four horizon buttons. CSS writing mode will produce the requested 90-degree presentation without transformed-layout overflow.
- The Tasks Reminder input group will use local 36px control height, matching the existing small Button height without adding a shared Input API that other consumers did not request.
- Clear and Someday will use the shared small Button size. Existing icons, equal-width layout, divider, focus order, and final-selection behavior remain unchanged.
- The Tasks Start panel will use the shared calendar's 276px width. Its horizon, Reminder, and terminal-action sections remain fluid within that width.
- Weekday headings will use the same 36px width and 32px height as day cells, improving the grid's vertical and horizontal rhythm without changing accessible table semantics.
- The shared disabled-day modifier will add italic typography regardless of whether the disabled date belongs to the displayed, previous, or next month. Selectable outside-month dates remain non-italic.
- Shared date-picker Clear actions will use the small Button size and reduced wrapper padding. This includes the Tasks Deadline picker but does not impose a minimum date or otherwise alter Deadline availability.
- Arrow keys within the day calendar will traverse the 42 visible grid positions without changing the displayed month merely because focus enters an adjacent-month date. Up and Down may leave the grid through its top and bottom boundaries so composed controls remain reachable. Left from the top-left cell and Right from the bottom-right cell page to the adjacent month and focus the chronologically adjacent date.
- Left on the previous-month or previous-year navigation control and Right on the next-month or next-year control will page in the matching direction, preserve focus on that navigation control when it remains available, and honor the date field's selectable limits.
- A committed date and the corresponding month in month-picker mode will use the same rounded accent-gray background without a visible selection border. The existing focus border and ring remain the provisional cursor and layer over the committed background without replacing it.
- The Today star will use warning yellow whenever its in-month date is selectable, including when Today is also the committed value or provisional focus. A disabled Today star will use muted-foreground gray. The current-month star will follow the same selectable-versus-disabled color rule in month-picker mode.
- Adjacent-month and disabled dates will use semantic muted text colors without lowering the opacity of the whole day button. This keeps focus borders and selected backgrounds fully opaque. Adjacent-month selection will not introduce a separate translucent background or selection opacity.
- The Tasks Deadline field will opt into the shared date picker's end alignment. The Reminder hour action will remove its inherited transparent perimeter border and retain only its left divider.
- The Reminder hour menu will be a non-modal nested menu marked as an editor-owned surface. Dismissing it through Escape, its trigger, or an interaction elsewhere inside Start will close only the nested menu and preserve both the Start picker and open task.
- The Reminder hour action will use the ordinary foreground color while enabled and will not change background or foreground on hover. Its disabled treatment remains explicit.
- Rich radio-menu primitives will use Lucide Check in the reserved leading indicator slot. Keyboard or pointer highlighting remains a separate light-gray row background so provisional focus never substitutes for the committed-value indicator.
- Focused tests will assert the compact geometry hooks and established interactions. Rendered checks will cover the shared Deadline picker and the Tasks Start picker at narrow and wider viewports.

## Risks / Trade-offs

- A 32px visual day cell is denser than the prior 36px cell. Keeping 36px column width and testing on a mobile viewport mitigates missed targets while honoring the requested experiment.
- Vertical writing direction can feel unfamiliar. The label remains short, uppercase, and directly attached to the horizon group so its meaning stays clear.
- At 276px, the four horizon targets are narrower than before. Their icon-and-label stacks remain directly tappable, and rendered mobile checks will verify that labels do not clip.
- Adjacent-month dates can now receive focus without immediately changing the caption. The stable visible grid and endpoint-only paging provide a consistent spatial model, while the active date's full accessible label continues to identify its month and year.
- Removing the selected cell wrapper fill means range-style cell backgrounds are not retained. This Calendar API is constrained to single-date mode, so the selected button itself is the correct visual ownership boundary.
- Tailwind class assertions can overfit implementation details. Data attributes identify the layout intent while tests assert only the essential compact sizing and preserve existing behavioral coverage.
- Removing whole-control opacity makes adjacent-month text somewhat brighter than before, but the semantic muted text token preserves hierarchy without degrading the focus indicator.

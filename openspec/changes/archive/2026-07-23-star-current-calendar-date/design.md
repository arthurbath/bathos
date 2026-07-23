## Context

Every BathOS date picker composes `src/components/ui/calendar.tsx`. The shared Calendar already receives an authoritative `today` value when a module has owner-local planning semantics and otherwise inherits React DayPicker’s system-date default. It also owns the custom day renderer and month-picker view, making it the narrowest reliable place to establish a global current-period convention.

The current day and selected day are independent states. React DayPicker exposes both through active modifiers, while the custom month picker separately tracks the displayed year and active month.

## Goals / Non-Goals

**Goals:**

- Render Lucide’s outline `Star` in place of today’s numeric label when today belongs to the displayed day calendar month.
- Render the same star to the right of today’s month label in the month picker for today’s year.
- Preserve selected-day and selected-month styling independently.
- Preserve complete accessible names and date semantics.
- Apply the behavior to every consumer of the shared Calendar without module-specific duplication.

**Non-Goals:**

- Changing date eligibility, selection, keyboard navigation, or autosave behavior
- Changing the existing selected-value highlight
- Marking today when it appears only as an outside-day cell for an adjacent month
- Adding dependencies, database objects, APIs, or migrations

## Decisions

### Render the convention in the shared Calendar

The custom `CalendarDay` renderer will replace its normal day content only when React DayPicker’s `today` modifier is active and the date belongs to `displayMonth`. The custom `MonthPicker` will compare each month with the resolved Calendar `today` value and append the same icon only when both year and month match.

This central implementation guarantees that Tasks Start, Tasks Deadline, and other BathOS date pickers remain visually consistent. Module-specific rendering was rejected because it would duplicate semantics and allow future pickers to drift.

### Resolve today through the existing Calendar contract

The icon logic will use the explicit `today` prop when supplied and the system date otherwise, matching React DayPicker’s established behavior. Tasks therefore continues to use its owner planning date, while generic shared fields use the browser’s current date.

### Preserve accessible text through the control

The star is decorative and will be hidden from assistive technology. Day controls retain React DayPicker’s full date label and `aria-current="date"`. Month buttons retain their full month-and-year `aria-label`. Stable data attributes on the icons will support focused regression tests without making the icon itself interactive.

### Keep selection and current-period styling independent

The existing `day_selected`, `day_today`, and selected-month classes remain unchanged. A date or month can therefore show both its selected highlight and its current-period star.

## Risks / Trade-offs

- **A star could reduce the visible numeric context for today:** The complete accessible date remains available, and surrounding dates preserve calendar position.
- **Outside-day duplication could show more than one star:** The renderer requires the date to belong to the displayed month, so adjacent-month cells remain numeric.
- **A module-specific planning date could differ from the machine date:** The shared Calendar continues honoring its explicit `today` prop, preserving owner-local planning semantics.
- **The icon could disturb month-label alignment:** The month button keeps its existing fixed grid dimensions and uses a compact inline icon beside the label.

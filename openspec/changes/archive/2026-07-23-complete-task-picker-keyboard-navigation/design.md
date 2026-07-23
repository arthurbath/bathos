# Design

## Context

BathOS Tasks composes the shared `Calendar` inside two related surfaces. `TaskStartPicker` adds Today horizons, Reminder, and Clear around the calendar, while `DatePickerField` supplies the compact Deadline picker and its Clear action. React DayPicker owns its native day-grid navigation unless BathOS consumes a boundary key first.

The current Start panel intercepts ArrowDown from a Today horizon and focuses a date directly, skipping the calendar controls. Separately, ArrowDown on the final week of Deadline falls through to DayPicker, which pages the calendar to the next month. Enter activates controls, but Tasks does not yet treat every final Start selection as a request to close the popover.

## Goals

- Make vertical focus order reflect the visible Start-picker layout.
- Preserve internal calendar navigation when Enter changes a view or page.
- Close Start only after keyboard confirmation of a final planning choice.
- Prevent native month paging when a shared calendar reaches its lower boundary.
- Reuse shared behavior for Deadline instead of adding a Tasks-only workaround.

## Non-Goals

- Cursor styling or pointer-behavior changes
- Reminder parsing or reminder close-sequence changes
- Date eligibility changes
- Database, API, or persistence-contract changes

## Decisions

### Shared calendar owns day-grid boundaries

`Calendar` will detect downward navigation from the final reachable day row before React DayPicker handles the event. It will consume the key and optionally invoke an explicit lower-boundary focus callback. `DatePickerField` will use that callback to focus Clear.

Keeping boundary detection in the shared calendar prevents native month paging and gives each composition a deliberate destination. When no destination is supplied, focus remains on the current day rather than silently changing months.

### Header-to-grid navigation scans for an enabled destination

ArrowDown from a calendar header control will scan the appropriate visible column for an enabled day and fall back to the first enabled visible day. Month-view paging controls will likewise focus the first selectable month rather than assuming January or March is enabled. This preserves navigation at future-only date boundaries.

### Tasks defines the surrounding Start focus order

`TaskStartPicker` will move ArrowDown from a Today horizon to the active calendar header. In day view that destination is the month caption. In month view it is an enabled year pager. Existing calendar and panel navigation then continue into enabled dates or months and onward to Reminder and Clear.

### Enter intent distinguishes selection from navigation

Internal calendar controls keep their existing Enter activation and leave Start open. Today horizon buttons will explicitly handle Enter as a committed final selection while Space and pointer activation retain the existing keep-open behavior for reminder editing.

For day selection, Tasks will record keyboard Enter intent during calendar key capture, allow the calendar's normal selection path to execute exactly once, and close only after the autosave promise settles. Clear retains its existing committed close behavior.

## Risks and Mitigations

- **Duplicate mutations from native button activation:** Enter handlers prevent the synthetic click where Tasks performs an explicit selection, and tests assert one persistence call.
- **Focus destinations disabled at a date boundary:** shared scans choose enabled destinations instead of fixed row indexes.
- **Regression in pointer workflows:** pointer and Space behavior remain on the existing click path and focused tests cover the distinction.
- **Regression in other calendar consumers:** the lower-boundary callback is optional, and shared calendar tests cover both callback and no-callback behavior.

## Validation

- Focused Vitest coverage for shared Calendar, DatePickerField, and TaskStartPicker behavior
- Tasks typecheck, lint, build, and OpenSpec validation
- Full deterministic test suite
- Rendered desktop and mobile Safari checks of focus order, Enter selection, and Deadline lower-boundary behavior

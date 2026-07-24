## Context

The shared `DatePickerField` already closes after its Calendar `onSelect` callback, but Tasks Start adds its own provisional-selection policy. It records whether a day was activated specifically with Return and closes only in that case. Space follows the button's native click path, so the date saves while the picker remains open. Activating the now-selected date with Return can yield no new selected value, leaving the popover open again. Today horizon buttons similarly close through a bespoke Return handler while Space and pointer activation use a non-closing click handler.

The correction must preserve keyboard navigation actions that intentionally remain inside the picker, including paging months, opening the month picker, choosing a month to return to the day grid, and moving focus with arrow keys.

## Goals / Non-Goals

**Goals:**

- Make pointer, Space, and Return converge on one exactly-once final-selection path.
- Close Tasks Start after a date, Today horizon, or Clear successfully persists.
- Keep navigation-only calendar actions open.
- Preserve trigger focus restoration, autosave ordering, Tab exit, Escape cancellation, reminder editing, and shared `DatePickerField` behavior.
- Prove the shared picker and Tasks Start contracts with focused regression tests and rendered interaction checks.

**Non-Goals:**

- Change reminder parsing or persistence.
- Change available Start horizons, date eligibility, month navigation, or calendar layout.
- Change database, synchronization, or server behavior.
- Close a picker merely because keyboard focus moved to a date.

## Decisions

### Final selections use their native activation path

Date and horizon controls will use their ordinary click/selection callbacks for pointer, Space, and Return activation. The callback will persist the accepted value and close only after the persistence promise resolves.

Alternative considered: Expand the existing keyboard-origin ref to recognize Space. Rejected because it would preserve different pointer and keyboard semantics and retain a fragile second path for Return.

### Date selection always represents confirmation

Once a legal date emits through Calendar `onSelect`, Tasks Start will treat it as final. It will no longer retain a selected-but-unconfirmed date inside the open popover.

Alternative considered: Keep pointer selection provisional while changing only Space. Rejected because the user explicitly rejected the provisional-selection pattern and the shared date-picker contract already treats pointer, Space, and Return as equivalent activation methods.

### Navigation-only controls remain non-final

Calendar page controls, the month/year caption, and month selection will continue to change the internal calendar view without closing. They do not emit the task date-selection callback and therefore remain outside the final-selection path.

### Shared picker coverage guards against regression

Focused tests will verify that `DatePickerField` closes on Space and Return and that Tasks Start closes after the successful final-selection save. Tests will also prove that navigation actions remain open and final selection is committed exactly once.

## Risks / Trade-offs

- [Risk] Closing after every legal Start date removes the ability to set a date and reminder in one uninterrupted opening → Mitigation: The Start trigger can be reopened immediately, and the behavior now matches the explicit final-selection contract.
- [Risk] Native button activation plus a bespoke key handler could dispatch twice → Mitigation: Remove the bespoke final-selection key path and assert exactly-once persistence.
- [Risk] Closing before asynchronous autosave completes could hide a failure → Mitigation: Close only after the existing persistence promise resolves successfully.

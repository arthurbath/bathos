## Context

The shared `Calendar` wraps React DayPicker with BathOS keyboard movement, a custom month grid, and an optional earliest selectable date. Its arrow routine currently targets the cell at the same column in the preceding row without checking whether that button is disabled. Calling `focus()` on that disabled target leaves focus on the current date while the handler consumes the event.

React DayPicker also contributes a `.rdp-button_reset` cursor rule that competes with BathOS button classes. The rendered cursor can therefore change while pointer hit-testing and hover styles settle. Unavailable previous-month and previous-year buttons are disabled but remain visibly present.

Tasks reminder persistence must continue carrying an internal time zone and daylight-saving ambiguity choice, but the user does not need either value as an editable or visible control. The current shorthand editor restores rejected input silently.

## Goals / Non-Goals

**Goals:**

- Let ArrowUp skip any number of disabled date rows and reach the calendar header when no enabled date remains above.
- Hide unavailable backward month and year actions while preserving centered captions and stable layout.
- Make cursor states deterministic for every enabled and disabled calendar action.
- Remove repeated-time and time-zone metadata from to-do and project reminder editing.
- Show one brief generic `Not allowed.` toast for malformed or elapsed reminder shorthand.

**Non-Goals:**

- No reminder schema, delivery, time-zone, daylight-saving resolution, RPC, or PowerSync change.
- No new reminder recurrence behavior.
- No redesign of project reminder persistence or the calendar date grid.
- No detailed validation copy that distinguishes malformed from elapsed input.

## Decisions

### Skip disabled cells inside the shared keyboard graph

`Calendar` will scan upward in the focused date's column until it finds an enabled date. If none exists, it will choose the same calendar-header destination already used by the top row. The shared primitive owns this because the defect affects any lower-bounded calendar, not only Tasks.

The routine will never report a handled focus transfer unless the destination can receive focus. This avoids consuming an arrow event while focus remains trapped.

### Hide unavailable backward actions with visibility, not removal

Disabled previous-month and previous-year buttons will use an invisible state while remaining in the absolute navigation layout. The centered caption therefore keeps the same geometry, while unavailable controls disappear visually and from pointer interaction.

### Override DayPicker cursor defaults explicitly

Calendar day, month, caption, and navigation buttons will use important enabled and disabled cursor utilities. This narrowly resolves the competing DayPicker reset rule without changing the shared BathOS `Button` component or other modules.

### Keep ambiguity deterministic and internal

Tasks will remove repeated-time and time-zone controls from both Start and project reminder editors. Existing reminder metadata remains readable, but every new or edited reminder uses the established earlier-instance default when a daylight-saving time occurs twice. Removing presentation does not change stored reminder identity or resolution.

### Report parser and Today-policy rejection through one toast

The shorthand commit routine will continue returning no mutation and restoring the committed display value on rejection, then emit `Not allowed.` with a short duration. Save or service failures remain governed by existing error handling and do not reuse this validation message.

## Risks / Trade-offs

- **[Risk] Upward scanning could change unrestricted calendar behavior.** → Preserve direct adjacent-row focus whenever that date is enabled and add unrestricted regression coverage.
- **[Risk] Important cursor utilities could override a future custom cursor.** → Scope them only to calendar controls whose enabled/disabled semantics are fixed.
- **[Risk] Hiding the backward action could shift the caption.** → Retain the button in its absolute slot and verify caption center numerically at both day and month views.
- **[Risk] Removing ambiguity controls removes an expert override.** → The product requirement intentionally chooses one deterministic earlier-instance policy and keeps the backend field for compatibility.
- **[Risk] Toast feedback could duplicate on blur after Enter.** → Mark the input confirmed before returning from the rejected commit so one rejected attempt emits one toast.

## Migration Plan

This is a source-only web release with no data migration. Rollback is the prior web bundle. Existing reminders and stored ambiguity choices remain valid.

## Open Questions

None.

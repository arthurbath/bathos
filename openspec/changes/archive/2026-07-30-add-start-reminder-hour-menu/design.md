## Context

The unified Start picker already owns typed reminder normalization, owner-time-zone validation, autosave, and a custom arrow-key focus graph spanning horizons, calendar controls, Reminder, and footer actions. The Reminder field now needs a secondary whole-hour selection path without weakening those existing contracts or allowing the nested menu to close the containing Start picker.

BathOS does not yet include shadcn's shared `InputGroup` primitive, although the repository already contains its Button, Input, Dropdown Menu, and supporting dependencies.

## Goals / Non-Goals

**Goals:**

- Present Reminder as one visually unified input and alarm-clock action.
- Derive legal whole-hour options from the task's Start intent, current instant, and owner planning time zone.
- Preserve typed reminder entry and the two-Enter confirmation behavior.
- Integrate the action button and its menu into the Start picker's spatial keyboard model.
- Keep the hour menu within the available viewport and keep Start open after menu interaction.

**Non-Goals:**

- Replace freeform reminder parsing.
- Offer minute increments, custom presets, recurrence changes, or a new reminder date.
- Change reminder persistence, synchronization, database schema, or delivery.
- Apply the new input group to unrelated BathOS fields in this change.

## Decisions

### Use the shared shadcn Input Group composition

Add the standard `InputGroup`, `InputGroupInput`, `InputGroupAddon`, and `InputGroupButton` primitives under shared UI, adapted to BathOS's existing 40-pixel input height, semantic border tokens, and focus ring. The decoration remains part of the input while the alarm action is an inline-end addon placed after the input in DOM order.

This avoids another Tasks-local flex wrapper and establishes the reusable shared pattern requested for future grouped inputs.

### Use a controlled Radix Dropdown Menu

Compose the alarm action with the existing BathOS `DropdownMenu` primitives and one grouped set of radio items. Radix supplies arrow navigation, Enter and Space activation, focus restoration, and accessible menu semantics. The content receives an available-height bound plus vertical scrolling.

The Start panel's capture handler ignores keyboard events originating in the open hour menu so Radix owns menu arrows and Escape. Closing the nested menu restores focus to the alarm button rather than closing Start.

### Derive options in the reminder-time domain

Add a pure helper that returns canonical `HH:00` values and the existing normalized display label:

- Future Start: hours 00 through 23.
- Today horizon or no Start intent: only hours whose exact whole-hour value is strictly later than the current owner-local time.

The no-Start case deliberately follows existing reminder-initiated planning, where a successful reminder first assigns Today Inbox. The UI refreshes its current instant while Start remains open so the option set and disabled state do not become stale.

### Treat menu selection as one direct reminder choice

Selecting a menu item immediately submits its canonical time through the existing `onReminderChange` path and updates the visible input, while leaving Start open. It does not require the typed-input normalization step because the menu value is already canonical and legal.

### Extend spatial focus based on geometry

- Right Arrow at the end of Reminder moves to the alarm button.
- Right Arrow within the input text remains native.
- Left Arrow on the alarm button returns to the end of Reminder.
- Up and Down from the alarm button move to the calendar and the right footer action.
- The existing calendar and left footer paths continue to land on Reminder.
- A disabled alarm action is skipped.

## Risks / Trade-offs

- [Nested overlay events could reach the Start capture handler] -> Mark the nested menu surface and bypass Start-level key handling while the menu owns focus.
- [The current hour can change while Start remains open] -> Refresh the owner-local availability clock periodically only while the panel is active.
- [Saving an unplanned reminder also changes Start] -> Reuse the existing reminder-initiated Today Inbox callback instead of introducing a separate mutation path.
- [Adding a shared primitive could visually diverge from existing inputs] -> Match current BathOS input dimensions, semantic tokens, disabled treatment, and focus ring, then verify the rendered Start picker.

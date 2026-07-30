## Context

Control+E already resolves the eligible task, opens its editor when necessary, and dispatches an open request to the Start trigger. The Start picker independently owns its horizon, calendar, Reminder, and footer focus graph. Repeating the global command while the picker is open currently sends another open request that produces no focus change.

The shared Calendar already supports a controlled visible month and exact post-render day focus. The picker needs a stable date identity on rendered day buttons so command traversal can calculate and focus the next date without activating it.

## Goals / Non-Goals

**Goals:**

- Reuse the existing Tasks command and Start picker rather than create a second planning surface.
- Keep command traversal non-committing until Enter or Space activates a choice.
- Make horizon-to-calendar and month-to-month transitions deterministic.
- Preserve existing arrow, Tab, Reminder, Clear, and Someday navigation.

**Non-Goals:**

- Change the separate Control+R horizon mutation command.
- Apply the traversal to bulk planning, where one shared current Start target is undefined.
- Change Start persistence, calendar eligibility, or Reminder rules.
- Add database, Supabase, or cross-module behavior.

## Decisions

1. The mounted Start picker owns advancement. When Tasks receives the Start command and finds an active picker, it dispatches a dedicated advancement event to that picker instead of reopening it. This preserves one source of truth for the picker's focus graph.

2. The focus sequence is derived from the focused element. Horizon buttons advance by their canonical presentation order. A focused calendar day advances by one calendar day. If focus is elsewhere in the picker, the command restores focus to the task's current Start choice rather than guessing a forward step.

3. Calendar month and exact date focus are controlled by picker state. Crossing a month boundary updates the visible month and requests exact focus after React renders the new calendar. Calendar day buttons expose a machine-readable local calendar date for reliable lookup.

   Exact-focus requests also carry a monotonically increasing request identity. This lets the picker request the same date again after manual arrow navigation rather than relying on a date value that React may correctly regard as unchanged.

4. The first command retains existing behavior. The editor opens when necessary, then Start opens and focuses the selected horizon, selected date, Someday control, or Inbox fallback.

5. Bulk selection retains the existing bulk Start surface. Progressive focus is only meaningful for a single task and therefore does not alter bulk command semantics.

6. The shared Calendar retains its composed arrow-focus graph, including date-picker-specific exits at legal boundaries. When that graph selects an enabled outside-month day, Calendar changes its controlled or uncontrolled display month and defers focus to the same date after the new month renders. This makes adjacent-month date navigation consistent across BathOS without introducing Tasks-specific arrow handling.

## Risks / Trade-offs

- **Risk: Command and React render timing can race at a month boundary.** → Use controlled Calendar state and its post-render exact-date focus request rather than a blind timer that queries the old month.
- **Risk: A dedicated custom event adds another internal command path.** → Keep the event module-local, typed, and covered by Tasks-shell tests.
- **Risk: Shared Calendar day metadata could affect other consumers.** → Add only a passive `data-calendar-date` attribute with no styling or behavior change.
- **Risk: Paging on an outside-month arrow target can unmount the element before focus settles.** → Record the target date, commit the month change, and reuse Calendar's post-render day-focus path.
- **Risk: Re-requesting an unchanged date value can leave focus on the manually navigated day.** → Include a request identity in the focus effect dependency so every command invocation is observable.
- **Trade-off: Someday is outside the progressive Today/future sequence.** → The first command still focuses the selected Someday control; a subsequent command returns to Inbox as the beginning of the forward planning sequence.

## Migration Plan

No data migration is required. The change is a backward-compatible keyboard enhancement. Rollback removes the advancement event, picker month/focus state, repeatable focus identity, shared outside-month arrow paging, and passive Calendar day attribute.

## Open Questions

None.

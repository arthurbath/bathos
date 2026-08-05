## Context

Tasks stores reminder intent independently from task planning, then binds each active reminder to the task's effective Start date. The current database trigger already cancels a reminder when no effective date remains, but the client still exposes Reminder before planning, and neither in-app acknowledgement nor accepted Web Push delivery retires the reminder itself. The mixed Upcoming activation path already merges ordinary tasks and newly generated recurrence instances, but equal Upcoming keys use a different stable tie-breaker after recurrence materialization than the web list used before midnight.

The shared Apple widget renderer combines a custom 1.6-point clock drawing with an SF Symbol tray whose apparent line weight is different. The Watch capture control uses the system green fill without the lighter outline used by the primary add action elsewhere.

## Goals / Non-Goals

**Goals:**

- Make reminder availability and lifecycle follow Start planning consistently in the client and database.
- Retire a one-shot reminder as soon as one alert channel successfully triggers it.
- Keep reminder cancellation authoritative under synchronization, automation, native shortcuts, and direct UI edits.
- Make mixed Upcoming activation use the same stable identity ordering as the displayed list when ordering keys tie.
- Unify native horizon-marker stroke weight and refine the Watch capture control.

**Non-Goals:**

- Add repeating or snoozable reminders.
- Add native notification delivery or change Web Push authorization.
- Rebuild the Today automatic-sort model or repair historical Today order after activation.
- Change horizon colors, marker dimensions, widget families, or Watch capture behavior.

## Decisions

### Enforce reminder eligibility at both the UI and database boundaries

The Start picker will render its entire Reminder row only when the task has a Today horizon or a future Start date. The reminder shortcut will use the same eligibility predicate and issue a warning toast rather than opening Start when planning is absent or Someday.

The database rebind trigger remains authoritative for every mutation source. It will cancel active reminder intent when effective Start becomes unavailable or when a newly same-day-bound reminder instant is no longer in the future. Client-side cancellation remains optimistic presentation, not the sole correctness boundary.

### Retire one-shot intent from successful delivery paths

In-app acknowledgement and accepted Web Push delivery are both evidence that the alert triggered. The corresponding database functions will retire the active reminder and cancel remaining scheduled deliveries for that reminder. Failed provider attempts do not retire reminder intent.

This is preferred over clearing only on toast dismissal because native or Web Push alerts can trigger without a Tasks page being open, and the user's one-shot intent should not remain active after a successful alert.

### Match the web list's tie-break identity during activation

Activation continues to sort by controlling date and Upcoming key. When keys tie, ordinary rows use `task:<task id>` and generated recurrence rows use `recurrence:<definition id>`, matching the identities used by the mixed Upcoming renderer. This avoids depending on a generated instance UUID that did not exist when the user arranged the list.

### Draw every horizon marker with the same stroke system

The shared widget renderer will draw the Inbox tray in Canvas with the same 1.6-point rounded stroke used by the clock markers. One source remains shared by iOS and macOS.

### Use native semantic green layers on Watch

The Watch capture control will retain a circular 64-point hit target and white plus symbol, use a slightly darkened system-green fill, and add a thin lighter-green circular stroke. The control remains stable when status text appears.

## Risks / Trade-offs

- [Risk] Retiring a reminder on Web Push provider acceptance does not prove the user read it. -> Mitigation: the requirement is alert triggering, and provider acceptance is the strongest available delivery boundary without adding receipt infrastructure.
- [Risk] Rebinding after a same-day time passes could leave historical occurrence rows. -> Mitigation: retain immutable history while canceling active reminder intent and every still-scheduled delivery.
- [Risk] Existing duplicate Upcoming keys remain stored. -> Mitigation: activation uses the same deterministic tie-break as the visible list, so exact displayed order is preserved without a broad rewrite.
- [Risk] A custom tray can drift visually across sizes. -> Mitigation: use the same frame, line width, caps, and joins as the clock markers, then compile the shared widget target for both companion platforms.

## Migration Plan

Add two forward-only migrations: one replaces the reminder rebind, acknowledgement, and Web Push result functions, while the second replaces activation ordering. No table shape or data backfill is required. Deploy web and database behavior together so client affordances match server enforcement; native visual changes may ship independently. Rollback restores the prior function definitions and native views, while already canceled one-shot reminders remain valid historical state.

## Open Questions

None.

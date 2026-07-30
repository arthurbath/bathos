## Context

Tasks already opens Quick Find from unmodified typing. Touch devices have no equivalent keyboard-first entry, while the global installed-app pull-to-refresh gesture competes for the same top-of-page pull.

## Goals / Non-Goals

**Goals:**

- Make Quick Find available through a deliberate pull from scroll top on touch devices.
- Show progressive visual feedback before activation.
- Keep a visible Search button on list pages.

**Non-Goals:**

- Add the gesture to non-touch devices or Settings.
- Replace ordinary page scrolling away from the top.
- Create a second search implementation.

## Decisions

1. Touch eligibility uses touch capability rather than viewport width.
2. The gesture begins only at scroll top and only from a downward touch movement.
3. Pull progress controls magnifying-glass opacity and translation; release beyond the threshold opens the existing Quick Find dialog.
4. Tasks suppresses the competing global pull-to-refresh action so one gesture has one result.
5. The top-right Search button invokes the same Quick Find state and is rendered only on task lists.

## Risks / Trade-offs

- **Risk: The gesture competes with browser overscroll.** Track only a single touch that starts at scroll top and cancel local state promptly when direction changes.
- **Risk: Pull-to-refresh also fires.** Disable the global action on Tasks routes.
- **Trade-off: Touch-capable laptops may receive the gesture.** This follows actual touch capability and does not affect mouse input.

## Migration Plan

No migration is required. Rollback removes the task gesture and restores ordinary installed-app pull-to-refresh behavior on Tasks.

## Open Questions

None.

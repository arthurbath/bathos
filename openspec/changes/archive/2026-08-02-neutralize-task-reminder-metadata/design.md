## Context

Task-row metadata inherits a muted gray color from its containing second line, but the Reminder child currently overrides that color with the semantic blue link token. The Reminder item is informational and is not interactive.

## Goals / Non-Goals

**Goals:**

- Make Reminder icon and time text match ordinary secondary metadata.
- Keep external Primary Link actions visually blue.
- Prevent a future regression that conflates reminder status with link affordance.

**Non-Goals:**

- Changing Reminder scheduling, labels, order, accessibility, or interaction behavior.
- Changing semantic colors for horizons, actionability, deadlines, or Primary Links.

## Decisions

- Remove the Reminder item's blue override and use the explicit muted-foreground text token. This makes the intended semantic color independently testable while remaining consistent with the metadata-line parent.
- Assert the Reminder and Primary Link treatments in the existing task-row metadata test surface rather than introducing a visual-only snapshot.

## Risks / Trade-offs

- [Risk] A broad metadata selector could accidentally neutralize other semantic indicators. -> Mitigation: change only the Reminder wrapper and assert that its Primary Link sibling remains blue.

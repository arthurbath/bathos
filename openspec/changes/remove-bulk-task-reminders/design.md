## Context

Tasks currently routes the reminder keyboard command to either the Start picker for one open task or a dedicated bulk reminder popover for an explicit task selection. The bulk surface duplicates parsing and validation while also coordinating atomic reminder eligibility across heterogeneous Start states. The product decision is to keep reminders individual and remove that entire selection-mode branch.

## Goals / Non-Goals

**Goals:**

- Make the reminder shortcut inert whenever selection mode is active.
- Remove the dedicated bulk reminder component, state, callbacks, and validation paths.
- Preserve reminder editing for one open task through the existing Start picker.
- Keep selection membership and task data unchanged when the ignored shortcut is invoked.

**Non-Goals:**

- Changing reminder storage, delivery, shorthand parsing, or individual-task validation.
- Removing reminders when another bulk planning action clears or invalidates Start.
- Adding alternative bulk reminder controls.

## Decisions

### Gate the command at target resolution

The reminder command will return immediately when selection mode is active instead of opening a surface or attempting a mutation. This makes the rule independent of selection count and prevents a one-task explicit selection from being mistaken for an individually open task.

Alternative considered: disable only selections containing multiple tasks. Rejected because selection mode is itself the bulk-edit context, and allowing a one-task exception would make the command change meaning as selection membership changes.

### Delete the bulk surface rather than leave dormant code

The dedicated bulk reminder UI, state, and submission helpers will be removed. Keeping an unreachable component would preserve unnecessary conditional logic and invite accidental reactivation.

Alternative considered: leave the component unused. Rejected because the user explicitly does not intend to restore this capability.

### Preserve individual Start-picker reminder behavior

Control+B continues to open one ordinary open task's Start picker with Reminder focused. Reminder parsing and persistence remain owned by that individual editor path.

## Risks / Trade-offs

- [Risk] Removing shared helper code could accidentally affect the individual Start picker. -> Mitigation: delete only bulk-owned state and UI, then retain and rerun individual reminder shortcut tests.
- [Risk] The browser could react to Control+B if Tasks does not consume the ignored command. -> Mitigation: keep the command recognized and prevented while returning before any Tasks mutation or UI transition.

## Why

BathOS needs a compact, reusable way to identify single-line controls when visible labels would consume scarce space. Tasks already relies on placeholders and programmatic names in its metadata drawer, so optional left-side Lucide decorations can improve recognition without changing field behavior or forcing a module-specific styling substitute.

## What Changes

- Add an optional shared decoration contract for BathOS single-line text inputs, Select triggers, and date-picker triggers.
- Keep the decoration pinned inside the left content area with muted control-icon styling while reserving enough content space to prevent text collisions.
- Apply decorations to the Tasks metadata drawer's Primary Link, Start, Deadline, Area, and Actionability controls.
- Restyle the Start picker's Reminder as a full-width decorated input without a visible label, and center its Clear and Someday action labels.
- Change generic Primary Link identity to Lucide `Link2` on task rows, editor decoration, and the iOS widget, while keeping the adjacent link-launch action as Lucide `ExternalLink`.
- Change Deadline identity to Lucide `Flag` and Ready actionability identity to Lucide `ArrowBigRightDash`.
- Apply the established Today-horizon colors to Start decorations, the established non-Ready purple to Waiting and Rechecking decorations, and destructive red to Deadline decorations and values due today or earlier.
- Keep ordinary task and checklist completion boxes gray in both unchecked and checked states, without a green hover treatment.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Allow optional, collision-safe leading decorations on shared single-line BathOS controls.
- `personal-tasks-module`: Define Tasks metadata decorations, Reminder layout, centered Start actions, and revised Primary Link, Deadline, and Ready iconography.
- `tasks-ios-companion`: Keep the generic Primary Link icon in the iOS widget aligned with the Tasks web icon contract.

## Impact

- Shared UI primitives in `src/components/ui/`
- Tasks editor, Start picker, task-row icon mapping, tests, and iconography documentation
- iOS widget Primary Link symbol mapping and native tests
- No database, synchronization, authentication, or migration changes

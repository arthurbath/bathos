## Context

Ordinary tasks render through `TaskPlanningCard` and `TaskEditor`, while recurrence prototypes render through `TaskRecurrencePrototypeRow` and a separately implemented `RecurrencePrototypeEditor`. Both editors represent the same Summary, Notes, Primary Link, Area, Actionability, and Checklist concepts, but the duplicated JSX and checklist interaction logic have already diverged. Prototype persistence must continue writing immutable recurrence revisions rather than ordinary task and checklist tables.

## Goals / Non-Goals

**Goals:**

- Give ordinary tasks and recurrence prototypes one shared metadata-field rendering implementation.
- Give both surfaces the complete ordinary checklist interaction model while preserving their different persistence backends.
- Centralize Upcoming open-editor ownership so only one task-like row is open.
- Keep prototype-specific recurrence controls explicit and narrowly conditional.

**Non-Goals:**

- Converting recurrence prototypes into ordinary task database rows.
- Allowing prototypes to be completed, bulk-selected, assigned an independent Start or Deadline, or dragged across cadence buckets.
- Changing recurrence scheduling, generation, revision, or server evaluation behavior.
- Adding database migrations or new dependencies.

## Decisions

### Extract shared metadata drawer fields

Create one task-module component that renders Summary, Notes, Primary Link, Checklist, Area, and Actionability plus injectable schedule controls. Ordinary `TaskEditor` and the prototype editor retain their persistence queues and controlled values but delegate all shared field rendering to this component.

This is preferred over styling the prototype implementation to resemble `TaskEditor` because duplicate markup would continue drifting after future task-drawer changes.

### Split checklist interaction UI from persistence

Refactor `TaskChecklistEditor` into a standard wrapper around a reusable checklist editor surface that accepts a narrow controller interface. The ordinary wrapper supplies the existing `useTaskChecklist` controller. The recurrence prototype supplies an in-memory controller that maps prototype snapshot checklist nodes into the same editor item contract and persists each accepted change by creating a recurrence revision.

This preserves one checklist component and interaction model without storing prototype checklist nodes in ordinary checklist tables.

### Centralize open prototype identity in TasksShell

`TasksShell` owns the open recurrence prototype ID alongside the existing ordinary open-task identity. Prototype rows become controlled. Opening either kind first closes the currently open counterpart through its normal flush/close lifecycle, then opens the requested row. Shared row styling uses the ordinary task open/focus class contract.

This is preferred over document events because editor ownership and autosave ordering remain explicit and testable.

### Encode prototype exceptions as slots and capability flags

The shared drawer receives an injected full-width Edit Repeat control where ordinary tasks supply Start and Deadline controls. Prototype rows retain the recurrence icon, omit completion and selection controls, and continue routing cadence edits through the atomic repeat dialog.

## Risks / Trade-offs

- [Risk] Adapting recurrence snapshots to the full checklist interaction surface could accidentally persist empty draft rows. -> Keep drafts inside the shared editor and persist only normalized nonempty snapshot items.
- [Risk] Switching open rows could race a queued prototype autosave. -> Register the prototype flush function with `TasksShell` and await it before changing the central open identity.
- [Risk] A large extraction from `TasksShell` could disturb ordinary task behavior. -> Preserve existing task persistence code, move rendering behind typed props, and run the full TasksShell suite plus rendered ordinary/prototype interaction checks.
- [Trade-off] Prototype checklist edits will use recurrence revision saves rather than ordinary checklist history rows. -> The visible interaction remains identical while recurrence revisions remain the correct authoritative history.

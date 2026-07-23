## Why

BathOS Tasks currently exposes one planning intent across three separate fields, prevents Today work from carrying a reminder, and allows the database to silently recreate a Mail-derived Primary Link after the user clears it. The task action menu also exposes redundant lifecycle and ordering commands instead of the requested Move, Do, and Start structure.

## What Changes

- Replace the separate Start Date, Day Horizon, and Reminder Time editor controls with one Tasks-specific Start picker built from the shared BathOS popover and calendar primitives.
- Let the picker assign a Today horizon, choose any future date while disabling today and the past, add or clear a reminder time, and clear the complete Start intent with immediate persistence and complete keyboard traversal.
- Make the reminder keyboard command open the Start picker with its reminder-time control focused.
- Allow Today work to carry a reminder anchored to the owner's planning date while retaining future-date anchoring for deferred work.
- Split the to-do action menu into Move, Do, and Start surfaces; remove Cancel and menu-only Move Up and Move Down actions while retaining drag and keyboard ordering.
- Preserve an explicitly cleared Primary Link instead of recreating it from immutable Mail provenance.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Changes to editable Primary Link independence, task menu actions, Start planning and reminder behavior, keyboard commands, and compact editor presentation.

## Impact

- Tasks editor, task-row action menu, command surfaces, keyboard command dispatch, and their tests.
- Tasks reminder service and synchronized projection assumptions.
- Shared Calendar keyboard behavior through an opt-in tab-traversal mode.
- Supabase reminder anchoring, reminder save RPC behavior, Primary Link normalization, export normalization, generated database types, and production migration/acceptance coverage.
- No imports across BathOS module boundaries and no new runtime dependency.

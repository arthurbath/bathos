# Change: Refine task list row parity

## Why

Ordinary tasks, recurrence prototypes, and checklist rows still diverge in alignment, keyboard traversal, link activation, and drag ownership. Those differences waste horizontal space, hide valid keyboard destinations, and prevent standard text selection inside checklist inputs.

## What Changes

- Align task-list rows with the surrounding content edge while preserving the inset inside highlighted rows and metadata drawers.
- Keep the metadata drawer horizontal inset constant at every viewport width and align checklist completion controls with its fields.
- Suppress redundant Area metadata in visible Someday Area buckets.
- Add a Today-only bulk Horizon submenu with the four canonical colored horizon choices.
- Preserve Primary Link activation when another task drawer must close first.
- Include scheduled recurrence prototypes in ordinary Upcoming keyboard traversal and activation.
- Support Command-modified horizontal checklist boundary traversal.
- Make checklist rows draggable only from permanently visible handles, remove the Drag Handles preference, and expose task-row handles automatically only on touch-capable surfaces.

## Impact

- Affected specs: `personal-tasks-module`
- Affected code: Tasks list layout, ordinary and recurrence rows, checklist editor, bulk toolbar, Tasks settings, task keyboard traversal, and associated tests.
- Data impact: the retired synchronized drag-handle preference may remain readable for cached clients but no longer controls current UI.

## 1. Start Picker Behavior

- [x] 1.1 Keep Reminder editable for connected unplanned to-dos while preserving storage-availability disablement.
- [x] 1.2 Validate an unplanned reminder as owner-local Today before any mutation.
- [x] 1.3 Serialize Today · Inbox planning before reminder persistence in the expanded editor and row Start dialog.
- [x] 1.4 Preserve existing future Start Dates and Today horizons when saving a reminder.
- [x] 1.5 Retain Today · Inbox and pending reminder intent in an untitled new-task draft.

## 2. Regression Coverage

- [x] 2.1 Add an existing-task regression for enabled reminder entry, ordered Inbox planning, and reminder persistence.
- [x] 2.2 Add regressions for preserving existing planning and rejecting elapsed unplanned reminder times.
- [x] 2.3 Add a new-task draft regression proving planned creation precedes pending reminder persistence.

## 3. Validation and Closeout

- [x] 3.1 Run focused tests, Tasks typecheck, lint, build, and strict OpenSpec validation.
- [x] 3.2 Verify the unplanned reminder flow in the rendered Tasks Start picker without retaining synthetic task data.
- [x] 3.3 Run the deterministic full suite, sync durable specs, archive the change, commit, push, and audit repository parity.

## 1. Preference Storage

- [x] 1.1 Add and validate the defaulted drag-handle visibility setting in Supabase and synchronized schemas.
- [x] 1.2 Add typed repository and hook support for reading and changing the preference.
- [x] 1.3 Add the three-state Drag Handles control to the Tasks Features settings card.

## 2. Immediate Pointer Drag Foundation

- [x] 2.1 Add the canonical Tasks grip icon, visibility context, and accessible handle component.
- [x] 2.2 Add scoped pointer drop-target discovery, pointer capture, drag preview, and edge auto-scroll support.
- [x] 2.3 Ensure handle gestures suppress scrolling only on the handle and do not activate row swipe, selection, editing, or ellipsis actions.

## 3. Task And Prototype Reordering

- [x] 3.1 Connect ordinary task handles to the existing single-task and grouped task drag transaction.
- [x] 3.2 Connect recurrence prototype handles and legal task/section drop targets to existing Upcoming ordering rules.
- [x] 3.3 Preserve open-task autosave closure, unsupported-surface restrictions, indicators, selection, persistence, history, and rollback.

## 4. Checklist Reordering

- [x] 4.1 Add handles to persisted and draft checklist rows when the preference resolves visible.
- [x] 4.2 Connect handle pointer movement and release to checklist-scoped insertion targets and existing single/group commit logic.
- [x] 4.3 Preserve text editing, completion, checklist multi-selection, nested drag ownership, persistence, history, and rollback.

## 5. Verification

- [x] 5.1 Add tests for preference persistence and Hidden, Always, and Touch Devices Only resolution.
- [x] 5.2 Add pointer-interaction tests proving immediate handle drag, handle-scoped scroll suppression, legal drops, and unchanged outside-handle scrolling.
- [x] 5.3 Run targeted tests, the full test suite, lint, build, migration checks, and OpenSpec validation.
  - Automated application checks pass. The production migration dry run, apply, migration-history readback, schema/default/constraint readback, normalizer readback, and relevant security/performance advisor checks pass. The local database stack remains unavailable because the existing Colima Docker socket cannot be mounted.
- [x] 5.4 Audit the implementation against every proposal, design, and specification requirement and record any manual touch-device verification still needed.
  - A final physical iPhone/PWA gesture pass is still needed after the matching web release is published and the setting can safely be changed on the synced account.

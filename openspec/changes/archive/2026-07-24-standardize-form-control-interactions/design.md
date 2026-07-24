## Context

BathOS already has several pieces of the desired interaction model, but they are distributed across native browser behavior, `useCommandEnterSubmit`, modal keyboard helpers, DataGrid cell primitives, Radix composite controls, and module-specific key handlers. Ordinary text inputs currently edit directly, DataGrid text cells already distinguish focused and editing states, dialogs already trap Tab, and Tasks already owns several application shortcuts. The inconsistencies are in command precedence, default Return submission, form cancellation, Tab boundaries, safe resets, date-picker traversal, and duplicated modal/page handling.

The final product contract deliberately diverges from ordinary browser forms in two places. Return does not submit a form from a text input unless that form opts in, and plain Escape never bubbles from field-level cancellation into form-level cancellation. Command+Return and Command+Escape are the explicit Mac form commands. Windows uses Control+Return and Control+Shift+X because Windows reserves both Control+Escape and Control+Shift+Escape for operating-system actions.

## Goals / Non-Goals

**Goals:**

- Establish one shared, testable field-level and form-level command hierarchy.
- Keep ordinary form text controls continuously editable and preserve native text, composition, autofill, file, color, password, email, time, and validation behavior.
- Retain spreadsheet-style focused and editing states only for text-entry cells inside DataGrids.
- Make form submit/cancel behavior declarative, nearest-scope, validation-aware, and usable from portals.
- Make Return-to-submit an explicit form opt-in and enable it on gateway forms plus already-specified compact capture forms.
- Make modal, page, DataGrid, select, multi-select, date-picker, Tasks, file, and color-control behavior consistent without cross-module imports.
- Preserve pointer-selected DataGrid editing state and optimistic async-save behavior while changing traversal.

**Non-Goals:**

- Add radio-button requirements before BathOS uses radio groups.
- Add database, Supabase, PowerSync, notification, or service changes.
- Replace Radix primitives or introduce a new form library.
- Add arrow-key traversal to arbitrary non-DataGrid forms.
- Make Command+Escape roll back already-persisted autosave changes.
- Add separate view/edit states to ordinary text inputs.

## Decisions

### Centralize form-level commands at the document boundary

Replace the narrow Command+Return hook and duplicated modal submission code with one document capture listener mounted once by the platform. The listener will:

- ignore composition events
- identify the nearest owning native form, declared in-page form scope, dialog, alert dialog, sheet, or autosaving editor scope
- intercept Mac Command+Return and Windows Control+Return for submission
- intercept Mac Command+Escape and Windows Control+Shift+X for cancellation or close
- call `requestSubmit()` for native forms so HTML validation and submitter behavior remain authoritative
- activate an explicitly declared submit or cancel action for non-form scopes
- do nothing when the nearest scope has no legal enabled action

Modifier commands take precedence over ordinary field handlers. A form-level submit uses committed field values and current native text values. It does not implicitly accept a merely focused provisional option inside a composite popup.

Alternative considered: Keep independent page, dialog, sheet, and module listeners. Rejected because precedence and portal behavior would remain inconsistent and every new surface would need bespoke code.

### Make form behavior declarative

Use shared data attributes and helper props rather than relying on button text or DOM order:

- form/scope marker
- explicit submit action
- explicit cancel/close action
- Return-to-submit opt-in
- autosave-close semantic when cancellation cannot roll back persisted changes

Existing compatibility attributes may remain temporarily during migration, but the shared helper will own their interpretation and tests.

Alternative considered: Require every form to use a new wrapper component. Rejected because BathOS contains native forms, non-form modal actions, autosaving editors, and module-specific layouts. A small hook plus declarative markers migrates them without unnecessary wrapper nesting.

### Suppress default text-input Return submission unless opted in

The shared capture listener will prevent unmodified Return from implicitly submitting a native form when focus is in a single-line text-entry control and the owning form has not opted in. It will not interfere with:

- textarea newlines
- button, link, checkbox, toggle, select, date-picker, or composite-control activation
- composition events
- an explicitly opted-in form

Gateway login, signup, password recovery, password reset, and any other gateway authentication form will opt in. Existing Tasks hierarchy capture forms whose durable specification explicitly requires Return submission will also opt in.

### Keep plain Escape field-local

Dialog and alert-dialog primitives will prevent their library default from closing on unmodified Escape. Open selects, multi-selects, date pickers, and other composite fields may consume Escape to revert or close their own deepest active layer. If no field owns Escape, it performs no form-level action.

Command+Escape on Mac and Control+Shift+X on Windows invoke the nearest form cancel/close action. Explicit Save/Cancel forms discard their draft through their existing cancel path. Autosaving surfaces close after flushing accepted changes and do not pretend to roll them back.

### Keep native activation semantics

Space and Return continue to activate native buttons, button-like composite controls, checkboxes, switches, multi-select options, and static links. Static links preserve modified-click and middle-click behavior. Specialized controls inherit native behavior unless the shared specification deliberately overrides it.

### Treat Tab as commit-and-traverse

Ordinary forms use DOM Tab order. Modal scopes wrap Tab within the modal. Leaving a control by Tab or Shift+Tab commits its current accepted state.

Open selects and multi-selects close before traversal and commit their current accepted or staged selection. Open date pickers close before traversal without converting a merely focused date into a selected value. Their internal calendar controls are excluded from the containing form's Tab sequence and remain arrow-navigable.

DataGrid Tab traversal commits an editing cell, moves horizontally, wraps to the next or previous row, skips unavailable cells, and exits the grid at the first or last boundary. Browser focus traversal resumes outside the grid at those boundaries.

### Keep DataGrid editing state in shared primitives

DataGrid text, number, currency, percentage, URL, email, password, and time-entry cells use the existing focused/editing state machine:

- pointer activation enters editing at the clicked insertion point
- Return enters editing at the end or commits and leaves editing
- printable input from focused mode replaces the full value and enters editing
- Escape while editing restores the edit-entry value and returns to focused mode
- Delete or Backspace from focused mode uses only an explicitly declared legal reset target
- arrow keys move spatially only while not editing
- arrow keys remain native cursor movement while editing, including at string boundaries

The existing async focus-restoration signal remains authoritative so a pointer-selected destination re-enters editing after an earlier save resolves.

### Preserve safe resets

No shared control infers a reset by selecting its first option. Reset behavior exists only when the caller declares a legal target. Nullable values may clear, zeroable required numbers may reset to zero, checkboxes and toggles may reset false/off, and selects may reset only through a real null/none option.

### Keep shared and module-specific date behavior separate

The shared date-picker contract owns trigger activation, legal initial focus, arrow navigation, Space/Return activation, Escape cancellation, Tab exit, and optional clearing. Tasks-specific Today horizons, Inbox focus, reminder entry, and planning boundaries remain in the Tasks capability.

### Test the contract at shared and representative integration layers

Shared tests will cover command recognition, nearest-scope resolution, Return opt-in, modal Escape suppression, Tab trapping, composite activation, DataGrid traversal, reset safety, composition, disabled/read-only controls, and async pointer restoration. Representative integration tests will cover gateway forms, a non-gateway modal, an in-page form, Tasks editor closure, Tasks Start traversal, file input preservation, and a color control.

## Risks / Trade-offs

- [Risk] The global Return suppression could block an intentionally compact form → Mitigation: Inventory every native form, mark existing required exceptions explicitly, and test every gateway form.
- [Risk] Radix primitives may close or act before the shared listener → Mitigation: Handle form commands in document capture, prevent library Escape dismissal at the primitive boundary, and retain field-local handlers for ordinary Escape.
- [Risk] DataGrid traversal changes could regress async focus restoration or sticky scrolling → Mitigation: Extend the existing focus suite rather than replacing its helpers, and retain explicit pointer-origin editing restoration.
- [Risk] A non-form dialog may not expose a real cancel action → Mitigation: Require explicit shared cancel/close markers and no-op when no legal action exists.
- [Risk] Control+Shift+X could overlap a module command → Mitigation: Treat it consistently as the Windows form cancel/close command. Tasks already uses it for editor closure.
- [Risk] Removing plain Escape modal closure diverges from common accessibility conventions → Mitigation: Keep every visible Cancel/Close action in the Tab order, publish `aria-keyshortcuts`, test screen-reader names and focus restoration, and preserve field-local Escape.
- [Risk] File, color, and mobile controls could be harmed by over-broad key interception → Mitigation: Limit text Return suppression to single-line text-entry targets and leave unenumerated native interaction untouched.

## Migration Plan

1. Add the shared form-command classifier, scope resolver, helper attributes, and tests.
2. Replace the existing global Command+Return hook and modal Command+Return duplication.
3. Migrate dialog, alert-dialog, and sheet primitives to the new command and Escape contract.
4. Mark gateway and already-specified compact Return-submit forms.
5. Update shared select, date-picker, calendar, file, and color-control tests.
6. Update DataGrid traversal and cell state behavior with regression coverage.
7. Migrate Tasks editor and Start picker commands, help text, and durable requirements.
8. Audit every native form and declared modal action, then run the complete validation suite.

Rollback is code-only. Reverting the shared helper and migrated call sites restores the previous behavior without data migration.

## Open Questions

None. Control+Shift+Escape is not implementable as a browser-level Windows command because Windows reserves it for Task Manager, so the design uses the existing capturable Tasks convention, Control+Shift+X.

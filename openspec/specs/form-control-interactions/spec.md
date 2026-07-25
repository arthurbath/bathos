# Form Control Interactions Specification

## Purpose

Define predictable, accessible field-level, form-level, modal, DataGrid, composite-control, reset, and keyboard traversal behavior throughout BathOS.

## Requirements

### Requirement: Field and form commands have distinct scopes
BathOS SHALL distinguish field-level interaction from form-level submission and cancellation. Space, Return, and Escape SHALL act at the field level unless a more specific control contract applies. Command+Return and Command+Escape on Mac, and Control+Return and Control+Shift+X on Windows, SHALL act on the nearest owning form or declared form scope from every descendant control.

#### Scenario: Submit the nearest native form
- **WHEN** focus is inside a native form and the user invokes the platform form-submit command outside active composition
- **THEN** BathOS prevents the matching browser action and submits that form through its validation-aware native submission path

#### Scenario: Submit a declared non-form scope
- **WHEN** focus is inside a declared form scope with no native form and the user invokes the platform form-submit command
- **THEN** BathOS activates that scope's enabled declared submit action exactly once

#### Scenario: Cancel the nearest form scope
- **WHEN** focus is inside a form, dialog, alert dialog, sheet, or autosaving editor and the user invokes the platform form-cancel command
- **THEN** BathOS prevents the matching browser or operating-system-independent page action and invokes that nearest scope's enabled declared cancel or close action exactly once

#### Scenario: Respect command precedence
- **WHEN** a form-level submit or cancel command originates inside a text editor, select, date picker, file input, color control, or DataGrid cell
- **THEN** the form-level command takes precedence over the same base key's field-level behavior without accepting a merely focused provisional composite value

#### Scenario: Ignore unsupported form commands
- **WHEN** the nearest scope has no legal enabled submit or cancel action
- **THEN** BathOS performs no substitute action and does not activate an unrelated ancestor scope

#### Scenario: Preserve composition
- **WHEN** an input method editor or other keyboard composition session owns the event
- **THEN** BathOS performs no field-level or form-level shortcut interception

### Requirement: Form submission and cancellation respect persistence style
Field commit SHALL finalize a control's accepted value without implying form persistence. Form submit SHALL invoke the owner's validation and persistence action. Form cancel SHALL use the owning surface's declared cancellation semantics.

#### Scenario: Submit a draft form
- **WHEN** a user submits a valid explicit Save/Cancel form
- **THEN** the form persists through its ordinary submit path and closes only when that owner accepts the submission

#### Scenario: Reject an invalid submission
- **WHEN** a user submits a form whose native or application validation fails
- **THEN** the form remains open, performs no successful persistence, and keeps an actionable invalid control available

#### Scenario: Cancel a draft form
- **WHEN** a user invokes form cancel on an explicit Save/Cancel form
- **THEN** the owner discards its unsubmitted draft through the same path as its visible Cancel or Close action

#### Scenario: Close an autosaving form
- **WHEN** a user invokes form submit or form cancel on an autosaving editor that cannot roll back accepted persistence
- **THEN** the owner flushes pending valid changes and closes without claiming to revert persisted work

### Requirement: Ordinary text-entry controls retain native editing
Outside DataGrids, text, number, currency, percentage, URL, email, password, and time-entry controls SHALL have one continuously editable state and SHALL preserve native selection, insertion, deletion, cursor, composition, autofill, password-manager, and virtual-keyboard behavior except for the explicit form Return policy.

#### Scenario: Edit ordinary text
- **WHEN** a user types, inserts Space, clicks an insertion point, selects text, deletes text, or moves with arrow keys in an ordinary text-entry control
- **THEN** the control performs the corresponding native editing behavior without a separate view/edit transition

#### Scenario: Insert a textarea newline
- **WHEN** a user presses Return in a textarea
- **THEN** the textarea inserts a newline and does not submit the containing form

#### Scenario: Leave ordinary text with Escape
- **WHEN** a user presses unmodified Escape in an ordinary text-entry control with no field-owned transient layer
- **THEN** the control performs no field action and Escape does not bubble into form cancellation

#### Scenario: Preserve specialized text validation
- **WHEN** a specialized text-entry type receives input
- **THEN** it retains its native accepted-character, parsing, masking, input-mode, and validation behavior

### Requirement: Text-input Return submission is opt-in
Unmodified Return in a single-line text-entry control SHALL NOT submit its owning form by default. A form MAY explicitly opt in to Return submission for its single-line text-entry descendants.

#### Scenario: Suppress default implicit submission
- **WHEN** a user presses Return in a single-line text-entry control whose owning form has not opted in and no field-level control owns Return
- **THEN** BathOS prevents implicit form submission and leaves the current text value and focus intact

#### Scenario: Submit an opted-in form
- **WHEN** a user presses Return in a single-line text-entry control whose owning form has opted in outside active composition
- **THEN** BathOS submits that form through the same validation-aware path as its visible submit action

#### Scenario: Submit every gateway form with Return
- **WHEN** a user presses Return in a single-line text-entry control within login, signup, password-recovery, password-reset, or another gateway authentication form
- **THEN** the gateway form submits through its ordinary visible action

#### Scenario: Preserve explicit compact-form exceptions
- **WHEN** a module's durable contract explicitly declares a compact text-entry form to submit on Return
- **THEN** that form opts in without changing the default for unrelated forms

### Requirement: Native activation semantics remain available
Buttons, button-like composite controls, and static links SHALL activate with Space or Return. Checkboxes, toggle switches, and multi-select options SHALL toggle with Space or Return. Static links SHALL preserve browser link semantics.

#### Scenario: Activate a button
- **WHEN** keyboard focus is on an enabled button and the user presses Space or Return
- **THEN** the button performs its declared action exactly once

#### Scenario: Toggle a binary control
- **WHEN** keyboard focus is on an enabled checkbox or toggle and the user presses Space or Return
- **THEN** the control toggles and retains focus

#### Scenario: Activate a link
- **WHEN** keyboard focus is on a static link and the user presses Space or Return
- **THEN** the link follows its real destination

#### Scenario: Preserve modified link navigation
- **WHEN** a user Command-clicks, Control-clicks, or middle-clicks a real link
- **THEN** BathOS preserves the browser's ordinary new-tab or new-context behavior

### Requirement: Composite fields stage, commit, and cancel predictably
Single selects, multi-selects, date pickers, file inputs, and color controls SHALL preserve native semantics or the shared composite-control contract while exposing distinct closed and open states where required.

#### Scenario: Open a select
- **WHEN** a focused closed single-select or multi-select trigger receives Space, Return, or pointer activation
- **THEN** the menu opens with focus on its current selection or first legal option, or in its type-to-find field when present

#### Scenario: Commit a single selection
- **WHEN** a user activates a focused single-select option with Space, Return, or pointer input
- **THEN** the menu commits that option, closes, and returns focus to the trigger

#### Scenario: Stage and commit multiple selections
- **WHEN** a user toggles multi-select options with Space or pointer input and then commits with Return or leaves with Tab
- **THEN** the menu commits the staged checked states, closes, and returns or advances focus as appropriate

#### Scenario: Cancel a composite field
- **WHEN** a user presses unmodified Escape inside an open select, multi-select, date picker, or color control
- **THEN** the deepest open field layer closes, restores its pre-open committed value, restores trigger focus, and does not cancel the owning form

#### Scenario: Preserve file-input behavior
- **WHEN** a user focuses, opens, chooses, clears, or cancels a file input
- **THEN** BathOS preserves the browser's native file-selection and security behavior while keeping the control in the form's Tab order

#### Scenario: Preserve custom color behavior
- **WHEN** a user focuses a custom color control
- **THEN** Space or Return opens it, arrows navigate its available colors, Space or Return commits a color, Escape cancels its open layer, and Tab commits and moves to the adjacent form control

### Requirement: Ordinary forms traverse only with Tab
Arbitrary non-DataGrid forms SHALL use Tab and Shift+Tab as their only shared inter-control traversal keys. Leaving a field by Tab SHALL commit its current accepted state before focus moves.

#### Scenario: Traverse an ordinary form
- **WHEN** a user presses Tab or Shift+Tab in an ordinary form
- **THEN** focus moves to the next or previous enabled visible control in DOM order without shared arrow-key traversal

#### Scenario: Contain modal traversal
- **WHEN** Tab or Shift+Tab reaches the final or first tabbable control inside a modal form
- **THEN** focus wraps within that modal and never moves into inert page content

#### Scenario: Skip unavailable controls
- **WHEN** form traversal encounters a disabled, hidden, or otherwise unavailable control
- **THEN** traversal skips it while read-only controls remain focusable when their value is useful to review or copy

#### Scenario: Leave an open select with Tab
- **WHEN** a user presses Tab or Shift+Tab inside an open single-select or multi-select
- **THEN** the field commits its current accepted or staged state, closes, and moves to the next or previous containing-form control

### Requirement: Date pickers are arrow-navigable and Tab-exiting
Shared date pickers SHALL use Space, Return, pointer input, and arrow navigation internally. Space, Return, and pointer activation SHALL be equivalent when they activate a final selection, including when the activated legal date is already the committed value, and internal controls SHALL NOT become a multi-stop segment of the containing form's Tab order.

#### Scenario: Open a date picker
- **WHEN** a focused date-picker trigger receives Space, Return, or pointer activation
- **THEN** the picker opens with focus on the selected legal date, otherwise today when legal, otherwise the first legal date

#### Scenario: Navigate a date picker
- **WHEN** a user presses arrow keys inside an open date picker outside a text-entry subcontrol
- **THEN** focus moves among enabled calendar, caption, paging, month, year, and picker-specific controls without changing the committed date merely because focus moved

#### Scenario: Confirm a final date-picker selection
- **WHEN** a user activates a focused legal date, Clear action, or other final-selection action with Space, Return, or pointer input
- **THEN** the picker commits that selection exactly once, closes after the owner accepts it, and restores focus to the trigger

#### Scenario: Confirm the already-selected date
- **WHEN** a user activates the already-selected legal date with Space, Return, or pointer input
- **THEN** the picker accepts that date as the user's final selection, preserves the committed value, closes, and restores focus to the trigger

#### Scenario: Keep date-picker navigation open
- **WHEN** a user activates a calendar pager, caption, month, year, or another navigation-only action with Space, Return, or pointer input
- **THEN** the picker performs the internal navigation action without committing a final value and remains open

#### Scenario: Leave a date picker with Tab
- **WHEN** a user presses Tab or Shift+Tab anywhere inside an open date picker
- **THEN** the picker closes without converting a merely focused date into a selection and focus moves to the next or previous control in the containing form

#### Scenario: Cancel a date picker
- **WHEN** a user presses unmodified Escape inside an open date picker
- **THEN** the picker closes with its pre-open committed value and returns focus to its trigger without canceling the owning form

#### Scenario: Clear an optional date
- **WHEN** a focused closed date field has an explicitly allowed null reset and the user presses Delete or Backspace
- **THEN** BathOS clears the date exactly once and retains focus

### Requirement: DataGrid text-entry cells separate focus and editing
Text, number, currency, percentage, URL, email, password, and time-entry cells inside DataGrids SHALL have a focused non-editing state and an editing state so spatial navigation remains available without sacrificing direct pointer editing.

#### Scenario: Focus a grid text cell by keyboard
- **WHEN** DataGrid traversal focuses a text-entry cell
- **THEN** the cell remains focused and non-editing with no active insertion caret

#### Scenario: Edit a grid text cell by pointer
- **WHEN** a user clicks or taps a focused or unfocused editable text-entry cell
- **THEN** the cell enters editing with the insertion point at the chosen position

#### Scenario: Enter editing with Return
- **WHEN** a focused non-editing text-entry cell receives Return
- **THEN** it enters editing with the insertion point at the end of its current contents

#### Scenario: Replace a grid value by typing
- **WHEN** a focused non-editing text-entry cell receives a printable character accepted by its type, including Space for text
- **THEN** the cell replaces its complete value with that character, enters editing, and places the insertion point after it

#### Scenario: Commit grid text editing
- **WHEN** an editing text-entry cell receives Return
- **THEN** it commits its valid value, exits editing, and retains keyboard focus

#### Scenario: Cancel grid text editing
- **WHEN** an editing text-entry cell receives unmodified Escape
- **THEN** it restores the value present when editing began, exits editing, and retains keyboard focus without canceling any containing form

#### Scenario: Keep editing arrows inside text
- **WHEN** an editing text-entry cell receives an unmodified arrow key, including at the beginning or end of its text
- **THEN** the key retains native cursor or selection behavior and never moves focus to another grid cell

#### Scenario: Commit grid text on pointer departure
- **WHEN** pointer interaction moves from an editing text-entry cell to another control
- **THEN** the source commits its valid value and the pointer destination receives its intended focus and editing state

### Requirement: DataGrid traversal is spatial and boundary-aware
Focused non-editing DataGrid controls SHALL use arrow keys for spatial movement and Tab or Shift+Tab for commit-and-traverse movement while preserving sticky visibility, disabled-control skipping, and browser exit at grid boundaries.

#### Scenario: Navigate a grid spatially
- **WHEN** a focused non-editing grid control receives an unmodified arrow key
- **THEN** focus moves to the nearest enabled control in that direction and scrolls only as needed to remain fully visible

#### Scenario: Tab within a grid row
- **WHEN** a user presses Tab or Shift+Tab before the horizontal edge of a DataGrid row
- **THEN** the current field commits and focus moves to the next or previous enabled control in that row

#### Scenario: Wrap Tab across grid rows
- **WHEN** forward Tab leaves a row's final enabled control or reverse Tab leaves a row's first enabled control and another row exists
- **THEN** focus moves to the first enabled control of the next row or the final enabled control of the previous row

#### Scenario: Exit a grid at its boundary
- **WHEN** forward Tab leaves the final enabled grid control or reverse Tab leaves the first enabled grid control
- **THEN** BathOS commits the current field and lets browser Tab traversal move to the next or previous control outside the grid

#### Scenario: Preserve pointer editing through async save
- **WHEN** an earlier cell's asynchronous commit resolves after pointer input has focused another editable cell
- **THEN** the destination keeps both focus and its pointer-entered editing state without scroll judder or value rollback

### Requirement: Reset commands require explicit legal targets
Delete and Backspace SHALL reset a focused non-editing control only when that control explicitly declares a legal reset target. BathOS SHALL NOT infer a reset by choosing a select's first option.

#### Scenario: Reset a nullable field
- **WHEN** a focused non-editing nullable text, number, date, select, or multi-select control receives Delete or Backspace
- **THEN** it commits its declared empty or null reset value and retains focus

#### Scenario: Reset a zeroable numeric field
- **WHEN** a focused non-editing required numeric field explicitly declares zero as legal and receives Delete or Backspace
- **THEN** it commits zero and retains focus

#### Scenario: Reset a binary field
- **WHEN** a focused checkbox or toggle receives Delete or Backspace
- **THEN** it resets to unchecked or off and retains focus

#### Scenario: Ignore an illegal reset
- **WHEN** a required control has no legal empty, zero, null, none, unchecked, off, or declared default target
- **THEN** Delete and Backspace perform no field mutation

### Requirement: Shared interactions remain accessible and robust
Shared form interactions SHALL retain visible focus, programmatic names and states, validation semantics, composition safety, pointer parity, focus restoration, and native behavior for controls not explicitly overridden.

#### Scenario: Announce control state
- **WHEN** assistive technology inspects a form control, composite popup, modal, or DataGrid cell
- **THEN** the control exposes a nonempty accessible name, its current state, and the appropriate expanded, selected, checked, invalid, disabled, read-only, dialog, grid, row, and cell semantics

#### Scenario: Restore focus after a field layer closes
- **WHEN** a select, multi-select, date picker, file chooser, color control, dialog, or editor closes
- **THEN** focus returns to its trigger or the next logical workflow target without moving to inert content

#### Scenario: Preserve unlisted native controls
- **WHEN** a control type has no explicit BathOS override
- **THEN** it retains native browser behavior and ordinary form traversal

#### Scenario: Avoid duplicate global work
- **WHEN** BathOS mounts, rerenders, navigates modules, or opens portal content
- **THEN** one shared form-command listener governs the document without duplicate command dispatch

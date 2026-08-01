## MODIFIED Requirements

### Requirement: Keyboard-First Daily Operation
The system SHALL provide a platform-aware keyboard contract for full-editor creation, editing, planning, direct view navigation, list traversal, lifecycle transitions, clipboard operations, history, and dialogs while preserving unrelated browser and operating-system shortcuts.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Toggle done with the Tasks-specific command
- **WHEN** a user invokes Control+X on Mac or Alt+Shift+X on Windows with an open task or nonempty task selection
- **THEN** Tasks toggles pending completion for the open task or applies the ordinary lifecycle transition to every eligible selected task and suppresses the matching browser action

#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task Summary and no editor, unrelated modal, or composition event owns keyboard input
- **THEN** Enter retains ordinary button activation, no dedicated modifier-plus-arrow chord reorders the task, and no unmodified letter or arrow key triggers a Tasks command

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, cancellation, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then the primary view heading when no task remains

#### Scenario: Open task creation
- **WHEN** a keyboard user presses Control+A on Mac or Alt+Shift+A on Windows
- **THEN** the module opens a blank task in the complete editor and suppresses the matching delivered browser command
#### Scenario: Create through the complete editor
- **WHEN** Control+A on Mac or Alt+Shift+A on Windows is invoked from Today, Upcoming, Anytime, or Someday
- **THEN** Tasks injects one blank local task draft at the top of that view, opens the ordinary complete editor, and focuses its blank title
#### Scenario: Persist a valid draft
- **WHEN** a blank draft first obtains a nonblank title
- **THEN** Tasks creates exactly one ordinary task using the complete latest draft metadata, keeps the open row at the top until close, and routes subsequent edits through ordinary ordered autosave

#### Scenario: Preserve metadata entered before a title
- **WHEN** a user edits planning, organization, notes, Primary Link, actionability, deadline, or reminder intent before giving the draft a title
- **THEN** Tasks retains those values locally and includes them when the first nonblank title creates the task

#### Scenario: Discard an untitled draft
- **WHEN** the user closes a draft whose title never became nonblank
- **THEN** Tasks removes the local draft without creating synchronized work, history, sources, reminders, or a success toast

#### Scenario: Default a Today draft
- **WHEN** a user creates a task from Today
- **THEN** the draft begins as undated Anytime work with Today Now horizon and responds to ordinary planning keyboard commands

#### Scenario: Reconcile a new task after close
- **WHEN** a persisted draft editor closes
- **THEN** Tasks removes the temporary top projection and derives the task's membership, grouping, and order through the active view's ordinary sorting rules

#### Scenario: Explain a saved task leaving the view
- **WHEN** the final accepted metadata places a newly persisted task outside the view where it was created
- **THEN** Tasks shows one neutral toast stating that the task was saved but is not visible in the current list

#### Scenario: Search without unstructured labels
- **WHEN** a user searches present work through Quick Find or the complete results route
- **THEN** the module matches task text and structured source or hierarchy context without introducing generic tags or an advanced filter surface

#### Scenario: Open a task across views from search
- **WHEN** a user activates a task search result
- **THEN** the module navigates through a real in-app link to the task's current planning or history view and opens or focuses the stable task record

#### Scenario: Restore focus after a movement command
- **WHEN** a structural or temporal movement command succeeds and its command surface closes
- **THEN** focus returns to the moved task when it remains in the current view, or follows the same-position, prior-task, and primary-heading fallback when the move removes it

#### Scenario: Autosave free-text editing
- **WHEN** a user changes a task Summary or Notes in an open editor
- **THEN** the local value changes immediately and the module persists the latest nonblank Summary or exact Notes source after a short debounce without a Save or Cancel action

#### Scenario: Autosave structured editing
- **WHEN** a user changes actionability, organization, Start, day horizon, Deadline, Primary Link, reminder time, or reminder ambiguity in an open task
- **THEN** the module persists the changed field immediately without waiting for another field or an explicit submission

#### Scenario: Preserve autosave order
- **WHEN** a user makes multiple edits while one or more earlier autosave writes remain in flight
- **THEN** the module submits and resolves the writes in interaction order so an earlier request cannot replace a later accepted value

#### Scenario: Flush autosave on close
- **WHEN** a user closes an editor, opens another task, or leaves the current task view while a free-text debounce is pending
- **THEN** the module submits the latest valid draft and waits for that ordered write before committing any deferred completion for the closing task

#### Scenario: Keep autosave visually quiet
- **WHEN** an autosave write is pending or succeeds
- **THEN** the editor remains interactive and shows no routine saving or saved indicator

#### Scenario: Preserve autosave history
- **WHEN** an autosave batch is accepted
- **THEN** it is recorded as an ordinary task mutation that can be traversed by app-level undo and redo across tasks

#### Scenario: Recover from autosave failure
- **WHEN** an autosave write fails while the editor remains open
- **THEN** the module reports the failure through its existing error notice, keeps the local draft available, and permits a later edit to retry persistence

#### Scenario: Override only documented commands
- **WHEN** the user invokes a documented Tasks command in a supported context while the Tasks route is mounted
- **THEN** a capture-phase handler prevents the default browser action, stops later keyboard handling, and dispatches exactly one Tasks command outside active composition

#### Scenario: Translate the Tasks-specific modifier by platform
- **WHEN** a Tasks-specific action uses Control plus a letter on Mac
- **THEN** the corresponding Windows command uses Alt+Shift plus that letter, while standard Windows Control commands retain their native or documented application meanings

#### Scenario: Own app undo and redo
- **WHEN** the user presses Command+Z, Control+Z, Command+Y, or Command+Shift+Z on Mac, or Control+Z, Alt+Shift+Z, Control+Y, or Control+Shift+Z on Windows
- **THEN** Tasks suppresses browser and text-editor history throughout the Tasks route and invokes the available app-level undo or redo action, otherwise leaving state unchanged and reporting the neutral history boundary
#### Scenario: Navigate primary task views
- **WHEN** the user presses Command+1, Command+2, Command+3, Command+4, Command+5, or Command+6 on Mac, or the corresponding Control chord on Windows
- **THEN** Tasks navigates to Today, Upcoming, Anytime, Someday, Done, or Config respectively and suppresses the matching page-level action
#### Scenario: Apply a task command to one or many tasks
- **WHEN** a planning, completion, duplication, or organization command is invoked with a nonempty multi-selection or an open task
- **THEN** Tasks targets the multi-selection when present and otherwise the open task, applies the command to every eligible target, and reports ineligible terminal targets without mutating them
#### Scenario: Open Start from the keyboard
- **WHEN** Control+E on Mac or Alt+Shift+E on Windows targets an open task or nonempty eligible selection
- **THEN** Tasks opens or applies the Start planning surface without changing Deadline, actionability, or organization
#### Scenario: Clear Start directly
- **WHEN** Control+R on Mac or Alt+Shift+R on Windows targets an open task or nonempty eligible selection
- **THEN** Tasks moves each target to unplanned Anytime, clears Start and day horizon, cancels Start-dependent reminders, and preserves Deadline, actionability, and organization
#### Scenario: Set Start to Someday directly
- **WHEN** Control+G on Mac or Alt+Shift+G on Windows targets an open task or nonempty eligible selection
- **THEN** Tasks moves each target to Someday, clears calendar Start and day horizon, cancels Start-dependent reminders, and preserves Deadline, actionability, and organization
#### Scenario: Cycle day horizon
- **WHEN** Control+T on Mac or Alt+Shift+T on Windows targets one or more eligible tasks
- **THEN** each task moves to Today when needed and cycles through the supported Today horizon sequence without changing Deadline or organization
#### Scenario: Open reminder planning
- **WHEN** Control+Y on Mac or Alt+Shift+Y on Windows targets one eligible task
- **THEN** Tasks opens Start with Reminder editable, and a valid reminder on unplanned work first assigns Today Inbox before reminder persistence
#### Scenario: Open the next visible task
- **WHEN** the user presses Control+S on Mac or Alt+Shift+S on Windows
- **THEN** Tasks opens the first visible task when none is open, otherwise closes the current editor and opens the next visible task, closing without wrapping when the current task is last
#### Scenario: Open the previous visible task
- **WHEN** the user presses Control+W on Mac or Alt+Shift+W on Windows
- **THEN** Tasks opens the last visible task when none is open, otherwise closes the current editor and opens the previous visible task, closing without wrapping when the current task is first
#### Scenario: Focus and reveal a newly opened task
- **WHEN** a pointer, search result, creation command, or keyboard traversal command opens a task
- **THEN** focus lands in the Summary input with its insertion point at the end and Tasks shifts the page so the task summary row reaches the top of the visible content area below sticky chrome, or as close to that boundary as the available document scroll range permits

#### Scenario: Animate inline editor disclosure
- **WHEN** a user opens or closes a task and reduced motion is not requested
- **THEN** Tasks commits the opening row in a collapsed frame, quickly animates expansion or collapse, and only after the expanded drawer reaches its final layout height smoothly performs the best-effort summary-row top alignment without scrolling to the bottom of a long editor
#### Scenario: Close an editor from outside
- **WHEN** a pointer interaction begins outside the open task and any calendar, menu, listbox, or dialog launched from its editor
- **THEN** Tasks flushes pending autosave, closes the editor, and commits any deferred completion through the ordinary close path

#### Scenario: Close an editor with a form command
- **WHEN** a task editor is open and the user presses Command+Return, Command+Escape, or Control+Q on Mac, or Control+Return or Alt+Shift+Q on Windows, outside active composition
- **THEN** Tasks suppresses the matching delivered browser action, flushes autosave, closes the editor from any focused task field, and commits deferred completion through the ordinary close path
#### Scenario: Keep plain Escape field-local
- **WHEN** a task editor is open and the user presses unmodified Escape
- **THEN** the deepest open task field layer may cancel or revert itself, but the task editor remains open when no field layer owns Escape

### Requirement: Immediate Horizon Command Presentation
Tasks SHALL make accepted metadata changes visible immediately in an open task while deferring list membership, filtering, grouping, and automatic-sort reconciliation until that task's editor closes.

#### Scenario: Cycle an existing Today horizon
- **WHEN** Control+T on Mac or Alt+Shift+T on Windows targets work already in Today
- **THEN** Tasks cycles Now to Next, Next to Later, Later to Now, and Inbox to Now while keeping the work in Today

### Requirement: Unified Task Start Picker
The Tasks interface SHALL present a single autosaving Start control for Today horizon, future deferral date, and reminder intent by composing the established BathOS popover and calendar primitives with Tasks-specific controls. Activating a final Start selection by pointer, Space, or Return SHALL persist that selection and close the picker.

#### Scenario: Open the complete Start picker
- **WHEN** a user activates Start from an open to-do or its action menu
- **THEN** one BathOS popover presents Inbox, Now, Next, and Later Today horizons, a calendar, inline reminder time, and Clear without separate Start Date, Day Horizon, or Reminder Time editor fields

#### Scenario: Focus the current Start intent
- **WHEN** Start opens for a task with a future Start Date
- **THEN** the selected date is visibly highlighted, receives keyboard focus, and remains visible in its calendar month

#### Scenario: Focus an unplanned Start picker
- **WHEN** Start opens for a task with neither a future Start Date nor a Today horizon
- **THEN** keyboard focus lands on Today Inbox

#### Scenario: Choose a Today horizon
- **WHEN** a user activates Inbox, Now, Next, or Later with pointer input, Space, or Return
- **THEN** Tasks stores that active Today horizon with a null future Start Date exactly once, closes Start after autosave succeeds, and restores focus to the trigger

#### Scenario: Choose a future Start date
- **WHEN** a user activates a legal date after the owner's planning date with pointer input, Space, or Return
- **THEN** Tasks stores that future Start Date with a null Today horizon exactly once, closes Start after autosave succeeds, and restores focus to the trigger

#### Scenario: Prevent calendar scheduling for today or the past
- **WHEN** the Start picker calendar displays the owner planning date or an earlier date
- **THEN** those date buttons are disabled because Today placement is selected through an explicit day horizon

#### Scenario: Bound Start calendar navigation
- **WHEN** the user pages the Start calendar or opens its month picker
- **THEN** months with no selectable date after the owner planning date are unavailable through month navigation, year navigation, pointer selection, and keyboard selection

#### Scenario: Escape a disabled date boundary
- **WHEN** a focused selectable date has one or more disabled dates above it and the user presses ArrowUp
- **THEN** focus skips the disabled dates, reaches an enabled date when one exists above, or reaches the appropriate calendar header control when none exists

#### Scenario: Hide unavailable backward navigation
- **WHEN** no earlier calendar month or month-picker year contains an allowed Start date
- **THEN** the corresponding backward navigation symbol is not visible and the month or year caption remains horizontally centered

#### Scenario: Preserve calendar cursor meaning
- **WHEN** a pointer rests or moves over a calendar date, month, caption, or paging action
- **THEN** every enabled action consistently uses a pointer cursor and every disabled action consistently uses a not-allowed cursor without settling to the default cursor

#### Scenario: Open on the earliest usable month
- **WHEN** a task has no future Start Date and the owner planning date is the final day of its month
- **THEN** the Start calendar opens on the following month because the current month contains no selectable Start date

#### Scenario: Center the month picker
- **WHEN** the user opens the shared month-selection view from Start
- **THEN** the year heading, navigation, and month grid are horizontally centered within the same viewport as the day calendar

#### Scenario: Add or clear a reminder inside Start
- **WHEN** connected reminder storage is available and a user enters or clears a reminder time for a present open to-do
- **THEN** Tasks immediately saves or cancels the one dependent reminder through the authoritative reminder contract, first assigning Today · Inbox when the to-do has no Start intent and never requesting an independent reminder date

#### Scenario: Clear Start
- **WHEN** the user activates Clear with pointer input, Space, or Return
- **THEN** Tasks immediately clears both future Start Date and Today horizon, cancels any active reminder and pending occurrence, closes Start after autosave succeeds, and commits the action exactly once

#### Scenario: Leave Start with Tab
- **WHEN** focus is anywhere inside Start and the user presses Tab or Shift+Tab
- **THEN** Tasks closes Start without selecting a merely focused date, restores the committed task state, and moves focus to the next or previous control in the containing task editor rather than traversing Start's internal controls

#### Scenario: Traverse the complete picker with arrow keys
- **WHEN** focus is within Start and the user presses an arrow key outside ordinary reminder text editing
- **THEN** downward focus moves in visible order from Today horizons to the calendar header, then to enabled dates or months, Reminder, and Clear while reverse navigation follows the same structure and skips disabled destinations

#### Scenario: Keep Start open for internal calendar navigation
- **WHEN** keyboard focus is on a calendar pager, month or year caption, or selectable month and the user activates it with Space or Return
- **THEN** Tasks performs the calendar page or view action and keeps Start open with focus inside the picker

#### Scenario: Preserve Reminder text entry
- **WHEN** keyboard focus is in Reminder and the user enters Space or other text
- **THEN** Tasks treats it as reminder input rather than a Start-selection command

#### Scenario: Cancel Start without closing the task
- **WHEN** a user presses unmodified Escape inside Start
- **THEN** Tasks closes Start, restores its trigger focus and pre-open provisional field state, and leaves the containing task editor open

#### Scenario: Open Start from the reminder command
- **WHEN** Control+Y on Mac or Alt+Shift+Y on Windows targets one open to-do outside selection mode
- **THEN** Tasks opens Start with Reminder prefocused and suppresses the matching browser command

#### Scenario: Ignore the reminder command in selection mode
- **WHEN** selection mode is active and the user presses Control+Y on Mac or Alt+Shift+Y on Windows with zero, one, or many selected to-dos
- **THEN** Tasks suppresses the matching browser command without opening a reminder surface, changing selection membership, or mutating any task or reminder

#### Scenario: Keep Reminder available before planning
- **WHEN** a task has neither a Today horizon nor a future Start Date
- **THEN** the reminder time control remains visible and editable whenever connected reminder storage is available

### Requirement: Explicit Task Selection Entry
Tasks SHALL expose a point-and-click entry into task selection mode on every selection-capable task list, SHALL permit that explicit entry and edit-driven reconciliation to retain zero selected tasks, and SHALL keep every selection-dependent action unavailable until its minimum selection requirement is met.

#### Scenario: Enter empty selection mode from a list
- **WHEN** a user activates Select Tasks from Today, Upcoming, Anytime, Someday, or Done while selection mode is inactive
- **THEN** Tasks closes any open task editor, clears lightweight task focus and the range anchor, enters selection mode with zero selected tasks, shows circular selection controls, and presents the fixed toolbar reporting `0 Tasks`

#### Scenario: Enter selection mode with the current task command
- **WHEN** selection mode is inactive on a selection-capable list and Control+B on Mac or Alt+Shift+B on Windows targets the currently open or keyboard-focused task
- **THEN** Tasks flushes and closes any open editor, clears lightweight and DOM focus, enters selection mode with exactly that task selected, establishes it as the range anchor, and presents the fixed selection toolbar

#### Scenario: Ignore targeted selection entry without an eligible task
- **WHEN** the targeted selection command is invoked without an open or keyboard-focused selectable task, with an untitled creation draft, outside a selection-capable list, or while selection mode is already active
- **THEN** Tasks suppresses the matching browser command without changing selection membership or task state

#### Scenario: Omit selection entry from non-list surfaces
- **WHEN** a user views Config, Templates, Search, or an Area-detail surface
- **THEN** Tasks does not present the Select Tasks action

#### Scenario: Keep zero-selection actions safe
- **WHEN** selection mode is active with zero selected tasks
- **THEN** Edit is disabled, selection-dependent surfaces cannot open, Cancel remains available to exit selection mode, and Select All is enabled only when at least one selectable task is visible

#### Scenario: Select one task after empty entry
- **WHEN** the user activates one task's summary or circular selection control after entering empty selection mode
- **THEN** Tasks selects that task, establishes the selection anchor, keeps selection mode active, and enables actions that require at least one eligible selected task

#### Scenario: Exit after manually returning to zero
- **WHEN** the user manually deselects the final selected task after the selection has contained one or more tasks
- **THEN** Tasks automatically exits selection mode and removes the fixed selection toolbar

#### Scenario: Preserve zero after edit-driven reconciliation
- **WHEN** selection membership reaches zero because a successful edit moved every selected task out of the current view
- **THEN** Tasks retains selection mode and the fixed toolbar until the user activates Cancel, Select All, or another explicit selection exit

#### Scenario: Select all from an empty one-task list
- **WHEN** selection mode is active with zero selected tasks, exactly one selectable task is visible, and the user activates Select All
- **THEN** Tasks selects that task within selection mode rather than converting it to lightweight whole-task focus

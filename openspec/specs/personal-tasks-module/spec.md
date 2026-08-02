# Personal Tasks Module Specification

## Purpose

Define the private, tagless BathOS Tasks domain, its production synchronization and reminder boundaries, and the interaction, recovery, automation, and parallel-use contracts required for dependable personal task management.
## Requirements
### Requirement: Private-First Task Module
The system SHALL provide a single-owner task module whose records are accessible only to the signed-in BathOS user unless a later specification explicitly adds sharing.

#### Scenario: Access owned task data
- **WHEN** an authenticated user opens the task module
- **THEN** the system returns only task data owned by that user

#### Scenario: Reject another user's task data
- **WHEN** a client attempts to read or mutate task data owned by another user
- **THEN** the system rejects the operation through the task module's RLS and service boundaries

#### Scenario: Synchronize owned task data
- **WHEN** a client subscribes to task synchronization
- **THEN** the synchronization service downloads only rows whose owner matches the authenticated user and mirrors the ownership boundary enforced by RLS

#### Scenario: Change accounts on one installation
- **WHEN** one owner signs out and another owner signs in on the same client installation
- **THEN** the client clears or rebinds its local task projection before rendering the new owner's task data and never exposes the prior owner's cached rows

### Requirement: Production Task Synchronization
The system SHALL deploy remote task synchronization only through an explicitly approved topology whose download boundary mirrors task RLS and whose secrets remain outside the public client repository.

#### Scenario: Backfill a newly synchronized field into existing clients
- **WHEN** a deployed schema adds and populates a field on rows that existing PowerSync clients already cached
- **THEN** the rollout re-emits those rows after the matching client schema is available, preserves every stored business value, and allows existing clients to hydrate the field without clearing local data

### Requirement: Exclusive Start And Today Horizon
The system SHALL store Start and a Today horizon as mutually exclusive planning states for every tasks, and SHALL require Start to be future-only for active present work while preserving supported terminal history.

#### Scenario: Keep undated work outside Today
- **WHEN** an open present Anytime item has no Start and no Today horizon
- **THEN** the system includes it in Anytime while withholding it from Today

#### Scenario: Keep active undated work in Today
- **WHEN** an open present Anytime item has no Start and an Inbox, Now, Next, or Later horizon
- **THEN** the system includes it in Anytime and the selected Today section

#### Scenario: Preserve horizon through structured generation and portability
- **WHEN** templates, recurrence, MCP, export, merge, replacement restore, or synchronization carry an Anytime item's planning state
- **THEN** the system clears the horizon for a future Start, permits a horizon only for active Today work, and activates reached task dates into Today Inbox

#### Scenario: Preserve terminal Start history
- **WHEN** retained completed, canceled, or deleted work contains the historical Start that applied while it was active
- **THEN** the system preserves that historical date, clears any obsolete Today horizon, and applies future-only Start validation when the work returns to an active present state

### Requirement: Immediate Horizon Command Presentation
Tasks SHALL make accepted metadata changes visible immediately in an open task while deferring list membership, filtering, grouping, and automatic-sort reconciliation until that task's editor closes.

#### Scenario: Cycle an existing Today horizon
- **WHEN** Control+T on Mac or Alt+Shift+T on Windows targets work already in Today
- **THEN** Tasks cycles Now to Next, Next to Later, Later to Now, and Inbox to Now while keeping the work in Today

#### Scenario: Cycle work not currently in Today
- **WHEN** the horizon command targets unplanned, Someday, or future-start work
- **THEN** Tasks moves the work to Today Now by clearing future Start or Someday placement and assigning the Now horizon

#### Scenario: Reflect an open-task command
- **WHEN** a documented keyboard shortcut changes metadata on an open task
- **THEN** its summary and editor controls show the accepted value without waiting for synchronization or closing the editor

#### Scenario: Reflect an open-task pointer edit
- **WHEN** a user changes metadata through a control inside an open task drawer
- **THEN** its summary and editor controls show the accepted value without waiting for synchronization or closing the editor

#### Scenario: Retain an open task's presentation slot
- **WHEN** an open task receives a planning, actionability, organization, Start, Deadline, or other metadata edit that would change current view membership, quick-filter membership, visible grouping, or automatic-sort position
- **THEN** Tasks shows the accepted metadata immediately while retaining the task's original current-list group and exact visible slot for the entire editing session

#### Scenario: Apply deferred placement after close
- **WHEN** the user closes an edited task whose accepted metadata changes current view membership, quick-filter membership, visible grouping, or automatic-sort position
- **THEN** Tasks completes the drawer-close lifecycle, briefly retains the closed task in its original slot, applies the current projection once, removes or repositions the task as required, and animates an on-page position change with calm motion when motion is allowed

#### Scenario: Open another task after editing
- **WHEN** the user opens another task while the current open task has accepted projection-changing metadata
- **THEN** Tasks completes the current task's ordinary close lifecycle before releasing its retained projection and opening the requested task

#### Scenario: Settle a completed task before removal
- **WHEN** the user completes a task by keyboard command or pointer
- **THEN** Tasks immediately shows the completion intent, briefly retains the task in place, and only then animates and removes it from the active list

#### Scenario: Respect reduced motion while settling
- **WHEN** the user requests reduced motion
- **THEN** Tasks omits decorative movement and collapse delays while preserving the accepted task mutation and close-before-reconciliation ordering

#### Scenario: Retain lifecycle undo intent during projection lag
- **WHEN** the user invokes undo immediately after completing a task and the local task mutation is accepted before its matching history event is projected
- **THEN** Tasks retains the undo intent for that exact client mutation, withholds older history, and performs the guarded inverse as soon as the matching task and history projections agree

#### Scenario: Keep buffered history movement bounded
- **WHEN** the exact requested mutation does not become safely undoable within the bounded projection-wait interval
- **THEN** Tasks performs no inverse, does not apply the request to a later unrelated mutation, and preserves the authoritative history cursor

#### Scenario: Preserve Anytime manual order
- **WHEN** planning or other metadata changes for a task that remains in the Anytime destination
- **THEN** Tasks preserves its manual order key before, during, and after editing rather than ranking it by Start, Today horizon, Someday intent, actionability, or other metadata

### Requirement: Uniform Bulk Horizon Cycle
Tasks SHALL assign one shared Today horizon target to every task affected by one multi-target horizon command.

#### Scenario: Normalize mixed horizons
- **WHEN** the horizon command targets tasks whose effective horizon states differ
- **THEN** Tasks assigns every target to Today Now

#### Scenario: Advance a uniform horizon
- **WHEN** every target is already in Today Now, Today Next, or Today Later
- **THEN** Tasks advances every target together from Now to Next, Next to Later, or Later to Now

#### Scenario: Normalize non-cycle planning
- **WHEN** the horizon command targets only Inbox, unplanned, Someday, or future-start tasks
- **THEN** Tasks clears incompatible planning and assigns every target to Today Now

### Requirement: Someday Start Selection
The Tasks unified Start picker SHALL expose Someday as an explicit planning choice alongside clearing Start.

#### Scenario: Show Someday planning
- **WHEN** a task is planned for Someday
- **THEN** its closed Start control displays `Someday`

#### Scenario: Move a task to Someday from Start
- **WHEN** a user selects Someday in the unified Start picker
- **THEN** Tasks clears future Start and Today horizon, stores the Someday destination, cancels any Start-bound reminder, closes the picker, and excludes the task from Today, Upcoming, and Anytime

#### Scenario: Present terminal Start choices together
- **WHEN** the unified Start picker is open
- **THEN** Clear and Someday appear as equal sibling actions on one footer row with centered labels and a subtle divider between them
- **AND** both actions remain reachable by pointer and keyboard

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, Areas, tasks, and checklist items without headings, a separate Inbox destination, generic tags, multiple membership, or required parent containers.

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one task and its completion state remains independent from the parent task's lifecycle

#### Scenario: Edit a checklist directly
- **WHEN** a user opens a task with or without an existing checklist
- **THEN** the expanded drawer permits adding, viewing, editing, checking, unchecking, deleting, focusing, and keyboard-traversing plain-text checklist items without an explicit Save action

#### Scenario: Present an empty checklist item
- **WHEN** a checklist item has no text
- **THEN** its input shows the placeholder `Item`, exposes the complete row and input surface for direct reordering, and remains removable when the task closes

#### Scenario: Split a checklist item with Return
- **WHEN** a user presses unmodified Return in a checklist-item input outside active composition
- **THEN** Tasks saves the text before the caret or selection, inserts and focuses one checklist-item input immediately below containing the text after the caret or selection, removes selected text as the line-break replacement, places the caret at the beginning of the new item, and keeps the task editor open

#### Scenario: Traverse checklist items with vertical arrows
- **WHEN** a user presses Down Arrow or Up Arrow in a checklist-item input that has an adjacent item in that direction
- **THEN** Tasks focuses the adjacent checklist input and places its caret at the end of that item's value regardless of the original caret position

#### Scenario: Preserve vertical-arrow boundary behavior
- **WHEN** a user presses Up Arrow in the first checklist item or Down Arrow in the final checklist item
- **THEN** Tasks does not move focus outside the checklist and leaves the input's native boundary behavior intact

#### Scenario: Join a checklist item backward
- **WHEN** the caret is at the beginning of a checklist-item input and the user presses Backspace
- **THEN** Tasks appends the current item's text to the preceding item, removes the current item, and places the caret at the former boundary in the preceding input

#### Scenario: Remove the first empty checklist item
- **WHEN** the first checklist-item input is empty and the user presses Backspace
- **THEN** Tasks removes that item because no preceding checklist line exists to receive it

#### Scenario: Join a checklist item forward
- **WHEN** the caret is at the end of a checklist-item input and the user presses forward Delete
- **THEN** Tasks appends the following item's text to the current item, removes the following item, and leaves the caret at the former boundary in the current input

#### Scenario: Keep selection local to one checklist input
- **WHEN** a user presses Command+A or Control+A while editing a checklist item
- **THEN** the browser selects only the text in that active input

#### Scenario: Insert a checklist item with the control shortcut
- **WHEN** a focused or open task receives the checklist keyboard command
- **THEN** Tasks opens the task if necessary, creates one empty checklist row immediately before the first completed checklist item, and focuses that new row
- **AND** when no completed checklist item exists, Tasks appends and focuses the new empty row at the end of the checklist

#### Scenario: Remove empty checklist rows on close
- **WHEN** a task drawer closes with one or more empty checklist items
- **THEN** Tasks removes every empty checklist item regardless of completion state

#### Scenario: Present checklist insertion and deletion without motion
- **WHEN** a checklist item is created or removed
- **THEN** Tasks updates the checklist without sliding, translating, or otherwise animating the affected rows

#### Scenario: Move a completed checklist item
- **WHEN** a user checks an incomplete checklist item
- **THEN** Tasks smoothly moves that item beneath every incomplete item and after the already-completed items

#### Scenario: Preserve a manually reopened checklist position
- **WHEN** a user manually unchecks a completed checklist item
- **THEN** Tasks leaves the item at its current order position

#### Scenario: Undo a checklist change
- **WHEN** a user undoes or redoes a checklist edit, completion, deletion, creation, or reorder
- **THEN** Tasks restores or reapplies the exact prior checklist content, state, and order as one guarded history action

#### Scenario: Edit or reorder from the checklist input
- **WHEN** a user presses and releases a checklist-item input without beginning a drag
- **THEN** Tasks focuses the input and permits ordinary text editing at the clicked caret position

#### Scenario: Reorder checklist items directly
- **WHEN** a user drags a persisted or empty checklist item from its row or text-input surface and drops it at another checklist position
- **THEN** Tasks updates its visible order, persists that order for nonempty items across sessions and devices, and does not require or display a dedicated reorder handle

#### Scenario: Avoid redundant checklist append controls
- **WHEN** a checklist already contains an item or an empty editing row
- **THEN** Tasks does not show a separate Add Checklist Item button because Return provides the append interaction

### Requirement: Checklist Multi-Selection
Tasks SHALL let users temporarily select persisted checklist items within one open task for grouped reordering and deletion without presenting task-style bulk controls, retaining text-entry focus, or applying group completion changes. Every persisted checklist row SHALL distinguish an ordinary click from a native drag so the same row surface can begin item editing, reorder one item, or reorder the selected group without requiring a dedicated handle. While checklist multi-selection is active, every persisted checklist item SHALL replace its completion control with the canonical circular selection control without changing the item's persisted completion state or completed-text treatment.

#### Scenario: Begin additive selection from a focused item
- **WHEN** keyboard focus is inside one checklist-item input and the user Command-clicks another checklist item
- **THEN** Tasks selects and visibly highlights both the focused item and the modified-clicked item, relinquishes text-entry focus, and removes the visible text caret

#### Scenario: Extend additive selection
- **WHEN** one or more checklist items are selected and the user Command-clicks another persisted checklist item
- **THEN** Tasks toggles that item in the selection while retaining the other selected items and keeping text-entry focus absent

#### Scenario: Select an anchored range
- **WHEN** a checklist item is focused or is the current selection anchor and the user Shift-clicks another persisted checklist item
- **THEN** Tasks selects and visibly highlights the contiguous visual range between the anchor and the clicked item, relinquishes text-entry focus, and removes the visible text caret

#### Scenario: Keep text and completion actions item-local
- **WHEN** checklist items are selected
- **THEN** Tasks presents no bulk-action bar, has no active text-entry target, and does not apply an edit, completion, or reopening action to the group

#### Scenario: Present checklist selection controls
- **WHEN** checklist multi-selection is active
- **THEN** every persisted item shows a blue Lucide `CircleCheck` when selected or a blue Lucide `Circle` when unselected in place of its ordinary completion checkbox

#### Scenario: Toggle selection from a checklist selection control
- **WHEN** checklist multi-selection is active and the user clicks one checklist item's circular selection control
- **THEN** Tasks toggles only that item's transient selection state, preserves selection mode while any item remains selected, and does not change the item's completion state

#### Scenario: Preserve completed-item treatment during selection
- **WHEN** a completed checklist item is selected or unselected while checklist multi-selection remains active
- **THEN** its text remains struck through and muted so its completion state stays visible independently of selection

#### Scenario: Return to editing with an ordinary input click
- **WHEN** checklist items are selected and the user single-clicks a selected checklist-item input without moving far enough to begin a native drag
- **THEN** Tasks clears checklist multi-selection, focuses that input, preserves the clicked caret position, and permits ordinary text editing

#### Scenario: Return to editing from selected row space
- **WHEN** checklist items are selected and the user single-clicks the non-checkbox surface of a selected checklist row without moving far enough to begin a native drag
- **THEN** Tasks clears checklist multi-selection and focuses that row's checklist input for editing

#### Scenario: Deselect from elsewhere in the drawer
- **WHEN** checklist items are selected and the user single-clicks elsewhere in the task drawer
- **THEN** Tasks clears checklist multi-selection while allowing the clicked control's ordinary action to continue

#### Scenario: Cancel checklist selection with Escape
- **WHEN** one or more checklist items are selected through Command-click or Shift-click and the user presses unmodified Escape outside active text composition
- **THEN** Tasks clears checklist selection, consumes the Escape action, keeps the task editor open, leaves keyboard focus absent, and changes no checklist content, completion, or order

#### Scenario: Reorder a selected checklist group by its row
- **WHEN** the user presses and drags any selected persisted checklist row or its text input far enough to begin a native drag and drops it at another checklist position
- **THEN** Tasks moves every selected item as one visual-order group, persists the resulting order for nonempty items, and keeps the moved items selected

#### Scenario: Do not convert an input-originated row drag into editing
- **WHEN** a selected checklist row begins a native drag from its checklist text input
- **THEN** Tasks preserves checklist selection, relinquishes input focus, removes the visible text caret, and does not restore input focus through the ordinary click path

#### Scenario: Preserve ordinary single-item drag
- **WHEN** the user drags an unselected checklist item from its row or text-input surface
- **THEN** Tasks reorders only that item without adding selection styling or entering checklist multi-selection

#### Scenario: Delete a selected checklist group
- **WHEN** checklist items are selected and the user presses Delete or Backspace outside active text composition
- **THEN** Tasks removes every selected checklist item, clears checklist multi-selection, and prevents ordinary character or line-join deletion behavior

#### Scenario: Reconcile selection with checklist changes
- **WHEN** selected checklist items disappear because of deletion, task closure, or a synchronized update
- **THEN** Tasks removes unavailable item identifiers from the transient selection and clears the anchor when it no longer exists

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a task without an explicit planning placement
- **THEN** the system creates one open present Anytime task with no Start and the Today Next horizon

### Requirement: Checklist Drag Finalization
Tasks SHALL retain the most recent valid checklist insertion position throughout a native checklist drag and SHALL use that position when the user drops the dragged item or selected group elsewhere inside the BathOS document.

#### Scenario: Drop a single checklist item outside the checklist
- **WHEN** a user drags one checklist item across a valid checklist insertion position and releases it elsewhere inside BathOS
- **THEN** Tasks moves the item to the last valid indicated checklist position

#### Scenario: Drop a selected checklist group outside the checklist
- **WHEN** a user drags multiple selected checklist items across a valid checklist insertion position and releases them elsewhere inside BathOS
- **THEN** Tasks moves the complete selected group to the last valid indicated checklist position as one reorder and keeps the items selected

#### Scenario: Drop an empty checklist draft outside the checklist
- **WHEN** a user drags an empty checklist draft across a valid checklist insertion position and releases it elsewhere inside BathOS
- **THEN** Tasks moves the draft editing row to the last valid indicated checklist position without persisting an empty item

#### Scenario: Preserve local drop ownership
- **WHEN** a user releases a checklist drag over a checklist-owned drop target
- **THEN** Tasks applies the reorder exactly once through the checklist-owned drop interaction

#### Scenario: Ignore an outside drop without a valid position
- **WHEN** a checklist drag has not crossed a valid insertion position and the user releases it outside the checklist
- **THEN** Tasks leaves the checklist order unchanged

#### Scenario: Cancel a drag outside the browser
- **WHEN** a native checklist drag ends without a drop inside the BathOS document
- **THEN** Tasks leaves the checklist order unchanged and clears the transient drag state

### Requirement: Nested Checklist Drag Ownership
Tasks SHALL treat a checklist-item drag as owned exclusively by the checklist within the open task and SHALL NOT expose task-list placement feedback for that nested drag.

#### Scenario: Drag a checklist item across task rows
- **WHEN** a user drags a checklist item or selected checklist-item group over other task rows
- **THEN** Tasks preserves the last valid checklist insertion position without showing a task-list placement bar or registering a task reorder

#### Scenario: Preserve native checklist drop finalization
- **WHEN** a checklist drag crosses a valid checklist insertion position and is released elsewhere inside BathOS
- **THEN** Tasks commits the checklist reorder at that retained position without activating the enclosing task drag system

### Requirement: Checklist Horizontal Boundary Traversal
The system SHALL treat adjacent checklist-item inputs as continuous lines for plain horizontal caret movement and macOS Option-modified horizontal caret movement while preserving native text-input and browser behavior away from eligible item boundaries.

#### Scenario: Move left into the preceding checklist item
- **WHEN** a checklist-item input has a collapsed caret at the beginning of its value, an adjacent preceding checklist item exists, and a user on a Mac-like platform presses Left Arrow either without a modifier or with Option as the only modifier
- **THEN** Tasks focuses the preceding checklist input and places the caret at the end of its value

#### Scenario: Move right into the following checklist item
- **WHEN** a checklist-item input has a collapsed caret at the end of its value, an adjacent following checklist item exists, and a user on a Mac-like platform presses Right Arrow either without a modifier or with Option as the only modifier
- **THEN** Tasks focuses the following checklist input and places the caret at the beginning of its value

#### Scenario: Preserve native Option word navigation inside an item
- **WHEN** a user on a Mac-like platform presses Option+Left Arrow or Option+Right Arrow while the collapsed caret is away from the applicable string boundary
- **THEN** Tasks leaves the event to the checklist input's native word-navigation behavior

#### Scenario: Preserve horizontal input behavior outside eligible gestures
- **WHEN** a user presses Left Arrow or Right Arrow with a non-collapsed selection, Command, Control, Shift, a modifier combination, non-macOS Alt, or a caret away from the applicable string boundary
- **THEN** Tasks leaves the event to the native text-input or browser behavior

#### Scenario: Preserve the outer checklist boundaries
- **WHEN** the caret is at the beginning of the first checklist item and the user presses eligible Left Arrow, or at the end of the final checklist item and the user presses eligible Right Arrow
- **THEN** Tasks keeps focus in the current checklist input and leaves the event to native boundary behavior

### Requirement: Readable Markdown Task Notes
The system SHALL retain task notes as plain text while presenting one complete, directly editable, line-aware Markdown surface in an expanded to-do without separate editing and preview modes.

#### Scenario: Reveal source on the active line
- **WHEN** the user's collapsed caret is on a task-note line
- **THEN** the interface keeps that line's complete plain-text source directly editable, preserves every recognized Markdown delimiter visibly in its live-styled source presentation, and semantically presents every other line

#### Scenario: Reveal source across a selection
- **WHEN** the user selects source across more than one task-note line
- **THEN** the interface reveals the complete Markdown source of every line crossed by the selection and preserves the exact selected source range

#### Scenario: Select source backward
- **WHEN** the user begins a task-note selection at a later source position and extends it backward or upward across Markdown lines
- **THEN** line-aware redecoration preserves the later anchor and earlier moving edge so the selection continues extending naturally in that direction

#### Scenario: Present inactive inline Markdown
- **WHEN** a supported heading, italic, bold, or inline-code construct is on a line that does not contain the caret or active selection
- **THEN** the editor hides its Markdown delimiters while retaining the recognized heading, italic, bold, or code presentation of its content

#### Scenario: Present an inactive bullet
- **WHEN** an asterisk-plus-space or hyphen-plus-space bullet is on a line that does not contain the caret or active selection
- **THEN** the editor presents the same ordinary bullet marker in place of either source marker and retains the line's semantic hanging indentation

#### Scenario: Present an inactive Markdown link
- **WHEN** `[label](destination)` source is on a line that does not contain the caret or active selection
- **THEN** the editor hides its brackets, parentheses, and destination, presents only the label in semantic link-blue, and exposes the safe underlying destination as an actionable link

#### Scenario: Present an active Markdown link source
- **WHEN** the caret or active selection enters a line containing `[label](destination)` source
- **THEN** the editor reveals the complete source with muted fixed-width bracket and parenthesis indicators, ordinary foreground label text, and semantic link-blue actionable destination text

#### Scenario: Follow a link on an active line
- **WHEN** a user clicks or taps semantic link-blue Markdown destination text or a semantic link-blue bare URL while its source line is active
- **THEN** the editor opens the validated destination and does not move the caret into the activated URL

#### Scenario: Edit a link destination
- **WHEN** a user needs to edit a destination on an active source line
- **THEN** the user can move the caret into the destination with ordinary keyboard arrow navigation and edit its exact plain-text source

#### Scenario: Limit live Markdown recognition
- **WHEN** notes contain supported Markdown syntax
- **THEN** the editor recognizes headings introduced by one or more hashmarks and a space, single-asterisk italic, double-asterisk bold, asterisk-plus-space bullets, hyphen-plus-space bullets, Markdown links, and single-backtick inline code while treating other Markdown constructs as ordinary text

#### Scenario: Style visible Markdown indicators
- **WHEN** the editor reveals a heading, italic, bold, bullet, Markdown link, or inline-code delimiter on an active source line
- **THEN** the original hashmark-and-space, asterisk, hyphen-and-space, bracket, parenthesis, and backtick indicators remain visible in a fixed-width muted-foreground style while the marked content retains its recognized heading, italic, bold, bullet, link, or code presentation

#### Scenario: Style inline code completely
- **WHEN** the editor reveals source text enclosed by single backticks on one active line
- **THEN** the complete string uses a fixed-width font and a light semantic background while both backticks use the muted indicator color

#### Scenario: Continue a Markdown bullet
- **WHEN** a user presses Enter without Shift while editing a line that begins with `* ` or `- `
- **THEN** the editor inserts a new line beginning with the same two-character marker and wraps each bullet with a two-fixed-width-character hanging indent

#### Scenario: Follow an inactive note link
- **WHEN** an inactive line contains a Markdown link, bare HTTP(S) URL, or bare alphanumeric `scheme://` destination such as `message://`
- **THEN** the live editor exposes the safe destination with a pointer cursor and no hover underline, opens HTTP(S) in a new browser context, dispatches `message://` to Mail, and keeps known executable or content-injection schemes inert

#### Scenario: Preserve editing mechanics while styling
- **WHEN** the editor retokenizes changed source or changes which lines expose source
- **THEN** it preserves the user's caret or selection by exact source offset and direction, defers decoration during composition, accepts pasted content as plain text, yields documented undo and redo commands to Tasks, and autosaves the identical source to the same notes field

#### Scenario: Present unfocused notes semantically
- **WHEN** the Notes control does not own the caret or an active selection
- **THEN** every nonempty line uses its semantic inactive presentation while the same live editor remains available for direct activation and editing

#### Scenario: Start empty notes directly
- **WHEN** an expanded to-do has empty notes
- **THEN** the same live editor presents its placeholder without requiring a separate preview step

### Requirement: Legible Task Lifecycle Feedback
The system SHALL distinguish task completion from bulk selection by shape and SHALL provide brief recoverable visual feedback before terminal work leaves an active list.

#### Scenario: Distinguish completion from selection
- **WHEN** an open task row renders outside selection mode
- **THEN** its completion control is square, while selection mode uses circular selected and unselected controls with distinct accessible names

#### Scenario: Complete a task with motion
- **WHEN** a user completes or cancels an active to-do and reduced motion is not requested
- **THEN** the row quickly fades and collapses before leaving the list, accepts no duplicate terminal action, and restores itself if the mutation fails

#### Scenario: Respect reduced motion during completion
- **WHEN** a user completes or cancels a to-do while reduced motion is requested
- **THEN** the interface skips the decorative delay without changing mutation, error recovery, or focus behavior

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, owner-local future Starts, mutually exclusive Today horizons, deadlines, and terminal timestamps.

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime without a start date
- **THEN** the system changes its destination to Anytime, includes it in Anytime, and retains a null day horizon

#### Scenario: Schedule Someday work
- **WHEN** a user assigns a future Start to Someday work
- **THEN** the system changes its destination to Anytime, includes it in Upcoming according to that date, and stores no Today horizon

#### Scenario: Mark available Anytime work for Today
- **WHEN** a user places available Anytime work in Inbox, Now, Next, or Later
- **THEN** the system keeps a null start date, stores the selected horizon, keeps the same stable item in Anytime, and includes it in the selected Today section

#### Scenario: Review the Today projection
- **WHEN** a user opens Today
- **THEN** the system shows eligible open present Anytime work with no future start date and a day horizon, then groups it in Inbox, Now, Next, and Later order without rendering an empty horizon heading

#### Scenario: Review the Anytime pool
- **WHEN** a user opens Anytime
- **THEN** the system shows every open present Anytime item without a future start date and marks Inbox, Now, Next, or Later for active work that also appears in Today

#### Scenario: Select the Upcoming controlling date
- **WHEN** an open present Anytime item has a future start date
- **THEN** Upcoming uses that start date for membership, ordering, and grouping even when its deadline is earlier or later

#### Scenario: Fall back to a future deadline
- **WHEN** an open present Anytime item has no future start date and has a future deadline
- **THEN** Upcoming includes and groups the item by that deadline while the undated item remains available in Anytime with no day horizon

#### Scenario: Group the next seven days individually
- **WHEN** an Upcoming controlling date falls from tomorrow through the seventh owner-local date after today
- **THEN** the interface groups the item under that individual calendar date in chronological order

#### Scenario: Group later work by month
- **WHEN** an Upcoming controlling date is beyond the next seven dates and no later than the same owner-local calendar date 12 months from today
- **THEN** the interface groups the item under its month and year in chronological order

#### Scenario: Group distant work by year
- **WHEN** an Upcoming controlling date is later than the same owner-local calendar date 12 months from today
- **THEN** the interface groups the item under its calendar year in chronological order

#### Scenario: Keep future work outside Today horizons
- **WHEN** a user opens Upcoming for an item with a future Start
- **THEN** the interface presents the Start without an Inbox, Now, Next, or Later horizon

#### Scenario: Remove work from Today
- **WHEN** a user removes Today placement from a to-do
- **THEN** the system clears its day horizon, removes the to-do from Today, and keeps it undated in Anytime without changing its identity or container

#### Scenario: Activate deferred work
- **WHEN** an Anytime task reaches its owner-local start date through ordinary temporal activation
- **THEN** an idempotent activation clears its start date, assigns Today Inbox, and includes it in Anytime and Today

#### Scenario: Complete, cancel, or delete work
- **WHEN** a user completes, cancels, or deletes a to-do or supported hierarchy root
- **THEN** the system removes it from active planning views and includes it in Done until recovery or automatic purge

### Requirement: Chronological Upcoming Presentation
The system SHALL present the complete Upcoming view from the nearest controlling date to the latest controlling date for every dated task.

#### Scenario: Order exact dates inside broader groups
- **WHEN** multiple Upcoming items fall within the same month or year group
- **THEN** the interface orders those items by their exact controlling dates from nearest to latest

#### Scenario: Preserve deterministic equal-date order
- **WHEN** multiple Upcoming items share the same controlling date
- **THEN** the interface uses stable type-specific ordering without moving any later-dated item above an earlier-dated item

### Requirement: Tagless Structured Semantics
The system SHALL represent workflow meaning through explicit structured concepts, including exactly three actionability states, and SHALL NOT require generic tags, title parsing, or a generic metadata bag as canonical task data.

#### Scenario: Default work to actionable
- **WHEN** a caller creates a to-do without an explicit actionability value
- **THEN** the system stores `actionable`

#### Scenario: Wait for another party or signal
- **WHEN** a user marks an open to-do as Waiting
- **THEN** the system stores `waiting` explicitly and communicates that another party or outside event is expected to unblock the work

#### Scenario: Recheck availability without an expected signal
- **WHEN** a user marks an open to-do as Rechecking
- **THEN** the system stores `rechecking` explicitly and communicates that the owner must deliberately test availability again because no outside notification or contact is expected

#### Scenario: Return work to immediate actionability
- **WHEN** a user changes waiting or rechecking open work back to `actionable`
- **THEN** the system changes only its structured actionability and mutation metadata and leaves its other task dimensions intact

#### Scenario: Reject actionability changes outside active work
- **WHEN** a caller attempts to change actionability on completed, canceled, or recoverably deleted work
- **THEN** the system rejects the mutation without changing the record or appending history

#### Scenario: Converge bulk actionability before advancing
- **WHEN** the user cycles actionability for multiple selected tasks whose actionability states are mixed or uniformly Ready
- **THEN** Tasks sets every selected task to Waiting
- **WHEN** every selected task is already Waiting
- **THEN** Tasks sets every selected task to Rechecking
- **WHEN** every selected task is already Rechecking
- **THEN** Tasks sets every selected task to Ready

#### Scenario: Record task origin
- **WHEN** a to-do is created through web, Raycast, MCP, Mail automation, browser capture, a native client, or import
- **THEN** the system stores that immutable entry channel separately from any typed source reference

#### Scenario: Preserve a typed source
- **WHEN** a task is captured from a webpage, Mail message, file, reading item, template, or import
- **THEN** the system stores the stable source fields and source-specific lifecycle metadata defined for that type without requiring an emoji or text prefix

#### Scenario: Edit a Primary Link independently
- **WHEN** a user adds, changes, or clears a to-do's Primary Link
- **THEN** the system changes only the optional shortcut and task mutation history without changing typed source identity or source-specific lifecycle records

#### Scenario: Initialize a Mail Primary Link
- **WHEN** verified Mail capture creates a to-do and its audited Mail source
- **THEN** the system also initializes the editable Primary Link from the verified `message://` deep link without coupling later edits to the Mail source

#### Scenario: Activate a Primary Link
- **WHEN** a to-do has a nonblank Primary Link
- **THEN** `message:` uses a Mail icon and operating-system dispatch, `jira:` and recognized Jira web URLs use Lucide `Zap`, `obsidian:` uses Lucide `FileText`, generic HTTP(S) uses the external-link icon and a new browser context, and another value uses the external-link icon and an HTTPS destination formed by prepending `https://`

#### Scenario: Reopen a structured task source
- **WHEN** the interface displays present active or terminal work whose typed source contains a supported HTTP(S), Mail-message, or originating-Mac file reference
- **THEN** it exposes a named real link derived from the structured source fields, opens web sources in a separate browser tab, hands platform deep links to their originating application, and never parses the task Summary or Notes to find the source

#### Scenario: Present provenance without an actionable source link
- **WHEN** a task has typed source provenance but its source reference is absent, malformed, or uses a protocol outside that source type's supported contract
- **THEN** the interface retains a visible named origin indicator without exposing the reference as an actionable link

#### Scenario: Retry an automated capture
- **WHEN** an automated entry channel retries creation with the same idempotency key
- **THEN** the system returns the original task and does not duplicate the source record

#### Scenario: Render an origin indicator
- **WHEN** the interface displays a task whose origin has a configured indicator
- **THEN** the interface derives that presentation from origin metadata rather than parsing the task Summary

### Requirement: Touch Task Selection
Tasks SHALL let a touch user enter task selection by deliberately swiping left on an eligible task summary, SHALL select the swiped task as part of that transition, and SHALL preserve browser-owned scrolling and navigation gestures that do not qualify.

#### Scenario: Enter selection with a touch swipe
- **WHEN** selection mode is inactive and an actual touch pointer completes a leftward task-summary swipe of at least 48 CSS pixels whose horizontal displacement is at least 1.25 times its vertical displacement
- **THEN** Tasks safely closes any open editor, clears lightweight focus, enters selection mode, selects the swiped task, establishes it as the range anchor, and prevents the completed swipe from also activating a row control

#### Scenario: Preserve vertical touch scrolling
- **WHEN** a touch movement on a task summary is predominantly vertical or does not reach the qualifying leftward distance
- **THEN** Tasks does not change selection and leaves native vertical page scrolling available

#### Scenario: Preserve browser edge gestures
- **WHEN** a touch begins within 24 CSS pixels of either viewport edge
- **THEN** Tasks does not interpret that contact as task selection

#### Scenario: Ignore non-touch pointers
- **WHEN** a mouse, trackpad, or pen performs equivalent pointer movement across a task summary
- **THEN** Tasks does not enter selection through the swipe gesture

#### Scenario: Cancel interrupted touch selection
- **WHEN** the browser cancels the active touch pointer before a qualifying release
- **THEN** Tasks clears transient gesture state without changing task selection

#### Scenario: Keep Done touch-selectable but fixed
- **WHEN** a user swipes a task in Done
- **THEN** Tasks selects that task through the same touch gesture while continuing to prohibit Done-list reordering

#### Scenario: Reorder a touch-selected group natively
- **WHEN** the active browser begins a native drag from the summary of one selected task after touch selection
- **THEN** Tasks moves the complete selected group through its existing native grouped drag transaction without introducing custom pointer dragging or custom scrolling

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for visible tasks, SHALL treat selection as a temporary context bounded by task rows and selection-owned surfaces, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply only lifecycle-appropriate editing or clipboard actions to selected records. Bulk recoverable deletion SHALL begin every selected deletion as one grouped optimistic interaction, preserve one undoable operation identity, and reconcile each task from the complete persistence result set.

#### Scenario: Enter selection with the platform modifier
- **WHEN** a user Command-clicks a visible task on Mac or Control-clicks a visible task on Windows while selection is inactive
- **THEN** the interface enters selection, makes that task the stable range anchor, selects it, reports the selected count, and does not open its editor

#### Scenario: Select a contiguous anchored range
- **WHEN** a user Shift-clicks a visible task after establishing a selection anchor
- **THEN** the interface replaces the prior range with the contiguous visible range between the original anchor and the clicked task without moving the anchor

#### Scenario: Replace an anchored range repeatedly
- **WHEN** a user Shift-clicks a different visible task while selection remains active
- **THEN** the interface replaces the previous range with the new contiguous range from the original anchor

#### Scenario: Toggle selection after entry
- **WHEN** selection is active and a user ordinarily activates, Command-clicks on Mac, Control-clicks on Windows, or Shift-clicks a visible task summary
- **THEN** the interface updates that task's direct, additive, or anchored-range selection without opening its editor

#### Scenario: Toggle selection through its dedicated control
- **WHEN** selection is active and a user activates a task's circular selection control
- **THEN** the interface toggles only that task's selected state without opening its editor

#### Scenario: Deselect the final task from its summary
- **WHEN** exactly one task remains selected and the user ordinarily activates that task's summary
- **THEN** Tasks deselects the task, exits selection mode, removes the selection toolbar, and does not open the task editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task without performing the touch-selection gesture
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** selection mode is active in Today, Upcoming, Anytime, Someday, or Done
- **THEN** the fixed bottom selection overlay reports `X Task` or `X Tasks`, exposes only Select All, Edit, and Cancel, communicates each selected state to keyboard and assistive-technology users without shifting list content, disables Edit at zero selected tasks, and disables editing choices that are illegal for the selected records

#### Scenario: Present the bulk Edit menu
- **WHEN** one or more tasks are selected and the user activates Edit
- **THEN** Tasks presents Start, Deadline, Area, Actionability, and Delete using the same menu structure and choice labels as the singular task ellipsis menu and omits Repeat

#### Scenario: Preserve native text selection
- **WHEN** a text input, textarea, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change task selection

#### Scenario: Dismiss selection outside a task
- **WHEN** bulk selection is active and the user presses the pointer outside every task row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a task summary, circular task-selection control, the bulk toolbar, or its edit, calendar, Area, or Actionability surface
- **THEN** the interface leaves selection active until the owned interaction changes the selected membership or explicitly exits selection

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Cancel, changes views, or clicks outside a task and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Apply a focused bulk value
- **WHEN** the bulk Edit menu or a selected-task keyboard command requires a start date, deadline, Area, Actionability, or reminder time
- **THEN** the interface opens the appropriate selection-owned surface or nested menu and applies the chosen value to every eligible selected task

#### Scenario: Clear bulk horizons while scheduling
- **WHEN** a user applies a future date to selected tasks
- **THEN** the system clears every selected task's Today horizon while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is ineligible for the requested edit
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Retain eligible tasks after editing
- **WHEN** a bulk edit succeeds and one or more previously selected tasks remain eligible for the current view
- **THEN** selection mode remains active and every still-visible affected task remains selected

#### Scenario: Prune tasks that leave the view
- **WHEN** a bulk edit causes some previously selected tasks to become ineligible for the current view
- **THEN** Tasks removes those tasks from the rendered list and the selection while retaining selection mode and every affected task that remains visible

#### Scenario: Retain empty selection after editing
- **WHEN** a bulk edit causes every previously selected task to become ineligible for the current view
- **THEN** Tasks moves the tasks to their eligible views and keeps selection mode active with `0 Tasks`

#### Scenario: Delete selected tasks recoverably
- **WHEN** the user chooses Delete from the bulk Edit menu or presses a supported delete command for eligible selected open tasks
- **THEN** Tasks begins every selected recoverable deletion without waiting for another selected deletion, removes the complete group from the current active list in one optimistic render, and groups the accepted deletions as one undoable user action

#### Scenario: Reconcile a successful optimistic deletion group
- **WHEN** every selected deletion is accepted by persistence
- **THEN** Tasks keeps every deleted task absent from the active list, moves them to Done as trashed, and keeps selection mode active with zero selected tasks

#### Scenario: Restore failed optimistic deletions
- **WHEN** one or more selected deletion requests fail after the group has been optimistically removed
- **THEN** Tasks restores only the failed tasks to the active list, keeps accepted deletions in Done, presents one concise failure notification, and emits one privacy-safe console and Sentry diagnostic for the grouped action

#### Scenario: Protect task content in bulk-deletion diagnostics
- **WHEN** Tasks reports a partial or complete bulk-deletion failure
- **THEN** structured diagnostic context includes bounded operational state such as counts, active view, and network availability without task identifiers, titles, notes, links, checklist content, or other user-authored task data

#### Scenario: Select terminal Done tasks for nondestructive actions
- **WHEN** the user selects one or more tasks in Done
- **THEN** Tasks permits Copy and Duplicate, rejects Cut and active-task-only edits, and does not select deleted hierarchy records

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

### Requirement: Compact Task Date Controls
The Tasks expanded task editor SHALL present Start and Deadline as a matched two-column pair and SHALL present Actionability beside Area only when at least one Area exists, while retaining each field's independent autosave semantics.

#### Scenario: Present Start and Deadline together
- **WHEN** an expanded task editor renders at a supported desktop or mobile viewport width
- **THEN** Start and Deadline appear on the same row with equal-width triggers, the same ordinary task-input text size, and the same muted right-aligned calendar symbol

#### Scenario: Present Actionability and Area together
- **WHEN** an expanded task editor renders at a supported desktop or mobile viewport width for an owner with at least one Area
- **THEN** Actionability and Area appear on the same row with equal-width triggers and one-line values that truncate rather than expanding the grid

#### Scenario: Omit Area when no Areas exist
- **WHEN** an expanded task editor renders for an owner with no defined Areas
- **THEN** the Area selector is absent and Actionability occupies the full row width

#### Scenario: Clear Deadline inside its picker
- **WHEN** a task has a Deadline and the user activates Clear inside the Deadline picker
- **THEN** Tasks immediately persists a null Deadline, closes the picker, restores trigger focus, and exposes no separate inline clear button

#### Scenario: Leave the Deadline calendar through its lower boundary
- **WHEN** keyboard focus is on the final visible row of the Deadline calendar and the user presses ArrowDown
- **THEN** focus moves to Clear and the visible calendar month does not change

#### Scenario: Identify today in either calendar
- **WHEN** the owner planning date is visible in the Start or Deadline day calendar or its month picker
- **THEN** the shared Calendar replaces today's in-month numeric day label with Lucide's Star icon, places the same icon to the right of the current month name, preserves accessible current-date and month names, and retains selected-value highlighting independently

### Requirement: Flexible Reminder Time Entry
The Tasks Start picker SHALL accept a bounded grammar of reasonable time shorthand, normalize accepted input to one visible local time, persist only canonical 24-hour reminder intent, and provide concise rejection feedback without exposing resolution metadata.

#### Scenario: Normalize meridiem shorthand
- **WHEN** a user enters `1p`, `1pm`, `1 pm`, `1:3p`, `1:30p`, `1:30pm`, `1:30 pm`, or `130p`
- **THEN** Tasks interprets the value as 1:00 pm or 1:30 pm as applicable, displays the normalized lower-case meridiem time, and persists `13:00` or `13:30`

#### Scenario: Normalize numeric shorthand
- **WHEN** a user enters `1`, `13`, `130`, or `1300` for future work
- **THEN** Tasks interprets the values as 1:00 am, 1:00 pm, 1:30 am, and 1:00 pm respectively

#### Scenario: Reject malformed reminder input
- **WHEN** a user commits an impossible or unsupported value such as `25` or `asdf`
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, retains the active reminder surface, and briefly shows `Not allowed.`

#### Scenario: Reject an explicit elapsed Today time
- **WHEN** a Today reminder entry explicitly resolves to an owner-local instant that is not later than the current time
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, and briefly shows `Not allowed.`

#### Scenario: Resolve ambiguous Today shorthand to the remaining future meridiem
- **WHEN** an unsuffixed 1-12-hour reminder value has an elapsed AM interpretation but a future PM interpretation on the owner planning date
- **THEN** Tasks uses the PM interpretation and persists its canonical 24-hour time

#### Scenario: Reject fully elapsed ambiguous Today shorthand
- **WHEN** both AM and PM interpretations of an unsuffixed 1-12-hour value have elapsed on the owner planning date
- **THEN** Tasks performs no reminder mutation, restores the last committed display value, and briefly shows `Not allowed.`

#### Scenario: Accept any valid time for future work
- **WHEN** a reminder belongs to a future Start date
- **THEN** Tasks accepts every valid parser interpretation regardless of the current owner-local time

#### Scenario: Confirm reminder input in two Enter steps
- **WHEN** a user presses Enter while a Start-picker Reminder input contains a valid raw or changed value
- **THEN** Tasks normalizes the visible value and keeps Start open, then the next Enter on the unchanged normalized value closes Start

#### Scenario: Preserve spaces in reminder input
- **WHEN** focus is inside Reminder and the user presses Space
- **THEN** the input receives a space rather than activating or closing Start

#### Scenario: Size Reminder for its surface
- **WHEN** the Start picker renders Reminder
- **THEN** its text input uses the ordinary text-field style and fills the available picker row

### Requirement: Reminder-Initiated Today Planning
The Tasks unified Start picker SHALL allow reminder entry before a task has Start planning and SHALL convert a successfully entered reminder into owner-local Today Inbox planning without replacing an existing planning choice.

#### Scenario: Offer Reminder before planning
- **WHEN** connected reminder storage is available and a present open to-do has neither a future Start Date nor a Today horizon
- **THEN** its Start picker keeps Reminder editable without requiring a preliminary planning selection

#### Scenario: Default an unplanned reminder to Today Inbox
- **WHEN** a user confirms one valid reminder time on a task without Start planning
- **THEN** Tasks assigns Today Inbox before saving exactly one reminder, preserves the entered reminder value while synchronization settles, closes the Start picker after acceptance, and does not report a failure for temporary planning-projection lag

#### Scenario: Preserve an existing Today horizon
- **WHEN** a user saves a reminder on a to-do already placed in Today Inbox, Now, Next, or Later
- **THEN** Tasks preserves that horizon and changes only the reminder

#### Scenario: Preserve an existing future Start Date
- **WHEN** a user saves a reminder on a to-do with a future Start Date
- **THEN** Tasks preserves the future Start Date with no Today horizon and schedules the reminder for that Start Date

#### Scenario: Reject an elapsed time before default planning
- **WHEN** a user enters a time that has already elapsed on the owner planning date for an otherwise unplanned to-do
- **THEN** Tasks reports `Not allowed.`, saves neither Today · Inbox planning nor a reminder, and restores the last committed reminder display

#### Scenario: Retain reminder planning in an untitled draft
- **WHEN** a user enters a valid reminder before a new-task draft has a persistent identifier
- **THEN** Tasks retains Today · Inbox in the draft, retains the pending reminder intent, and persists the planned to-do before saving its reminder after the first valid title

### Requirement: Shared Task Editor Form Commands
The Tasks expanded to-do editor SHALL act as an autosaving form scope under the shared BathOS form-control interaction contract. Its documented close commands SHALL flush pending valid autosave and close the editor because accepted task changes cannot be canceled retroactively.

#### Scenario: Close a task with the form-submit command
- **WHEN** a task editor is open and the user presses Command+Return on Mac or Control+Return on Windows outside active composition
- **THEN** Tasks suppresses the matching browser action, flushes pending autosave, closes the editor from any focused task field, and commits deferred completion through the ordinary close path

#### Scenario: Close a task with the alternate Mac form command
- **WHEN** a task editor is open and the user presses Command+Escape on Mac outside active composition
- **THEN** Tasks suppresses the matching browser action, flushes pending autosave, closes the editor from any focused task field, and commits deferred completion without claiming to revert accepted edits
#### Scenario: Keep plain Escape field-local
- **WHEN** a task editor is open and the user presses unmodified Escape
- **THEN** the deepest open task field layer may cancel or revert itself, but the task editor remains open when no field layer owns Escape
#### Scenario: Discard an untitled task draft on form close
- **WHEN** either task form command closes a draft whose title never became nonblank
- **THEN** Tasks removes the local draft without creating synchronized work, history, sources, reminders, or a success toast

#### Scenario: Present the revised close commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the close action shows `⌘Return`, `⌘Escape`, or `⌃Q` on Mac and `⌃Return` or `⌥⇧Q` on Windows, and it does not promise that Windows Control+Escape can override the operating system

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

### Requirement: Focused To-Do Action Menu
The Tasks interface SHALL keep an active task's ellipsis menu limited to Start, Deadline, Area, Actionability, Repeat, and recoverable Delete while retaining drag, keyboard ordering, and complete metadata editing outside that menu.

#### Scenario: Present direct task actions
- **WHEN** a user opens an active non-projection task's ellipsis menu
- **THEN** the menu presents Start, Deadline, Area, Actionability, Repeat when eligible, and Delete in that order and does not present Move, Do, direct Mark As actions, Cancel, Move Up, or Move Down

#### Scenario: Choose an Area through a submenu
- **WHEN** a user opens Area from a task's ellipsis menu
- **THEN** a neighboring submenu presents No Area followed by every configured Area, selecting one value applies it through the ordinary task update path, and both menus close

#### Scenario: Choose Actionability through a submenu
- **WHEN** a user opens Actionability from a task's ellipsis menu
- **THEN** a neighboring submenu presents Ready, Rechecking, and Waiting in conceptual order, disables the task's current value, and selecting another value applies it through the ordinary task update path before both menus close

#### Scenario: Delete from the task menu
- **WHEN** a user activates Delete from an active task's ellipsis menu
- **THEN** Tasks moves the task to Done with the deleted disposition rather than completing it

### Requirement: Task Ellipsis Menu Relinquishes Focus
The Tasks interface SHALL end ellipsis-menu interaction without retaining or transferring whole-task keyboard focus.

#### Scenario: Dismiss the ellipsis menu
- **WHEN** a user opens an ordinary task or recurrence prototype ellipsis menu and dismisses it without selecting an action
- **THEN** Tasks closes the menu, prevents focus restoration to its trigger, and leaves no task with whole-task focus

#### Scenario: Dismiss the ellipsis menu with a pointer outside
- **WHEN** a user dismisses an ordinary task or recurrence prototype ellipsis menu by clicking or tapping outside it
- **THEN** Tasks closes the menu without returning keyboard focus to the ellipsis trigger

#### Scenario: Complete a direct menu action
- **WHEN** a user selects an Area, Actionability, or recoverable Delete action from a task's ellipsis menu
- **THEN** Tasks applies the accepted action without focusing the originating task or a fallback task

#### Scenario: Close a menu-launched task surface
- **WHEN** Start, Deadline, or Repeat was opened through a task's ellipsis menu and that surface is completed or dismissed
- **THEN** Tasks closes the surface without focusing the originating task or another task

#### Scenario: Preserve non-menu focus behavior
- **WHEN** a task action is invoked through a direct task control or documented keyboard command rather than the ellipsis menu
- **THEN** Tasks retains that action's existing whole-task focus or fallback behavior

### Requirement: Explicit Primary Link Clearing
The system SHALL preserve an explicitly cleared Primary Link independently from immutable typed source provenance.

#### Scenario: Reopen a cleared Mail Primary Link
- **WHEN** a user clears a Mail-captured to-do's Primary Link, closes the editor, and later reopens it
- **THEN** the Primary Link remains null, the row exposes no Primary Link icon, and the immutable Mail source remains unchanged

#### Scenario: Restore explicit null without legacy fallback
- **WHEN** a current export envelope contains a `primary_link` key whose value is null
- **THEN** restore preserves null and does not initialize the shortcut from `source_url`

#### Scenario: Initialize a missing legacy Primary Link
- **WHEN** an older export envelope omits the `primary_link` key for supported Mail provenance
- **THEN** normalization MAY initialize the editable shortcut from the verified Mail source for backward compatibility

### Requirement: Orthogonal Task State
The system SHALL model lifecycle, record disposition, planning destination, Today membership, and structured actionability as separate dimensions with revision-checked transitions and append-only history.

#### Scenario: Complete open work
- **WHEN** a caller completes present open work from the current revision
- **THEN** the system sets lifecycle to completed, records `completed_at`, removes the work from active views, includes it in Done, and appends one completion event

#### Scenario: Cancel open work
- **WHEN** a non-web caller cancels present open work from the current revision
- **THEN** the system sets lifecycle to canceled, records `canceled_at`, removes the work from active views, includes it in Done, and appends one cancellation event

#### Scenario: Omit cancellation from active to-do web actions
- **WHEN** the web interface presents lifecycle actions for an active to-do
- **THEN** it offers completion and recoverable deletion without exposing cancellation as a third terminal path

#### Scenario: Reopen terminal work
- **WHEN** a caller reopens completed or canceled work from Done during retention
- **THEN** the system returns lifecycle to open, clears the current terminal timestamp, restores valid Anytime placement with no Today membership when needed, and retains prior history

#### Scenario: Retry a lifecycle transition
- **WHEN** a caller repeats a lifecycle mutation with the same client mutation identifier
- **THEN** the system returns the original receipt without appending another history event

#### Scenario: Request the current lifecycle again
- **WHEN** a caller with a new mutation identifier requests a lifecycle value the record already has
- **THEN** the system returns a no-op receipt without appending a duplicate terminal event

#### Scenario: Complete a parent to-do with checklist state
- **WHEN** a caller completes and later reopens a to-do with checklist items
- **THEN** the system preserves each checklist item's prior completion state

#### Scenario: Delete work
- **WHEN** a caller deletes present work from the current revision
- **THEN** the system records recoverable deletion, includes the root in Done, and preserves the hierarchy operation receipt

#### Scenario: Restore deleted work
- **WHEN** a caller restores deleted work from Done during retention
- **THEN** the system restores valid prior hierarchy and active state, falling back to Anytime with no Today membership when the prior placement is no longer valid

### Requirement: Temporal Planning Semantics
The system SHALL store Start Date as a future-only deferral calendar fact for user-authored planning, store Deadline independently while treating it as an implicit Start only until a deadline without an explicit Start reaches the owner-local planning date, materialize that activation date as Start for deadline-derived Today work, retain day horizons for active Today work, reset unfinished Today tasks for owner-local daily re-planning, derive activation and Today from the owner's IANA planning time zone, and store reminder times as unambiguous instants resolved on the current Start intent.

#### Scenario: Start date and deadline coexist in either order
- **WHEN** a to-do has both a start date and a deadline
- **THEN** the system requires the start date to be future, uses it to control deferral, retains the deadline as an informational completion boundary, and accepts either ordering between those two dates

#### Scenario: Continue work after its deadline
- **WHEN** a caller assigns a start date later than the retained deadline
- **THEN** the system accepts the mutation, preserves the overdue deadline, and keeps the item available according to the new start date

#### Scenario: Keep a future deadline implicit
- **WHEN** an open, present Anytime to-do has no Start or Today horizon and Upcoming derives its controlling date from a future deadline
- **THEN** the system keeps the Start visibly and persistently unset before that deadline reaches the owner-local planning date

#### Scenario: Activate a reached deadline without an explicit Start
- **WHEN** an open, present Anytime to-do has no Start or Today horizon and its deadline reaches the owner-local planning date
- **THEN** local and server activation assign the owner-local planning date as Start, converge on Today Inbox, preserve the deadline, include the task in Today and Anytime, and append one accepted system-authored revision transition

#### Scenario: Catch up deadline-derived activation
- **WHEN** a deadline-only task is overdue when activation resumes after one or more missed owner-local dates
- **THEN** local and server activation assign the current owner-local planning date as Start rather than backdating Start to the stale deadline

#### Scenario: Prefer an explicit Start over deadline activation
- **WHEN** a to-do has a future Start and a deadline that is today or overdue
- **THEN** the system retains the future Start, does not activate the to-do into Today from its deadline, and continues to plan it by the explicit Start

#### Scenario: Travel across time zones
- **WHEN** the owner's current or planning time zone changes
- **THEN** date-only start and deadline values remain assigned to the same calendar dates and Today eligibility follows the owner-local planning date

#### Scenario: Reject a reached Start Date
- **WHEN** a user or automation attempts to assign today or an earlier calendar date as Start Date
- **THEN** the system rejects the value without changing the task because Start Date represents only future deferral

#### Scenario: Activate a reached Start Date
- **WHEN** time advances to a stored Start Date in the owner's planning time zone
- **THEN** local and server activation converge on a null start date, Today Inbox, one accepted revision transition, defensive Today visibility while synchronization catches up, and preservation of an already-resolved same-day reminder

#### Scenario: Reset unfinished Today tasks after midnight
- **WHEN** the owner's planning date advances while one or more open, present tasks remain in Inbox, Now, Next, or Later
- **THEN** local and server activation converge on Today Inbox for every such task with one accepted system-authored revision transition per task

#### Scenario: Activate newly reached planning dates after rollover
- **WHEN** the owner-local planning date advances while prior-day Today tasks, future Starts reaching the new date, and deadline-only tasks due on the new date exist
- **THEN** the system resets the prior-day Today tasks to Inbox before activating the newly reached Starts and deadlines into Today Inbox

#### Scenario: Preserve deliberate planning after midnight
- **WHEN** a task is created or its Today planning is changed after the new owner-local date begins but before the next automatic rollover check
- **THEN** the rollover retains that new-day horizon because the task has already been deliberately planned for the current date

#### Scenario: Exclude inactive and otherwise unplanned work from rollover
- **WHEN** the owner-local planning date advances
- **THEN** completed, canceled, deleted, Someday, future-starting, and horizon-free Anytime tasks without a reached deadline retain their existing planning and lifecycle state

#### Scenario: Preserve reminders through daily rollover
- **WHEN** an unfinished Today task with a reminder rolls into the new day's Inbox
- **THEN** the reminder retains its original local date, resolved instant, occurrence, and delivery state rather than being repeated or rescheduled

#### Scenario: Retry or catch up daily rollover
- **WHEN** repeated clients or jobs evaluate the same planning date, or evaluation resumes after one or more missed days
- **THEN** the system performs at most one effective rollover for the latest owner-local date, activates any overdue deadline-only work once, and does not append no-op task revisions

#### Scenario: Place work in a day horizon
- **WHEN** a user selects Inbox, Now, Next, or Later for Anytime work
- **THEN** the system records the active horizon without inventing a future Start Date

#### Scenario: Edit Start and dependent controls
- **WHEN** a user opens a to-do's temporal planning controls
- **THEN** one Start picker presents Today horizons, a future-only calendar, reminder time, and Clear with complete keyboard operation and immediate persistence

#### Scenario: Resolve a reminder
- **WHEN** a caller schedules a reminder with a wall-clock time and IANA time zone for an item with a future Start Date or Today horizon
- **THEN** the system stores that time intent and resulting UTC instant on the future Start Date or owner planning date for every delivery client

#### Scenario: Resolve a nonexistent reminder time
- **WHEN** a requested local reminder time falls in a daylight-saving gap on its effective reminder date
- **THEN** the system selects the first valid instant after the gap and records the adjustment

#### Scenario: Resolve an ambiguous reminder time
- **WHEN** a requested local reminder time occurs twice during a daylight-saving transition and the caller supplies no preference
- **THEN** the system selects the earlier instant and records that choice

#### Scenario: Display a reminder after travel
- **WHEN** the owner's display time zone changes after a reminder is resolved
- **THEN** the interface converts the stored instant for display without moving the scheduled instant

### Requirement: Recurrence Integrity
The system SHALL keep revisioned recurrence definitions separate from task instances, SHALL present one permanent recurrence prototype only in Upcoming while the definition remains active and has a knowable next spawn date, SHALL support calendar and after-completion schedules, SHALL assign every logical recurrence event a deterministic unique identity, and SHALL generate due instances through owner-local background activation without requiring an open client.

#### Scenario: Apply Repeat to an existing task
- **WHEN** a user saves a recurrence on an ordinary task
- **THEN** the system snapshots that task as the recurrence template, uses it as the initial recurrence prototype without duplicating a spawned instance before its first spawn date, and records recurrence provenance

#### Scenario: Configure an after-completion recurrence
- **WHEN** a user chooses after completion and supplies a positive interval in days, weeks, months, or years
- **THEN** the recurrence waits for an authoritative Done transition of the current instance before deriving the next schedule anchor

#### Scenario: Configure a calendar recurrence
- **WHEN** a user chooses daily, weekly, monthly, or yearly recurrence and supplies its interval and applicable day pattern
- **THEN** the editor previews the next bounded dates and the authoritative rule produces the same logical dates

#### Scenario: Configure recurrence end
- **WHEN** a user chooses never, after a positive number of occurrences, or on an inclusive end date
- **THEN** the recurrence produces no occurrence beyond that boundary

#### Scenario: Generate a recurring instance
- **WHEN** an active recurrence prototype reaches its spawn date in the owner's planning time zone
- **THEN** the authoritative server activation creates no more than one ordinary task instance for that logical recurrence event and advances the prototype to its next knowable spawn date without requiring a foreground client

#### Scenario: Inherit prototype metadata
- **WHEN** a recurrence prototype spawns a task instance
- **THEN** the instance inherits the prototype's captured summary, notes, Primary Link, Area, checklist content and completion states, actionability, reminder configuration, and applicable Start and Deadline rules

#### Scenario: Derive Start from a repeating Deadline
- **WHEN** a recurrence includes deadlines and specifies that work starts a nonnegative number of days earlier
- **THEN** each cadence date becomes the task Deadline, the spawn date is that many owner-local dates earlier, and the generated task persists that spawn date as its Start

#### Scenario: Activate an early-Start recurrence at midnight
- **WHEN** owner-local midnight makes a calendar recurrence's spawn date current while its cadence Deadline remains in the future
- **THEN** background activation creates the ordinary instance in Today Inbox with the current Start and future Deadline and advances the prototype to its next cadence bucket

#### Scenario: Inherit a recurrence reminder
- **WHEN** a recurrence enables a valid reminder time
- **THEN** each generated instance receives that reminder on its generated Start date through the existing time-zone-safe reminder path

#### Scenario: Complete an after-completion instance
- **WHEN** a user completes the latest instance of after-completion work
- **THEN** the system preserves the recurrence definition and derives exactly one next prototype date from the authoritative completion date

#### Scenario: Present the scheduled successor after after-completion work enters Done
- **WHEN** the latest after-completion instance enters Done and the authoritative definition derives a future next occurrence
- **THEN** Upcoming removes the prototype from the waiting section and presents it exactly once in the date bucket for the projected Start of its next generated instance
- **AND** Quick Find and direct recurrence navigation resolve to that same visible prototype row

#### Scenario: Trash an after-completion instance
- **WHEN** a user trashes the latest instance of after-completion work
- **THEN** the system treats the authoritative trash date as its Done date and derives exactly one next prototype date from it

#### Scenario: Present waiting after-completion work
- **WHEN** an active after-completion recurrence has an outstanding open instance and therefore cannot yet derive its successor
- **THEN** Upcoming presents the prototype once in a non-draggable Repeating Tasks section after its dated buckets, with Waiting plus its applicable Area, non-Ready Actionability, Notes, and Checklist metadata in the second row

#### Scenario: Restore the outstanding after-completion instance
- **WHEN** the latest completed or trashed instance is restored before its successor reaches its spawn date
- **THEN** the system retracts that future successor from task surfaces and returns the prototype to the waiting section until the restored instance enters Done again

#### Scenario: Go to the outstanding instance
- **WHEN** a user chooses Go to Instance for a waiting after-completion prototype
- **THEN** Tasks navigates to the list containing its outstanding instance and opens that ordinary task

#### Scenario: Present a dated recurrence prototype
- **WHEN** an active recurrence has a knowable future spawn date
- **THEN** Upcoming presents exactly one prototype regardless of whether its rule mode is calendar or after completion, in the date bucket determined by its future Start when present or otherwise its future Deadline

#### Scenario: Present recurrence prototype metadata
- **WHEN** a recurrence prototype appears in Upcoming
- **THEN** its second row presents its applicable Area, non-Ready Actionability, Notes, and Checklist metadata using the same order, symbols, colors, and omission rules as an ordinary task
- **AND** a dated prototype with a generated-instance Deadline rule presents that next Deadline using the ordinary relative Deadline treatment

#### Scenario: Exclude a reached prototype from Upcoming
- **WHEN** a recurrence prototype's spawn date is on or before the owner's planning date
- **THEN** Upcoming does not present that prototype in a current-day or past date bucket after activation commits

#### Scenario: Distinguish an Upcoming recurrence prototype
- **WHEN** a future recurrence prototype appears in an Upcoming date bucket
- **THEN** its leading control is the recurrence symbol rather than a checkbox and it cannot be completed, bulk-mutated, or dragged into another date bucket

#### Scenario: Open a recurrence prototype
- **WHEN** a user activates a dated or waiting recurrence prototype in Upcoming
- **THEN** Tasks opens an inline metadata drawer that allows Summary, Notes, Primary Link, Area, Actionability, and Checklist editing through ordinary task-editor paradigms
- **AND** the drawer omits editable Start and Deadline controls and presents one full-width Edit Repeat button in their place

#### Scenario: Save ordinary prototype metadata
- **WHEN** the user changes ordinary metadata in an opened recurrence prototype
- **THEN** Tasks autosaves the current prototype snapshot as a new recurrence revision without changing cadence or any already generated instance
- **AND** later instances inherit the newly accepted prototype metadata

#### Scenario: Present a spawned instance in Upcoming
- **WHEN** an already-spawned recurrence instance remains or becomes eligible for Upcoming because of its editable Start or Deadline
- **THEN** it appears as an ordinary task with a checkbox and complete ordinary task editing, selection, completion, deletion, and drag behavior

#### Scenario: Reach a recurrence task instance
- **WHEN** a future prototype reaches its spawn date and its task instance appears in Today, Anytime, or Upcoming
- **THEN** the instance behaves as an ordinary task and does not expose Edit Repeat

#### Scenario: Keep the prototype after spawning
- **WHEN** a calendar prototype spawns its due instance
- **THEN** the prototype remains represented in Upcoming at the next valid cadence date without causing the spawned instance to appear as repeating

#### Scenario: Edit Repeat from Upcoming
- **WHEN** a user chooses Edit Repeat from an opened prototype or its ellipsis menu
- **THEN** Tasks opens a separate recurrence editor containing cadence, next-occurrence, reminder, and generated-instance Deadline controls but no ordinary prototype metadata fields
- **AND** Save commits the complete cadence change atomically as a new recurrence revision while Cancel commits none of it

#### Scenario: Keep the next occurrence current or future
- **WHEN** a user creates or edits recurrence scheduling
- **THEN** the next occurrence cannot be selected or saved before the owner's current planning date, and an older source date advances to the next valid cadence date

#### Scenario: Replace materialized future projections after a calendar edit
- **WHEN** a calendar recurrence edit is accepted after its prior revision has materialized a future Upcoming prototype
- **THEN** the system supersedes that prior-revision prototype, resets evaluation to the owner-local planning date, and materializes the edited cadence without changing any reached task instance

#### Scenario: Override the next after-completion occurrence
- **WHEN** a user edits a waiting after-completion recurrence and changes Next Occurrence
- **THEN** the next prototype generated after its outstanding older-revision instance enters Done uses that date and later Done transitions resume interval-based scheduling

#### Scenario: Cancel an after-completion instance
- **WHEN** a user cancels an instance governed by an after-completion rule
- **THEN** the system does not advance that rule from the cancellation

#### Scenario: Retry occurrence generation
- **WHEN** clients or jobs concurrently request generation for the same logical recurrence event
- **THEN** a uniqueness boundary returns the one existing occurrence instead of creating a duplicate

#### Scenario: Continue calendar evaluation from its durable cursor
- **WHEN** a calendar recurrence has already been evaluated through an earlier date and a new request evaluates it farther forward
- **THEN** the server derives due work and the next future prototype from its durable occurrence history without duplicating earlier logical events

#### Scenario: Evaluate missed calendar events
- **WHEN** a calendar recurrence has one or more missed spawn dates
- **THEN** the generator applies the definition's explicit `skip`, `latest`, or `all` policy to spawned instances and defaults to `latest`

#### Scenario: Edit a recurrence definition
- **WHEN** a user changes a recurrence definition after it has generated work
- **THEN** the change creates a new revision, reached instances retain their source revision, and superseded future prototypes remain durable but are omitted from task surfaces

#### Scenario: Pause recurrence
- **WHEN** a user pauses or archives a recurrence definition
- **THEN** the system stops future generation without deleting existing instances

#### Scenario: Report a failed catch-up independently from an accepted definition change
- **WHEN** a recurrence definition is created, revised, or resumed successfully but its immediate occurrence evaluation fails
- **THEN** the system retains the accepted definition change, reports catch-up as a separate content-free failure, avoids an automatic retry loop for the same planning date, and exposes an explicit retry action

#### Scenario: Distinguish unavailable recurrence data from an empty list
- **WHEN** the recurrence projection is loading or fails to load
- **THEN** the web interface presents the corresponding loading or failure state, withholds the empty-list claim, and disables recurrence mutation until the projection is trustworthy

#### Scenario: Hydrate an owner-safe recurrence response
- **WHEN** an authenticated recurrence RPC omits the owner identifier from its returned definition or revision
- **THEN** the client assigns the already authenticated owner to the parsed result while synchronized recurrence rows continue to validate their stored owner identifier

### Requirement: Recurrence Spawn Boundary
Tasks SHALL materialize an ordinary recurrence instance only when its computed spawn date has reached the owner's current planning date, SHALL keep the cadence date as the durable recurrence cursor and generated Deadline where applicable, and SHALL keep unreached work solely as a virtual Upcoming prototype.

#### Scenario: Convert a task before its first spawn date
- **WHEN** a user applies Repeat to an ordinary task with a first spawn date later than the owner's current planning date
- **THEN** the system preserves the task's editable content in the recurrence prototype, removes the ordinary source task from task lists, and presents no ordinary occurrence before that date

#### Scenario: Convert a task on its first spawn date
- **WHEN** a user applies Repeat to an ordinary task whose first spawn date is the owner's current planning date
- **THEN** the system adopts that task as the reached initial ordinary instance and advances the virtual prototype according to its cadence

#### Scenario: Evaluate through the planning date
- **WHEN** an authenticated client or background activation evaluates recurrence through the owner's current planning date
- **THEN** the evaluator generates every occurrence selected by missed policy whose computed spawn date has reached that planning date

#### Scenario: Reject future recurrence evaluation
- **WHEN** any client asks the authoritative recurrence evaluator to generate through a date later than the owner's current planning date
- **THEN** the evaluator rejects the request without creating an occurrence or advancing the prototype

#### Scenario: Repair an unreached adopted projection
- **WHEN** migration data contains an open adopted occurrence whose immutable spawn date is later than the owner's current planning date
- **THEN** the system preserves its current task and checklist content in the prototype, removes the premature task and occurrence, and rewinds the prototype to its cadence date

#### Scenario: Preserve a reached instance deferred into the future
- **WHEN** an ordinary recurrence instance has an immutable spawn date on or before the owner's planning date and the user later assigns it a future Start
- **THEN** recurrence cleanup preserves that ordinary instance and its editable metadata

### Requirement: Explicit Monthly Recurrence Cadence
Tasks SHALL expose every value that controls a monthly recurrence and SHALL evaluate the same explicit rule in the preview and authoritative server paths.

#### Scenario: Repeat on a numbered calendar date
- **WHEN** a user configures a monthly recurrence for a numbered day from 1 through 31
- **THEN** the dialog visibly records that date and each eligible month schedules on that date, clamped to the month's final date when necessary

#### Scenario: Repeat on the last calendar day
- **WHEN** a user configures a monthly recurrence for Last Day
- **THEN** every eligible month schedules on its final calendar date

#### Scenario: Repeat on an ordinal weekday
- **WHEN** a user configures a monthly recurrence such as First Thursday or Last Monday
- **THEN** every eligible month schedules on the explicitly selected ordinal and weekday

#### Scenario: Repeat on an ordinal weekday group
- **WHEN** a user configures an ordinal Weekday or Weekend Day recurrence such as Last Weekend Day
- **THEN** every eligible month schedules on the matching calendar day counted from the beginning for positive ordinals or from the end for Last

#### Scenario: Preview the next three Starts
- **WHEN** a calendar recurrence does not add Deadlines
- **THEN** the repeat dialog previews the next three occurrence Start dates produced by the visible rule

#### Scenario: Preview paired Starts and Deadlines
- **WHEN** a calendar recurrence adds Deadlines and starts work a nonnegative number of days earlier
- **THEN** the repeat dialog previews the next three instances with both the derived Start and controlling Deadline for each instance

### Requirement: Stable Manual Ordering
The system SHALL preserve intentional manual ordering across direct drag, keyboard moves, same-view Today horizon changes, saves, refreshes, offline operation, and synchronization.

#### Scenario: Reorder active work by drag
- **WHEN** a user drags an active task before or after another task in a supported ordered scope
- **THEN** the system saves the new fractional order and displays the committed placement without opening the dragged task's editor

#### Scenario: Limit task drag initiation to the summary row
- **WHEN** a task supports pointer reordering
- **THEN** only its summary row is a task-level drag source, and no pointer drag beginning in its expanded metadata editor initiates task reordering

#### Scenario: Collapse an open task at drag start
- **WHEN** a user begins dragging an open task from its summary row
- **THEN** Tasks begins collapsing the metadata editor, completes the ordinary autosave-aware close path, and continues the task reorder with the collapsed row

#### Scenario: Move into another visible Today horizon
- **WHEN** a user drops a Today to-do before or after a target to-do in another currently visible Inbox, Now, Next, or Later section
- **THEN** the system changes the dragged to-do's horizon and fractional order together and displays it at the requested target position

#### Scenario: Keep hidden Today horizons unavailable as drop targets
- **WHEN** a Today horizon has no visible work
- **THEN** the interface omits its heading and does not introduce a permanent empty drop zone for that horizon

#### Scenario: Retain non-pointer ordering
- **WHEN** a user cannot or does not use drag-and-drop
- **THEN** the interface retains keyboard commands that move the focused task within the same supported scope

#### Scenario: Reorder within a Today horizon by keyboard
- **WHEN** a user invokes a keyboard reorder in Inbox, Now, Next, or Later
- **THEN** the system changes only that item's order within the same visible section and does not infer a cross-section destination

#### Scenario: Reorder active and inactive planning pools independently
- **WHEN** a user reorders work in Anytime or Someday
- **THEN** the system changes only that item's order within its current planning placement and does not activate, defer, schedule, or move unrelated work

#### Scenario: Preserve Anytime rank through metadata changes
- **WHEN** a task remains in the Anytime destination while its Start, Today horizon, Deadline, actionability, organization, or other metadata changes
- **THEN** the system preserves its destination-wide manual order key rather than deriving rank from that metadata

#### Scenario: Withhold drag in unsupported contexts
- **WHEN** selection is active, a row mutation is pending, or the view has no manual-order contract
- **THEN** the interface does not offer a draggable task row

#### Scenario: Restore after asynchronous save
- **WHEN** a reorder is saved asynchronously and the view refreshes
- **THEN** the interface retains the user's committed order without visible reversion or scroll disruption

#### Scenario: Resolve concurrent ordering changes
- **WHEN** two clients change overlapping ordered items before synchronization completes
- **THEN** the system applies the documented deterministic conflict policy and does not lose or duplicate an item

#### Scenario: Concurrently insert items into the same order gap
- **WHEN** two clients assign the same fractional order key to different items before synchronization
- **THEN** both items remain present and every client derives the same total order by sorting on order key and then stable item identifier

#### Scenario: Concurrently reorder the same item
- **WHEN** two clients reorder the same item from the same base revision
- **THEN** the first accepted revision remains authoritative and the stale reorder produces a conflict receipt rather than silently overwriting the accepted order

### Requirement: Offline Task Operation
The system SHALL allow core task work to continue during temporary network loss, SHALL allow a previously loaded installed Tasks web app to reopen its interface without network access, and SHALL reconcile valid local changes when connectivity returns.

#### Scenario: Create work offline
- **WHEN** the user creates a to-do while the client is offline
- **THEN** the client stores the to-do durably, displays it immediately, and queues it for synchronization

#### Scenario: Complete work offline
- **WHEN** the user completes a to-do while the client is offline
- **THEN** the client retains the completion across restart and synchronizes it when connectivity returns

#### Scenario: Reconnect after multiple changes
- **WHEN** a client reconnects after local and remote task changes occurred
- **THEN** the system reconciles the changes according to the documented conflict rules and reports any state it cannot reconcile safely

#### Scenario: Preserve the durable mutation queue
- **WHEN** a client restarts while one or more mutations have not reached the server
- **THEN** the client retains the queued mutations, exposes their count, and retries them without creating duplicate logical tasks

#### Scenario: Prepare offline launch without requesting notification permission
- **WHEN** an authenticated user opens Tasks on a supported secure client with network access
- **THEN** the client idempotently registers the Tasks service worker and stages the complete public application shell without requesting notification permission, creating a push subscription, or sending a reminder-registration mutation

#### Scenario: Reopen a previously loaded Tasks PWA offline
- **WHEN** an installed Tasks web app completed one online shell stage and later launches a `/tasks/*` route during temporary network loss
- **THEN** the service worker returns one internally consistent cached shell whose versioned application assets are available, and the Tasks runtime can open its durable local database and pending mutation queue

#### Scenario: Prepare the Home Screen installation's independent storage
- **WHEN** an iPhone or iPad user adds Tasks to the Home Screen and launches that installed app online
- **THEN** Tasks uses its permanent same-origin manifest, establishes authentication and synchronization in the Home Screen app's own browsing partition, and reports offline launch as ready only after that partition contains the active complete shell

#### Scenario: Expose incomplete offline preparation without overstating readiness
- **WHEN** the current client does not yet have an active complete Tasks shell in its own Cache Storage
- **THEN** Synchronization Details reports offline launch as preparing, failed, or unavailable instead of ready, even if another browser or installation has staged the shell

#### Scenario: Preserve the previous shell after an incomplete refresh
- **WHEN** an online Tasks navigation receives new shell HTML but one required versioned application asset cannot be staged
- **THEN** the service worker leaves the prior complete shell active, removes the incomplete staging cache, and does not make the partial deployment the offline fallback

#### Scenario: Replace a CDN-cached worker release
- **WHEN** a new backward-compatible Tasks worker is published while the hosting edge still retains the prior unversioned script response
- **THEN** the client registers the new versioned worker script URL under the existing root scope so the published worker installs without creating a competing registration or push subscription

#### Scenario: Isolate offline caching from other BathOS modules and data traffic
- **WHEN** the root-scoped Tasks service worker observes another BathOS module navigation, authentication traffic, Supabase, PowerSync, MCP, reminder-provider, or other non-shell request
- **THEN** it does not intercept or cache that request and stores no task content, owner data, credential, provider secret, or API response in Cache Storage

#### Scenario: Pause remote role probes while offline
- **WHEN** the Tasks shell opens while the browser reports that network connectivity is unavailable
- **THEN** the client retains cached authorization state, makes no administrator-role network probes, labels synchronization as offline, and resumes authorization and synchronization checks when connectivity returns

#### Scenario: Back off transient role-probe failures
- **WHEN** an administrator-role probe fails while the browser still reports online
- **THEN** the client retries with bounded exponential backoff instead of issuing a fixed high-frequency request loop

### Requirement: Deterministic Task Reconciliation
The system SHALL use stable task identifiers and optimistic integer revisions so stale task mutations are detected, reported, and resolved to an authoritative server state.

#### Scenario: Upload a current task revision
- **WHEN** a queued task mutation increments the server's current revision by one
- **THEN** the server accepts the mutation and the client removes it from the durable queue

#### Scenario: Reject a stale task revision
- **WHEN** another client has already advanced the task beyond a queued mutation's base revision
- **THEN** the stale mutation does not overwrite the server row, the client records a content-free conflict receipt, and the local task converges to the authoritative server row

#### Scenario: Reconcile completion against a stale edit
- **WHEN** one client completes a task and another client uploads an edit based on the same earlier revision
- **THEN** the first accepted mutation remains authoritative and the later stale mutation follows the conflict-receipt behavior

#### Scenario: Converge web and automation mutations in either winner order
- **WHEN** the web client and an authenticated automation client mutate the same task from one base revision before both mutations settle
- **THEN** whichever revision reaches the authoritative service first remains, the stale path drains or returns a content-free conflict receipt, every client converges to that row, and immutable entry provenance remains unchanged

### Requirement: Actionable Synchronization Diagnostics
The system SHALL expose trustworthy synchronization state without logging task content, including first-full-sync completion, durable queue depth, last successful synchronization, upload and download activity or errors, confirmed bounded degradation and recovery episodes, and conflict receipts.

#### Scenario: Inspect synchronization details
- **WHEN** a user opens the visible task synchronization status
- **THEN** the interface reports connection mode, first-full-sync completion, durable pending-change count, last successful synchronization, upload and download activity or failure independently, recent content-free confirmed degradation and recovery episodes, and recent content-free conflict receipts

#### Scenario: Withhold a premature synchronized claim
- **WHEN** a connected Tasks installation has not completed its first full synchronization
- **THEN** the interface reports that synchronization is preparing and does not label the installation `Synced`

#### Scenario: Report a healthy synchronized installation
- **WHEN** the client is connected, has completed a full synchronization, has no transfer error, has no active transfer, and has no pending upload
- **THEN** the interface labels the installation `Synced`

#### Scenario: Upload path fails while the client is otherwise active
- **WHEN** the task upload API is unavailable but the application and synchronization stream remain active and the upload failure survives the confirmation interval
- **THEN** the client retains the queued mutation, reports the upload failure separately from its general connection state, and opens one content-free upload-error episode using the time the failure was first observed

#### Scenario: Persist another confirmed degradation
- **WHEN** the connected Tasks runtime reports a download error or an offline state that survives the confirmation interval
- **THEN** the installation opens at most one content-free episode for that degradation category using the time it was first observed, without storing a raw error, owner identifier, record identifier, task content, or source metadata

#### Scenario: Ignore a transient synchronization blip
- **WHEN** an upload error, download error, or offline state clears or changes before the confirmation interval ends
- **THEN** the interface reflects the current live state immediately but does not persist a degradation or recovery episode for the transient state

#### Scenario: Report persistent production degradation once
- **WHEN** one confirmed upload-error, download-error, or offline episode remains active for at least 2 minutes from its first observation in the production Tasks runtime
- **THEN** the client sends Sentry one fixed content-free warning with allowlisted category and bounded state tags and records that the episode was reported

#### Scenario: Recover synchronization
- **WHEN** a confirmed explicit degradation clears or changes category
- **THEN** the client closes the prior episode with a resolution time, retains it in bounded local history, and does not report that episode again

#### Scenario: Reload during an active episode
- **WHEN** Tasks reloads while a content-free confirmed degradation episode remains open
- **THEN** the runtime resumes the same episode and its remaining report delay instead of creating or reporting a duplicate

#### Scenario: Inspect local-only storage
- **WHEN** the module has no approved synchronization endpoint
- **THEN** synchronization details identify the installation as local-only, create no remote-degradation episode, and explicitly withhold any implication of cross-device or MCP convergence

### Requirement: Recoverable History
The system SHALL provide append-only history, a projection-safe guarded 100-step task undo and redo cursor, mutation receipts, a recoverable Done queue, versioned export, verified restore, and automatic terminal-data expiry.

#### Scenario: Reserve a forward mutation before visual departure
- **WHEN** a user changes any editable task field or state and asynchronous persistence or an exit animation begins
- **THEN** Tasks reserves that exact forward mutation before the changed task can visually depart and binds the reservation to the accepted client mutation identifier

#### Scenario: Undo completion while its write is in flight
- **WHEN** a user completes a task and invokes Command+Z after the task begins leaving its source list but before the completion write returns
- **THEN** Tasks waits for that reserved completion to settle and undoes its exact accepted history event without traversing an older mutation

#### Scenario: Undo completion while history is projecting
- **WHEN** the completion write has returned but its exact history event or completed task snapshot has not yet projected locally
- **THEN** Tasks waits within a bounded interval for both projections and reopens the task into its retained prior planning state

#### Scenario: Match equivalent synchronized terminal timestamps
- **WHEN** a local task projection and its authoritative history snapshot encode the same completion, cancellation, or deletion instant with different valid ISO time-zone spellings
- **THEN** Tasks treats those terminal timestamps as equal for guarded undo while continuing to reject malformed values and genuinely different instants

#### Scenario: Cancel a failed reservation
- **WHEN** a reserved forward mutation fails before acceptance
- **THEN** Tasks cancels that reservation, restores the visible task state, and does not let a later undo substitute an older or unrelated history event for the failed mutation

#### Scenario: Include every editable task mutation
- **WHEN** a user changes any task field or state that Tasks permits them to edit, including title, notes, link, planning, organization, actionability, Deadline, completion, cancellation, deletion, reopening, or restoration
- **THEN** the accepted mutation participates in the same guarded undo and redo chain

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for the latest supported forward task mutation after its task and history projections agree
- **THEN** the system restores the source event's prior state and synchronizes the restoration as a new valid undo mutation

#### Scenario: Undo a deep sequence
- **WHEN** the authoritative projected history contains a safe contiguous chain of supported task mutations
- **THEN** repeated Command+Z or Control+Z on Mac, or Control+Z on Windows, can walk backward through as many as 100 source mutations in reverse chronological order

#### Scenario: Redo an undone sequence
- **WHEN** one or more task mutations have been undone and no new forward mutation has invalidated redo
- **THEN** Command+Y on Mac or Control+Y on Windows reapplies the next source event's after-state as a new valid redo mutation

#### Scenario: Redo an undone completion
- **WHEN** a user undoes a completion and then invokes redo without an intervening forward mutation
- **THEN** Tasks reapplies the exact completion event and returns the task to Done

#### Scenario: Invoke redo with either standard chord
- **WHEN** a user presses Command+Y or Command+Shift+Z on Mac, or Control+Y or Control+Shift+Z on Windows
- **THEN** Tasks captures the command before the browser or an editable field and traverses the same redo cursor

#### Scenario: Reach an unavailable history boundary
- **WHEN** undo or redo has no cursor entry, or its next historical state can no longer satisfy current task invariants
- **THEN** Tasks performs no mutation and shows an ordinary Nothing to Undo or Nothing to Redo toast without destructive styling

#### Scenario: Reconstruct task history after refresh
- **WHEN** the Tasks client starts or receives projected history rows in any arrival order
- **THEN** it reconstructs the bounded undo and redo cursor from the complete available forward, undo, and redo sequence without treating inverse events as new forward steps

#### Scenario: Wait for matching projections
- **WHEN** the cursor-tip event and its current task snapshot do not yet represent the required exact undo or redo pair
- **THEN** the client withholds that history movement until synchronization makes the pair safe and does not skip to an older event

#### Scenario: Retain an immediate history command during projection lag
- **WHEN** the user invokes undo or redo immediately after a successful local task mutation whose matching history event has not projected yet
- **THEN** Tasks retains that command for the exact client mutation, withholds older history, and performs the guarded movement as soon as the matching task and history projections agree

#### Scenario: Keep retained history commands bounded
- **WHEN** the exact requested mutation does not become safely traversable within the bounded projection-wait interval
- **THEN** Tasks performs no inverse, does not apply the command to a later unrelated mutation, and preserves the authoritative history cursor

#### Scenario: Invalidate redo after a new change
- **WHEN** a user makes a new supported forward task mutation after undoing one or more events
- **THEN** the client clears the redo path and retains the new mutation in the bounded undo path

#### Scenario: Keep undo and redo out of persistent header chrome
- **WHEN** the Tasks planning header renders
- **THEN** it does not expose visible Undo, Redo, or selection-mode buttons and leaves these interactions discoverable through Keyboard Commands

#### Scenario: Own history inside task fields
- **WHEN** focus is in an editable task field and the user invokes a documented Tasks undo or redo command outside active composition
- **THEN** Tasks invokes authoritative app-level history rather than the field's isolated native history so autosaved changes remain consistent across tasks
#### Scenario: Withhold unavailable or unsafe history movement
- **WHEN** no corresponding authoritative source event is projected, an inverse is pending, or current task state no longer matches the required source snapshot
- **THEN** the web interface does not submit a duplicate or speculative undo or redo mutation

#### Scenario: Reject an unsafe inverse
- **WHEN** intervening changes make an undo or redo snapshot pairing unsafe
- **THEN** the system rejects the inverse without overwriting current data and returns a conflict receipt

#### Scenario: Return a mutation receipt
- **WHEN** the system accepts, rejects, or treats a task mutation as a no-op
- **THEN** it returns a content-free receipt with the client mutation identifier, actor, channel, affected stable identifiers, revisions, transition, timestamp, outcome, and applicable code

#### Scenario: Restore deleted work
- **WHEN** a user restores a recoverably deleted item
- **THEN** the system restores the item and its supported descendants to their prior lifecycle, planning, parent, and order values when those destinations remain valid

#### Scenario: Restore work whose container no longer exists
- **WHEN** a recoverably deleted root cannot return to its prior container
- **THEN** the system restores the hierarchy to Anytime and reports the fallback in the mutation receipt

#### Scenario: Export task data
- **WHEN** a user requests an export
- **THEN** the system produces a versioned checksummed JSON envelope containing active and retained Done data without credentials or delivery tokens

#### Scenario: Preview a restore
- **WHEN** a user supplies an export for dry-run restore
- **THEN** the system validates checksums and schema compatibility and reports planned inserts, matches, and conflicts without writing task data

#### Scenario: Merge a restore
- **WHEN** a user restores an export into existing data
- **THEN** the system assigns records to the authenticated owner, matches by stable identifier, remains idempotent on retry, and reports conflicts without overwriting newer records

#### Scenario: Recover after complete source loss
- **WHEN** the source account and its server rows no longer exist and the user merges a verified current backup under another authenticated owner
- **THEN** every portable collection is rebound to that owner atomically, including append-only history and recoverably deleted work, while excluded credentials and delivery diagnostics remain absent

#### Scenario: Replay an exact current backup
- **WHEN** the user retries a current-schema backup after its complete merge already succeeded
- **THEN** every collection is reported as an exact match, no row is rewritten or duplicated, and legacy compatibility conversion does not create a false conflict

#### Scenario: Reject backup tampering
- **WHEN** exported content no longer matches its manifest checksum
- **THEN** preview and merge reject the envelope before any task data is written

#### Scenario: Replace data from a restore
- **WHEN** a user explicitly selects replace restore
- **THEN** the system limits replacement to the complete current export schema, returns a checksum-verified pre-restore server backup, requires that backup to be downloaded plus a separate exact confirmation, and atomically replaces task data only while the server snapshot still matches the downloaded backup digest

#### Scenario: Prepare replacement without blocking task writes globally
- **WHEN** an authenticated user validates an incoming replacement and requests the current pre-restore backup
- **THEN** preparation reads one transaction-consistent snapshot without taking a table-wide task write lock, while confirmed replacement retains the atomic lock and stale-backup check

#### Scenario: Reject a stale replacement backup
- **WHEN** synchronized task data changes after the pre-restore backup is prepared and before replacement executes
- **THEN** the server rejects the stale backup digest without deleting or restoring any task record and requires a fresh preparation

#### Scenario: Recover from replacement failure
- **WHEN** a validated replacement envelope cannot be restored because of a stable-identifier collision or another transactional failure
- **THEN** the complete deletion and restore transaction rolls back, the prior owner task graph remains visible, and an exact ambiguous-response retry either resumes safely or returns the original content-free receipt

#### Scenario: Preserve delivery registration during replacement
- **WHEN** task data is replaced
- **THEN** the system removes task-specific reminder delivery diagnostics while retaining excluded browser delivery targets and credentials so the current device does not become silently unregistered

#### Scenario: Recover work from Done
- **WHEN** a user restores deleted work or reopens completed or canceled work before its purge boundary
- **THEN** the system returns the work to a valid active state and removes it from Done

#### Scenario: Reopen a completed task by unchecking it
- **WHEN** Done presents a completed present task
- **THEN** its leading control is a checked task checkbox, and activating that control reopens the task and returns it to its retained prior planning state

#### Scenario: Reopen a canceled task
- **WHEN** Done presents a canceled present task
- **THEN** its leading control communicates cancellation and activating it reopens the task through the same guarded lifecycle path

#### Scenario: Restore a deleted task from its trash control
- **WHEN** Done presents a recoverably deleted task root
- **THEN** its leading icon-only control persistently shows a restore icon and restores the task through the existing hierarchy-safe restore transition when activated

#### Scenario: Preserve task-row interaction in Done
- **WHEN** a retained task appears in Done
- **THEN** its title, source link, terminal date, whole-task focus, selection behavior, and direct recovery control remain operable without exposing permanent deletion

#### Scenario: Preserve the terminal timestamp
- **WHEN** a task is completed, canceled, or deleted
- **THEN** its completion, cancellation, or deletion timestamp remains the Done ordering and 31-day retention timestamp until the task is recovered or purged

#### Scenario: Retain work for 30 full local days
- **WHEN** work enters Done on an owner's local calendar date
- **THEN** the system retains it throughout that date and the following 30 local midnights

#### Scenario: Purge at the start of the 31st day
- **WHEN** the owner's planning time zone reaches midnight beginning the 31st calendar day after work entered Done
- **THEN** the server permanently erases the terminal content graph within one minute and the deletion converges to connected and later-reconnected clients

#### Scenario: Preserve safety receipts after purge
- **WHEN** purged work originated from idempotent capture, a template, recurrence, or a hierarchy operation
- **THEN** the system retains only content-free receipts required to prevent duplicate recreation and removes personal task content, sources, reminders, and terminal history not required for that safety

#### Scenario: Read an older export
- **WHEN** a user previews a supported older export containing Inbox, Today, daytime, evening, Logbook, or Trash state
- **THEN** the system deterministically normalizes it to Anytime, Today membership, and Done before reporting inserts, matches, and conflicts

#### Scenario: Replace from a verified backup
- **WHEN** a user confirms replacement from a compatible verified export
- **THEN** the system creates a pre-restore backup, replaces the synchronized task graph atomically, and preserves the authenticated owner boundary

### Requirement: Layered Reminder Delivery
The system SHALL keep the server authoritative for reminder scheduling and logical delivery identity while supporting Web Push, in-app delivery, and later native delivery targets through one idempotent contract.

#### Scenario: Schedule reminder delivery
- **WHEN** a reminder instant is accepted
- **THEN** the server creates one stable logical delivery occurrence and targets each registered delivery endpoint idempotently

#### Scenario: Recover an in-app reminder claim automatically
- **WHEN** an open connected client cannot claim due reminder deliveries
- **THEN** the interface preserves scheduled reminders and previously claimed items, presents no task-list warning or manual retry action, and performs the next automatic claim within one minute or when the tab next becomes visible

#### Scenario: Bound a stalled in-app reminder claim
- **WHEN** a connected client's due-reminder claim does not settle within the configured request window
- **THEN** the client aborts the request, releases its in-flight guard, preserves reminder state, and remains eligible for the next automatic claim

#### Scenario: Inspect current in-app reminder availability
- **WHEN** a user opens Synchronization Details from Tasks Config
- **THEN** the interface reports In-App Reminders as Available when the latest claim did not fail and Delayed while the latest claim failure remains unresolved, without exposing provider or transport diagnostics

#### Scenario: Report a reminder acknowledgement failure
- **WHEN** a visible or notification-opened reminder cannot be acknowledged
- **THEN** the interface reports fixed content-free failure copy, preserves the reminder for retry, and does not expose the underlying provider or transport error

#### Scenario: Read synchronized reminder time precision
- **WHEN** synchronization represents a canonical PostgreSQL reminder time with fractional-second precision
- **THEN** the client accepts it as the original wall-clock intent, renders the Tasks route, and does not reject the reminder projection

#### Scenario: Retry one delivery target
- **WHEN** a provider request is retried for the same occurrence and registered target
- **THEN** the system reuses the target-delivery identifier and does not create another logical delivery

#### Scenario: Open multiple browser tabs
- **WHEN** multiple tabs observe the same due reminder
- **THEN** the tabs share the logical occurrence and do not create duplicate server delivery records

#### Scenario: Deliver on multiple registered devices
- **WHEN** an owner has multiple explicitly registered delivery targets
- **THEN** each target may receive the same logical occurrence once under its own target-delivery identifier

#### Scenario: Delivery capability is unavailable
- **WHEN** notification permission is denied, platform support is missing, or a target expires
- **THEN** the task remains usable and the interface reports degraded reminder capability

#### Scenario: Register Web Push explicitly
- **WHEN** a user invokes the browser-reminder Enable action on a supported secure client and grants notification permission
- **THEN** the client reuses the Tasks service-worker registration to create one standards-based push subscription, the server stores its provider credentials outside the synchronized target projection, and repeated registration reuses the target identity

#### Scenario: Transfer one browser subscription between accounts
- **WHEN** a browser endpoint is registered by a different signed-in owner on the same installation
- **THEN** the server cancels pending delivery for the prior owner, removes the prior provider credential, marks the prior target revoked, and assigns that endpoint only to the current owner

#### Scenario: Invalidate browser delivery on sign-out
- **WHEN** a signed-in owner signs out from Tasks or another BathOS route on an installation with a browser subscription
- **THEN** the installation unsubscribes before completing sign-out, and the Tasks route also revokes the owner-scoped server target when that authenticated operation is available

#### Scenario: Inspect Web Push without implicit subscription
- **WHEN** a connected user opens Tasks before enabling browser reminders
- **THEN** the client may register or inspect the shared Tasks service worker for offline launch but does not request notification permission, create a push subscription, or register a delivery target until the user invokes Enable

#### Scenario: Keep browser reminder failures content-free
- **WHEN** browser-reminder inspection, registration, or revocation fails
- **THEN** the interface reports fixed degraded capability and operation-failure copy, does not expose the underlying provider or transport error, keeps in-app reminders available, and permits an explicit retry when safe

#### Scenario: Report delivery outcome
- **WHEN** a notification provider accepts a delivery request
- **THEN** the system records provider acceptance separately from user acknowledgement and does not claim that the user saw the reminder

#### Scenario: Fail to record a provider outcome
- **WHEN** the dispatcher cannot persist the provider-accepted or failed outcome after attempting delivery
- **THEN** the invocation reports failure with content-free diagnostics and does not report a fully successful run

#### Scenario: Reject an untrusted Web Push endpoint
- **WHEN** a claimed Web Push subscription endpoint is not an HTTPS endpoint owned by an approved browser push provider
- **THEN** the dispatcher makes no network request, records a content-free terminal failure, and revokes the target so it is not retried

#### Scenario: Prepare production Web Push configuration
- **WHEN** reminder delivery is activated in a production environment
- **THEN** the server and web build use one verified public VAPID key, the server keeps the matching private key and an independent high-entropy dispatch secret outside the repository, and the scheduled request resolves its matching header value from managed secrets without embedding it in the Cron command

#### Scenario: Acknowledge an opened notification
- **WHEN** the user opens a Web Push notification for a logical occurrence
- **THEN** the authenticated Tasks route acknowledges that occurrence and later in-app or provider claims do not create another delivery after acknowledgement

#### Scenario: Open a reminder without replacing unrelated BathOS work
- **WHEN** a user opens a Web Push notification while browser windows include another BathOS module, an existing Tasks route, or no Tasks route
- **THEN** the service worker accepts only a same-origin Tasks destination, reuses and focuses an existing Tasks client when available, otherwise opens a new Tasks window, and never navigates the unrelated BathOS module away from its current route

#### Scenario: Activate a published reminder worker promptly
- **WHEN** a backward-compatible Tasks reminder and offline-shell service worker update installs while BathOS tabs remain open
- **THEN** the worker requests immediate activation so future offline launch, push, and notification-click events use the published behavior without requiring every existing BathOS tab to close

### Requirement: Evidence-Gated Native Apple Expansion
The system SHALL treat native Apple surfaces as optional extensions of the shared task domain and SHALL add only a specific surface whose observed or explicitly approved workflow gap cannot be served adequately by the installed web app.

#### Scenario: Continue without an unneeded native surface
- **WHEN** the installed web app, Web Push, and Raycast adequately support an observed daily workflow
- **THEN** the system continues without creating a native implementation for that workflow

#### Scenario: Diagnose a reminder incident before adding native push
- **WHEN** a production reminder is missed, duplicated, or materially late
- **THEN** the evaluation first verifies schedule computation, permission, target registration, provider outcome, and device state, and approves a native push target only when the remaining failure is a browser delivery limitation

#### Scenario: Approve a configurable task-list widget
- **WHEN** the user explicitly identifies configurable iOS Home Screen task-list widgets as a recurring native-only need
- **THEN** the system permits the smallest native host and WidgetKit extension that display owner-scoped projections of the existing Today, Upcoming, Anytime, Someday, and Done lists

#### Scenario: House the existing task product
- **WHEN** the approved task-list widget requires a containing iOS app
- **THEN** the app houses the existing Tasks web UI and does not recreate ordinary task management as a second native product

#### Scenario: Avoid a second task product
- **WHEN** a native surface reads or mutates task data
- **THEN** it uses the authoritative task-domain contract and does not introduce an independent task database, reminder scheduler, or generic mutation API

#### Scenario: Keep later Apple surfaces evidence-gated
- **WHEN** a later control, App Intent, notification target, distribution path, native editor, or Apple Watch complication is proposed
- **THEN** that surface remains outside the approved widget scope until its workflow, data, privacy, refresh, and interaction contract is explicitly approved

### Requirement: Cross-Platform Task Interaction Reference
The system SHALL present a visible interaction reference that documents the complete supported Tasks keyboard and pointer-selection contract for both Mac and Windows using compact, platform-recognizable key notation without plus signs between modifiers and keys.

#### Scenario: Compare platform commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the interface shows Action, Mac, and Windows columns simultaneously and identifies the current platform when the runtime can detect it

#### Scenario: Show compact key notation
- **WHEN** the interaction reference renders a modifier, key, directional arrow, or pointer gesture
- **THEN** it concatenates the corresponding symbols and capitalized key or gesture name directly without inserting a plus sign, and renders the chord in the regular interface typeface at the table's normal text size

#### Scenario: Separate alternate chords consistently
- **WHEN** one keyboard-reference row presents more than one supported chord for Undo, Redo, or Close Open Task
- **THEN** it separates the complete chords with `/` rather than the word `or`

#### Scenario: Focus the command reference without decorating the container
- **WHEN** Keyboard Commands opens or its non-interactive dialog container receives focus
- **THEN** the container does not display an outline, focus ring, or focus shadow, while interactive descendants retain their ordinary focus indicators

#### Scenario: Open Keyboard Commands by shortcut
- **WHEN** the user presses Command+/ on Mac or Control+/ on Windows outside active composition while Tasks is mounted
- **THEN** Tasks suppresses the matching browser action and opens Keyboard Commands even when a task text field is active

#### Scenario: Keep help discoverable on Config
- **WHEN** the user views Config
- **THEN** the interface presents a visible platform-aware cue that the slash chord opens the list of all keyboard commands

#### Scenario: Omit the persistent header trigger
- **WHEN** the Tasks persistent header renders
- **THEN** it does not contain a Keyboard Commands question-mark button

#### Scenario: Keep obsolete help aliases unbound
- **WHEN** the user presses bare `/`, bare `?`, Command+Shift+/, or an undocumented historical help chord
- **THEN** Tasks does not open Keyboard Commands or claim that chord

#### Scenario: Preserve commands outside supported contexts
- **WHEN** a chord is not documented for the active platform and context, an active composition owns input, or the browser or operating system consumes an event before it reaches Tasks
- **THEN** the reference does not imply that Tasks overrides that native or unavailable behavior

### Requirement: Task Modal Footer Discipline
Tasks dialogs SHALL render a footer only when the footer contains meaningful actions or information. A Tasks dialog with only a header and body SHALL omit redundant Escape guidance, the empty footer track, the footer chin, and the body’s bottom divider.

#### Scenario: Present a footerless informational or command dialog
- **WHEN** a Tasks dialog contains no footer actions or footer information
- **THEN** the dialog contains only its header and body, and the body reaches the rounded bottom edge without an empty chin or bottom divider

#### Scenario: Omit redundant Escape guidance
- **WHEN** any Tasks modal is rendered
- **THEN** it does not display “Escape Closes” or equivalent visible guidance

#### Scenario: Preserve a meaningful footer
- **WHEN** a Tasks modal provides Save, Cancel, Close, confirmation, or another explicit footer action
- **THEN** that action-bearing footer remains visible and operable

### Requirement: Canonical Tasks Language
The Tasks module SHALL use Tasks as the canonical noun for task records, Summary as the canonical user-facing name for the primary task text field, Ready as the canonical user-facing name for the stored `actionable` state, Deadline for the due-date concept, and Start for the task-start concept throughout user-facing interface copy and command references.

#### Scenario: Present task terminology
- **WHEN** the interface generically names task records, selections, commands, or actions
- **THEN** it uses Task or Tasks rather than To-do, Todo, or To-dos except where external source material must be quoted verbatim

#### Scenario: Present task metadata terminology
- **WHEN** the interface names the task's primary text field or the stored `actionable` actionability state
- **THEN** it respectively uses Summary or Ready without changing the persisted `title` field or `actionable` enum value

#### Scenario: Present planning terminology
- **WHEN** the interface names temporal task metadata
- **THEN** it uses Deadline rather than Due Date and Start rather than Start Date or Task's Start

### Requirement: Task Row Keyboard Reordering Is Deferred
The Tasks module SHALL NOT advertise or execute a dedicated task-row keyboard-reordering command until a later interaction contract explicitly introduces one.

#### Scenario: Leave former keyboard reorder chords unclaimed
- **WHEN** focus is on a task Summary and the user presses Option plus an arrow key on Mac or Alt plus an arrow key on Windows
- **THEN** Tasks does not reorder the task or advertise that chord as a task-row shortcut

#### Scenario: Preserve pointer drag reordering
- **WHEN** the current list supports pointer drag reordering
- **THEN** removing keyboard reordering does not remove or alter the existing pointer drag behavior

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

### Requirement: Contextual Task Creation Affordances
The Tasks module SHALL expose pointer and touch creation affordances on active planning lists and SHALL place each resulting draft at the top of the planning context from which creation was invoked.

#### Scenario: Present the primary floating creation action
- **WHEN** a user views Today, Upcoming, Anytime, or Someday outside bulk selection mode
- **THEN** Tasks presents one compact circular New Task button fixed near the bottom-right edge of the bounded Tasks list with a slightly translucent solid-green surface, backdrop blur where supported, a thin opaque green border, and a persistent white Plus, clear of mobile navigation and safe-area insets, and does not present the former New Task action in the view header

#### Scenario: Create in the first Today bucket
- **WHEN** a user invokes the floating action from Today
- **THEN** Tasks opens a blank draft at the top of the first visible Inbox, Now, Next, or Later task bucket and assigns that horizon, falling back to Today Now when no Today task bucket is visible

#### Scenario: Create in the first Upcoming bucket
- **WHEN** a user invokes the floating action from Upcoming
- **THEN** Tasks opens a blank draft at the top of the first visible Upcoming task bucket and assigns that bucket's canonical Start, falling back to tomorrow when Upcoming has no visible bucket

#### Scenario: Create in an ungrouped planning list
- **WHEN** a user invokes the floating action from Anytime or Someday
- **THEN** Tasks opens a blank draft at the top of the Tasks section with the ordinary Anytime or Someday destination

#### Scenario: Create from a Today bucket heading
- **WHEN** a user clicks an Inbox, Now, Next, or Later task-bucket heading
- **THEN** Tasks opens a blank draft at the top of that bucket and assigns the represented Today horizon

#### Scenario: Create from an Upcoming bucket heading
- **WHEN** a user clicks a day, month, or year task-bucket heading in Upcoming
- **THEN** Tasks opens a blank draft at the top of that bucket and assigns the section's canonical day, first day of month, or first day of year as Start

#### Scenario: Present a quiet bucket creation target
- **WHEN** a creatable bucket heading is presented
- **THEN** the heading uses a pointer cursor and the complete heading control remains the activation target without displaying an Add Task Plus icon

#### Scenario: Keep pointer and keyboard creation contracts distinct
- **WHEN** the established keyboard new-task command is invoked
- **THEN** Tasks preserves its existing view defaults and single-draft behavior rather than requiring a visible pointer bucket

### Requirement: Uniform Task List Bottom Clearance
The Tasks module SHALL reserve one consistent responsive bottom clearance across every Tasks view and selection state so fixed lower-viewport controls cannot cover the final task when the user reaches the end of a list.

#### Scenario: Preserve clearance outside selection mode
- **WHEN** a user scrolls to the end of any Tasks view without bulk selection active
- **THEN** the final list content can move completely above the floating creation control, mobile navigation, and safe-area boundary

#### Scenario: Preserve the same clearance during selection mode
- **WHEN** bulk selection activates or deactivates
- **THEN** the Tasks view retains the same responsive bottom clearance while the floating selection toolbar appears or disappears

### Requirement: Continuous Task Editor Disclosure
The Tasks module SHALL reveal and conceal an expanded task editor as one continuous disclosure without a secondary spacing expansion while preserving ordinary layout space between the summary row and the first visible metadata field.

#### Scenario: Open an editor as one fluid motion
- **WHEN** a user opens a task and reduced motion is not requested
- **THEN** the editor row, opacity, and ordinary Title inset expand concurrently through one shared transition without a delayed or separately visible spacing step

#### Scenario: Keep the expanded editor compact
- **WHEN** a task editor is fully expanded
- **THEN** its title input begins after six pixels of ordinary top padding while the form retains its established horizontal inset, bottom padding, and 12-pixel spacing between visible fields

#### Scenario: Preserve the Title focus ring
- **WHEN** the Title input receives focus in an expanded task editor
- **THEN** its complete focus ring paints inside the disclosure's reserved layout space without being clipped by an inner overflow boundary

#### Scenario: Ignore nonvisual labels in field spacing
- **WHEN** an accessible label is visually hidden before the title input
- **THEN** that label does not introduce layout space beyond the explicit fixed Title inset

#### Scenario: Preserve reduced-motion behavior
- **WHEN** the operating system requests reduced motion
- **THEN** the editor appears or disappears without a disclosure transition while retaining the same ordinary Title inset and complete focus ring

### Requirement: Expanded Task Editor State Coherence
The Tasks expanded editor SHALL reflect accepted changes to its current task while preserving nested editor-owned controls as independent interaction layers.

#### Scenario: Reflect a keyboard actionability mutation
- **WHEN** Control+F on Mac or Alt+Shift+F on Windows changes the actionability of the currently open task
- **THEN** the open task remains expanded and its Actionability dropdown shows the newly accepted status

#### Scenario: Dismiss an editor-owned select
- **WHEN** a pointer interaction dismisses the open Actionability or Organization popover, including activation of its label or trigger
- **THEN** only that nested popover closes and the containing task editor remains open

#### Scenario: Close after the nested select is gone
- **WHEN** no editor-owned select is open and a later pointer interaction begins outside the task and its editor-owned surfaces
- **THEN** Tasks follows the ordinary outside-close path for the expanded editor

#### Scenario: Retain an open task's list projection
- **WHEN** autosaved planning or organization metadata would remove or regroup the currently open task
- **THEN** Tasks keeps that row at its original visible position and group with the latest editable values until the editor closes, briefly retains it in place after closure, then applies current view membership exactly once and animates an on-page position change with calm motion when allowed

#### Scenario: Settle a completed task before removal
- **WHEN** a keyboard command or pointer action completes a task in an active list
- **THEN** Tasks immediately reflects completion intent, briefly retains the task in place, and then animates its removal

#### Scenario: Reduce task transition motion
- **WHEN** the user requests reduced motion
- **THEN** Tasks skips decorative task settling and movement delays without delaying the accepted mutation

#### Scenario: Edit repeated planning values before closure
- **WHEN** a user changes Start, Day Horizon, Deadline, or Organization multiple times while the task remains open
- **THEN** every accepted change autosaves in order without unmounting or moving the editor, and the final accepted state controls projection after closure

#### Scenario: Reduce editor disclosure motion
- **WHEN** the operating system requests reduced motion
- **THEN** Tasks opens, closes, and reveals the editor without a visible expansion transition or smooth scrolling

#### Scenario: Defer open task completion
- **WHEN** a user activates the completion control while its task editor is open
- **THEN** the control toggles a visible pending completion state and the task remains open and absent from Done

#### Scenario: Commit deferred completion on close
- **WHEN** an editor with pending completion closes, navigates to another to-do, or leaves its view
- **THEN** Tasks flushes its pending autosave and transitions that to-do to Done exactly once after the editing session ends

#### Scenario: Complete a closed task immediately
- **WHEN** a user activates the completion control for a task whose editor is closed
- **THEN** Tasks immediately transitions that task to Done and applies the documented focus fallback

#### Scenario: Close and restore whole-task focus
- **WHEN** the user invokes the platform's Tasks-specific Open/Close Task command while a task is open
- **THEN** Tasks closes the editor, commits any pending completion, and returns focus to the complete task row
#### Scenario: Preserve other native input behavior
- **WHEN** focus is in an input, textarea, select, content-editable surface, menu, or dialog and the key chord is not a documented Tasks command
- **THEN** native typing, composition, selection, Tab traversal, and control behavior remain available

#### Scenario: Traverse every collapsed-task control
- **WHEN** a keyboard user presses Tab or Shift+Tab in or around a collapsed task summary
- **THEN** native sequential focus visits the task row and its available completion, title, source-link, and actions controls in DOM order and can continue to controls outside the task list

#### Scenario: Leave whole-task focus for granular Tab traversal
- **WHEN** Tab or Shift+Tab is pressed while one closed task has whole-task focus
- **THEN** Tasks clears whole-task focus and its range anchor without blurring the current element or preventing native sequential focus movement

#### Scenario: Relinquish collapsed task focus with Escape
- **WHEN** Escape is pressed while a collapsed task row or one of its granular row controls has keyboard focus and no nested surface owns Escape
- **THEN** Tasks clears whole-task focus and its range anchor, blurs the row-owned active element, and performs no task mutation

#### Scenario: Enter whole-task focus from the Tasks background
- **WHEN** no task is focused, open, or multiply selected; no nested surface is open; an eligible noninteractive Tasks page or list surface owns focus; and the user presses a nonrepeated unmodified Space
- **THEN** Tasks prevents page scrolling, gives whole-task focus to the first visible task, scrolls it into view, and does not open it

#### Scenario: Promote a Tab-focused task row
- **WHEN** a closed task row has granular Tab focus without whole-task focus and the user presses a nonrepeated unmodified Space
- **THEN** Tasks prevents page scrolling, promotes that same row into whole-task focus, establishes the range anchor, and does not open or advance the task

#### Scenario: Traverse whole-task focus with Space or arrows
- **WHEN** a closed task has whole-task focus and the user presses nonrepeated Space, Shift+Space, ArrowDown, or ArrowUp
- **THEN** Tasks moves whole-task focus forward or backward through visible tasks, wraps across list boundaries, scrolls the destination into view, and does not open or reorder a task

#### Scenario: Ignore held Space traversal
- **WHEN** Space or Shift+Space keydown repeats while a task has whole-task focus
- **THEN** Tasks prevents page scrolling but performs no additional focus movement

#### Scenario: Preserve native Space ownership
- **WHEN** Space is pressed while an interactive task control, link, editable control, open task, multiple selection, dialog, menu, listbox, popover, or unrelated page control owns the interaction
- **THEN** Tasks does not invoke whole-task Space traversal and preserves that surface's native or documented Space behavior

#### Scenario: Restore action focus to the whole task
- **WHEN** a task completion, lifecycle, or task-owned dialog action invoked outside the ellipsis menu returns keyboard focus to a collapsed task that remains in the current list or to its same-position fallback
- **THEN** Tasks establishes whole-task focus on the complete task row and does not leave focus on a nested completion, title, source-link, or actions control

#### Scenario: Traverse an expanded task editor
- **WHEN** a keyboard user advances or reverses focus through an expanded task editor
- **THEN** every available editor control receives visible focus in documented order and unavailable controls are skipped

#### Scenario: Announce task controls and command surfaces
- **WHEN** assistive technology inspects the task surface, an expanded editor, or a command dialog
- **THEN** every interactive control has a nonempty programmatic name, stateful controls expose their current state, and each dialog has a programmatic title without a dangling description reference

#### Scenario: Keep task header controls inside a narrow mobile viewport
- **WHEN** a task planning view is rendered at 390 CSS pixels wide
- **THEN** the view title and header actions remain fully inside the document viewport without horizontal page overflow, while compact icon-only links retain nonempty programmatic names

#### Scenario: Respect reduced-motion preference
- **WHEN** the operating system requests reduced motion while the Tasks route is mounted
- **THEN** task-page and portal animations, transitions, delays, and smooth scrolling are reduced without changing the motion policy of unrelated BathOS routes

#### Scenario: Open global quick entry on Mac
- **WHEN** the user invokes the configured Raycast task-entry hotkey
- **THEN** Raycast presents required title and optional notes inputs without requiring the BathOS browser tab to be focused

#### Scenario: Capture from Raycast
- **WHEN** the user submits a nonempty title through Raycast quick entry
- **THEN** the authenticated task service creates exactly one undated Anytime to-do with Today Later horizon and `raycast` entry provenance, then returns an accepted or already-applied receipt

#### Scenario: Authorize Raycast safely
- **WHEN** the Raycast command has no usable delegated credential
- **THEN** it performs browser-based Authorization Code with S256 PKCE and retains the rotating refresh credential in the macOS login Keychain without storing a BathOS password, browser session, service-role credential, or client secret

#### Scenario: Retry a capture safely
- **WHEN** delivery of a submitted Raycast capture is retried after an ambiguous response
- **THEN** the command reuses that capture's creation UUID and the service does not create a duplicate to-do

#### Scenario: Capture the active browser page
- **WHEN** the user invokes page capture while Safari, Safari Technology Preview, Google Chrome, or Google Chrome Canary has a normal HTTP(S) active tab
- **THEN** the system creates one undated Anytime to-do with Today Later horizon, a cleaned deterministic title, `browser_capture` entry provenance, and a typed `webpage` source containing the exact accepted URL and optional browser title

#### Scenario: Reject unavailable browser context
- **WHEN** the frontmost application is unsupported, has no browser window, or exposes an invalid, blank, non-HTTP(S), or browser-owned URL
- **THEN** page capture explains that no supported page is available and does not submit a task mutation

#### Scenario: Present browser provenance structurally
- **WHEN** page capture creates a to-do
- **THEN** the title contains no required emoji or textual source prefix and the URL remains available through structured source fields and provisional notes

#### Scenario: Retry browser capture safely
- **WHEN** a page-capture response is ambiguous and the pending request is retried
- **THEN** the complete original title, notes, channel, typed source, and creation UUID are reused so the source fields are preserved and no duplicate to-do is created

#### Scenario: Capture one selected Finder item
- **WHEN** the user invokes Finder capture with exactly one file or folder selected
- **THEN** the system creates one undated Anytime to-do with Today Later horizon, `raycast` entry provenance, the selected item's name, and a typed `file` source whose local `file://` reference is treated as originating-Mac context rather than a portable cross-device identifier

#### Scenario: Reject an ambiguous Finder selection
- **WHEN** Finder has no selected item or more than one selected item
- **THEN** Finder capture explains that exactly one item is required and does not submit a task mutation

#### Scenario: Capture a reading item
- **WHEN** the user invokes reading-list capture on a supported normal browser page
- **THEN** the command uses the verified AI webpage-title workflow with its deterministic fallback and creates one unassigned undated Anytime to-do with Today Later horizon, `browser_capture` entry provenance, a typed `reading_item` source, and the source URL in notes

#### Scenario: Present reading provenance structurally
- **WHEN** reading-list capture creates a to-do
- **THEN** the title does not retain the legacy glasses prefix because reading provenance is authoritative in the typed source

#### Scenario: Preserve Mail source identity and lifecycle
- **WHEN** a future specialized Mail capture atomically creates a task and its Mail source record
- **THEN** the owner-scoped source record preserves the task relationship, account and mailbox identifiers, durable message identifier, `message://` deep link, retirement destination, explicit retirement lifecycle, revision, and mutation identifier without storing Mail content

#### Scenario: Create a processed Mail task
- **WHEN** authenticated Mail capture supplies AI-processed title and notes, complete source identity, retirement destination, and optional verified work-area assignment
- **THEN** the specialized service creates one unassigned or area-assigned undated Anytime task with Today Inbox horizon, an editable Primary Link initialized from the Mail deep link, and a retained source record in one transaction with no generic fallback write

#### Scenario: Retire a Mail source only after verified movement
- **WHEN** the integration begins retirement and then attempts the external Mail move
- **THEN** the source first enters `retirement_pending`, changes to `retired` only after verified success, or changes to `retirement_failed` with a bounded diagnostic that permits an explicit retry

#### Scenario: Audit Mail source retirement
- **WHEN** an accepted Mail source lifecycle mutation changes state
- **THEN** the system appends one immutable owner-scoped event with the request UUID, transition, base and result revisions, time, and optional failure code while rejecting direct authenticated state changes

#### Scenario: Reject an incomplete Mail source pair
- **WHEN** a Mail task lacks its one-to-one source record, a non-Mail task owns one, or the task and source disagree about message identity or deep link
- **THEN** the database rejects the transaction without leaving a partial task or source record

#### Scenario: Export and restore Mail source state
- **WHEN** the user exports and restores task data containing a Mail-sourced task
- **THEN** the versioned portable envelope preserves the owner-safe Mail source record and its complete append-only retirement event chain, validates that the current lifecycle and revision match the audit tip, rebinds restored ownership to the authenticated user, and excludes owner identifiers and Mail content

#### Scenario: Gate Mail capture on a complete integration contract
- **WHEN** parallel-use approval has not passed verification
- **THEN** Mail capture remains disabled and Inbox Manager does not dual-write to BathOS

#### Scenario: Preserve native editing behavior
- **WHEN** focus is inside an editable control and the key chord is not a documented task-level history, form, or Tasks-specific Control command
- **THEN** native typing, composition, selection, clipboard, Tab traversal, and control behavior remain available

#### Scenario: Preserve standard browser New and Find
- **WHEN** the user invokes Command+N or Command+F on Mac, or Control+N or Control+F on Windows
- **THEN** Tasks does not repurpose the chord for task creation or Find and leaves the standard browser behavior available

#### Scenario: Duplicate task content
- **WHEN** the user presses Command+D on Mac or Control+D on Windows with an open task or nonempty task selection and no editable text control owns native text input
- **THEN** Tasks duplicates every eligible target, closes the original open editor when applicable, opens the single duplicate when exactly one open task was targeted, and suppresses the browser bookmark command

#### Scenario: Preserve native clipboard editing
- **WHEN** an editable text control owns Command+X, Command+C, or Command+V on Mac, or Control+X, Control+C, or Control+V on Windows
- **THEN** Tasks preserves native text Cut, Copy, or Paste and does not invoke the task-object clipboard

#### Scenario: Open Deadline and cycle task metadata
- **WHEN** the user invokes Control+D, Control+F, or Control+V on Mac, or the corresponding Alt+Shift chord on Windows, with an eligible task target
- **THEN** Tasks respectively opens Deadline, cycles actionability, or cycles Area without changing unrelated task fields

#### Scenario: Invoke the checklist command before checklist editing exists
- **WHEN** the user invokes Control+C on Mac or Alt+Shift+C on Windows before the expanded task checklist editor exists
- **THEN** Tasks performs no mutation and the keyboard reference labels the command Edit Checklist without presenting implementation-status wording

#### Scenario: Keep Windows history separate from task commands
- **WHEN** a Windows user presses Control+Y, Control+Shift+Z, Alt+Shift+Z, or Alt+Shift+Q
- **THEN** Control+Y and Control+Shift+Z invoke Redo, Alt+Shift+Z invokes Undo, and Alt+Shift+Q opens or closes the task without one chord dispatching two actions

#### Scenario: Avoid promising an intercepted Windows system command
- **WHEN** the Windows operating system owns Control+Escape before the browser receives it
- **THEN** Tasks does not claim that Control+Escape can close a task and exposes Control+Return and Alt+Shift+Q as reliable close commands

### Requirement: Fixed Actionability Quick Filters
The Tasks module SHALL offer exactly four predefined actionability quick filters, SHALL keep All Tasks as the unfiltered default, and SHALL persist one owner-wide active choice across primary lists, sessions, and devices without introducing custom filters or generic labels.

#### Scenario: Start without a saved filter
- **WHEN** an owner has no saved Tasks quick-filter preference
- **THEN** Today, Upcoming, Anytime, Someday, and Done present all task rows allowed by their ordinary view membership

#### Scenario: Expose the fixed filter set
- **WHEN** a user opens Quick Filters from a primary Tasks list
- **THEN** the menu offers All Tasks, Only Ready, Only Not Ready, Only Rechecking, and Only Waiting and offers no custom, combined, or advanced filter controls

#### Scenario: Filter ready work
- **WHEN** Only Ready is active
- **THEN** each primary list presents only task rows whose structured actionability is `actionable`

#### Scenario: Filter work that is not ready
- **WHEN** Only Not Ready is active
- **THEN** each primary list presents only task rows whose structured actionability is Waiting or Rechecking

#### Scenario: Filter one non-actionable state
- **WHEN** Only Waiting or Only Rechecking is active
- **THEN** each primary list presents only task rows with that exact structured actionability

#### Scenario: Show and replace the active filter
- **WHEN** a predefined filter is active
- **THEN** its name appears in the list's top-right action row and the same control allows the user to select another filter or All Tasks

#### Scenario: Clear the active filter
- **WHEN** the user selects All Tasks
- **THEN** the current list immediately returns to its ordinary unfiltered task membership and the control returns to its inactive icon presentation

#### Scenario: Explain an empty filtered result
- **WHEN** the active quick filter matches no task rows in the current list
- **THEN** the interface presents a filter-specific no-matches message while keeping the active filter visible

#### Scenario: Reconcile selection after filtering
- **WHEN** a filter change removes a focused, open, or bulk-selected task from the visible projection
- **THEN** Tasks closes or clears incompatible task interaction state and restores focus through the established visible-list fallback order

#### Scenario: Apply one preference to every primary list
- **WHEN** the user changes between Today, Upcoming, Anytime, Someday, and Done
- **THEN** the same active quick filter remains applied until the user replaces or clears it

#### Scenario: Restore the preference in another session or device
- **WHEN** the owner opens Tasks in a later session or on another device
- **THEN** the most recent valid saved quick filter is restored and applied to every primary list

#### Scenario: Continue filtering during an offline launch
- **WHEN** a device has a valid cached quick-filter preference but cannot reach the server
- **THEN** Tasks applies the cached preference immediately and reconciles it after connectivity returns

#### Scenario: Reject an unknown saved value
- **WHEN** a cached or database preference does not match one of the five supported values
- **THEN** Tasks safely treats it as All Tasks

### Requirement: Global Task Quick Find
The system SHALL provide typing-only Quick Find as the primary Tasks search entry point across to-dos, SHALL omit visible Quick Find trigger controls from Tasks routes, and SHALL retain a live full task-results route for exhaustive continuation.

#### Scenario: Omit visible Quick Find controls
- **WHEN** a user visits a Tasks list, Config, or another Tasks route
- **THEN** the persistent header exposes no magnifying-glass or other clickable Quick Find trigger

#### Scenario: Open Quick Find by typing
- **WHEN** a user presses one nonrepeated printable character from an eligible non-editable Tasks surface without Command, Control, or Alt held
- **THEN** Tasks opens a compact centered Quick Find palette, places focus in its query input, and initializes the query with the exact typed character

#### Scenario: Permit shifted printable input
- **WHEN** Shift is the only modifier held while type-to-search receives a printable character
- **THEN** Quick Find opens with the resulting uppercase letter or shifted punctuation unchanged

#### Scenario: Preserve owned keyboard input
- **WHEN** a printable key belongs to an input, textarea, select, contenteditable region, active composition, dialog, menu, listbox, popover, or another nested interaction surface
- **THEN** Tasks leaves the key with that surface and does not open or reseed Quick Find

#### Scenario: Present compact results
- **WHEN** Quick Find has a nonblank query
- **THEN** the palette shows at most three matching to-dos without task checkboxes, row borders, a visible title, or a visible close control

#### Scenario: Include and distinguish Done results
- **WHEN** a Quick Find query matches a retained task from Done
- **THEN** Quick Find includes that task in its relevance-ranked compact results
- **AND** labels a deleted task `Deleted` and every other terminal task `Completed`

#### Scenario: Offer exhaustive results conditionally
- **WHEN** the full Search page would return at least one result for the current query
- **THEN** Quick Find shows `See All Results` after its compact results
- **WHEN** the full Search page would return no result
- **THEN** Quick Find omits `See All Results`

#### Scenario: Prioritize summary matches
- **WHEN** a query matches one to-do's Summary and only ancillary metadata such as Primary Link, Notes, source details, or Area on other to-dos
- **THEN** Quick Find ranks the Summary match ahead of every ancillary-metadata match regardless of lifecycle

#### Scenario: Distinguish a recurrence definition
- **WHEN** a Quick Find result represents the Upcoming recurrence definition rather than a materialized task instance
- **THEN** the result is prefixed by the established repeat icon

#### Scenario: Navigate preliminary selection
- **WHEN** the query input owns DOM and text-cursor focus and the user presses Up or Down
- **THEN** Quick Find keeps text focus in the input while moving one visible preliminary selection through the results and the conditional See All Results action

#### Scenario: Activate preliminary selection
- **WHEN** a preliminary selection is visible and the user presses Return
- **THEN** Quick Find activates that result or See All Results without requiring pointer input

#### Scenario: Close Quick Find with Escape
- **WHEN** Quick Find is visible and the user presses Escape
- **THEN** the surface closes without changing task data

#### Scenario: Consume an outside dismissal
- **WHEN** the user presses outside the Quick Find palette
- **THEN** Quick Find closes and the same pointer action does not activate the underlying Tasks interface

#### Scenario: Open a regular task result
- **WHEN** the user activates a non-recurrence-definition task result
- **THEN** Tasks navigates to the task's natural planning or history list, opens the task, and smoothly aligns its expanded summary row as close to the top of the visible content as available scroll depth permits

#### Scenario: Focus a recurrence-definition result
- **WHEN** the user activates an Upcoming recurrence-definition result
- **THEN** Tasks navigates to Upcoming, keeps recurrence management closed, smoothly reveals the recurrence row, and applies whole-row keyboard focus

#### Scenario: See all results
- **WHEN** the user activates See All Results
- **THEN** the module navigates through a real in-app link to `/tasks/search` with the current query and lists every matching task from every planning and lifecycle view

#### Scenario: Refine full results
- **WHEN** the user edits the query on the search-results page
- **THEN** the URL query and full task results update with each keystroke

### Requirement: Task Duplication
The system SHALL duplicate present or Done to-dos from an open task or multi-selection by reconstructing supported user-authored state with fresh identity and open lifecycle.

#### Scenario: Duplicate mutable task content
- **WHEN** the user invokes Duplicate for one or more eligible to-dos
- **THEN** the system creates one new open present task per source with the same Summary, Notes, Primary Link, actionability, legal planning, organization, reminder intent, recurrence intent supported by the current model, and checklist content, order, and completion state
#### Scenario: Exclude nonduplicable identity
- **WHEN** a duplicate task is created
- **THEN** it receives new task, checklist, reminder, recurrence, mutation, order, and history identity and does not copy typed source, owner identity, idempotency identity, history, receipt, completion, cancellation, deletion, or terminal lifecycle state

#### Scenario: Open a duplicate made from the open task
- **WHEN** Duplicate targets exactly the currently open to-do
- **THEN** Tasks flushes and closes the original, inserts the duplicate in the active destination, opens the duplicate editor, and focuses the duplicate Summary

#### Scenario: Duplicate terminal work as present work
- **WHEN** Duplicate targets a to-do in Done
- **THEN** the new task is open and present while the source remains unchanged in Done

### Requirement: Task Row Temporal Metadata
The system SHALL present Deadline metadata in task rows with the semantic Lucide `Flag` icon, numeric time-direction copy, and destructive emphasis for deadlines due today or earlier, SHALL omit Start-date copy from collapsed task summaries, and SHALL present a Today horizon symbol only in Anytime secondary metadata.

#### Scenario: Omit Start dates from collapsed summaries
- **WHEN** a collapsed task has a Start date in any Tasks list
- **THEN** the task summary presents no Start date, Start-relative copy, or Lucide Play icon

#### Scenario: Present an Anytime horizon in secondary metadata
- **WHEN** an Anytime task belongs to Inbox, Now, Next, or Later
- **THEN** its canonical secondary metadata line presents the horizon's semantic icon and color after Area without repeating the icon in the Summary line

#### Scenario: Let other list structure communicate horizons
- **WHEN** Today groups a task by horizon or another list presents the same task
- **THEN** the row omits the secondary horizon marker because that marker is exclusive to Anytime

#### Scenario: Let list structure communicate future Start
- **WHEN** Upcoming groups a task by its Start date
- **THEN** the list bucket communicates that planning context without repeating it in the task's secondary metadata line

#### Scenario: Use a numeral for a one-day deadline offset
- **WHEN** a task row presents a Deadline one day before the owner-local planning date
- **THEN** the relative copy uses the numeral `1` in `1 day ago` and does not spell out `one`

#### Scenario: Emphasize an urgent deadline
- **WHEN** a task row has a Deadline equal to or earlier than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy use the semantic destructive text color

#### Scenario: Keep a future deadline neutral
- **WHEN** a task row has a Deadline later than the owner-local planning date
- **THEN** the Deadline icon and relative-date copy retain the ordinary secondary metadata color

### Requirement: Deterministic Mail Capture Retry
The system SHALL define a specialized Mail capture's idempotent request identity from caller-controlled task and structured source fields, and SHALL NOT treat service-generated task identity, planning date, or ordering as a caller request difference.

#### Scenario: Retry after generated values change
- **WHEN** an authenticated client retries an accepted Mail capture with the same idempotency UUID and caller-controlled fields after the service would select a different task identifier, planning date, planning order, or hierarchy order
- **THEN** the system returns the original task, structured Mail source, and creation receipt with `already_applied` and creates no additional row or history event

#### Scenario: Reject changed caller content
- **WHEN** an authenticated client reuses an accepted Mail-capture idempotency UUID with a different title, notes, area, source title, account, mailbox, message identifier, deep link, or retirement destination
- **THEN** the system rejects the request and leaves the accepted task, source, and creation history unchanged

#### Scenario: Serialize concurrent exact attempts
- **WHEN** two authenticated calls submit the same idempotency UUID and caller-controlled Mail-capture fields before either call settles
- **THEN** one call creates the task and source, the other resolves to the same accepted task, and the authoritative database contains one task, one source, and one creation event

### Requirement: Large-Library Responsiveness
The system SHALL retain bounded task-view and search latency as active and historical task data grows beyond the owner's current library.

#### Scenario: Derive task views at synthetic scale
- **WHEN** the performance harness derives Today, Upcoming, Anytime, Someday, or Done from 10,000 mixed synthetic records
- **THEN** each derivation remains below 100 ms p95 and returns the complete correctly ordered view

#### Scenario: Search a large task library
- **WHEN** the search surface indexes and filters 10,000 synthetic tasks across text, hierarchy, placement, lifecycle, actionability, and source kind
- **THEN** reusable index construction remains below 100 ms p95, each text or structured filter remains below 50 ms p95, and result presentation remains capped without misreporting the total match count

#### Scenario: Render a task view larger than the current library
- **WHEN** the development performance harness renders 1,000 interactive task rows and opens search over 10,000 records
- **THEN** the initial view render remains below 2,000 ms, search opens below 1,000 ms, and the module retains its complete keyboard and assistive-technology contract

### Requirement: Parallel Use with Things
The system SHALL support indefinite parallel use without requiring the user to migrate, delete, or modify the existing Things library.

#### Scenario: Begin using the BathOS module
- **WHEN** the user creates task data in BathOS during development
- **THEN** the system does not write to or delete data from Things

#### Scenario: Perform discovery inventory
- **WHEN** an authorized discovery process reads Things through AppleScript
- **THEN** the process remains read-only, bounded, and excludes private task content from the public repository

#### Scenario: Exercise sustained automated parallel use
- **WHEN** two persistent local task clients plus the Raycast-aware creation and MCP mutation services run repeated retry, conflict, completion, and restart cycles for at least ten minutes
- **THEN** upload queues drain, accepted revisions remain authoritative, exact retries do not duplicate work, every replica converges, and task, history, and conflict-receipt counts remain exact

#### Scenario: Preserve the migration decision after an automated pass
- **WHEN** the sustained automated gate passes but lived parallel use and production-device boundaries remain unresolved
- **THEN** Things remains authoritative, Inbox Manager dual-writing remains disabled, and the system does not treat the automated result as migration approval

#### Scenario: Defer migration
- **WHEN** the BathOS module is not yet replacement-ready
- **THEN** no implementation task requires a Things import or source-of-truth switch

### Requirement: BathOS Product Expression
The system SHALL use BathOS's direct module naming, shared visual language, copy, assets, and interaction conventions while preserving the functional planning principles selected for the Tasks module.

#### Scenario: Design a familiar planning concept
- **WHEN** the module implements a concept also present in Things
- **THEN** the implementation uses BathOS conventions and original expression rather than copying Cultured Code branding or assets

#### Scenario: Identify the module directly
- **WHEN** the module appears in the BathOS launcher or install metadata
- **THEN** it is named `Tasks` and uses the standard BathOS monochrome treatment of Lucide `SquareCheckBig`

### Requirement: Stable Tasks Route Runtime
The system SHALL preserve one authenticated Tasks runtime and synchronization session while navigating among supported routes inside the Tasks module.

#### Scenario: Navigate between planning views
- **WHEN** a user follows a plain in-app link from one supported Tasks planning view to another
- **THEN** the URL and rendered view change without closing or recreating the Tasks local database, synchronization connector, reliability observer, or reminder polling lifecycle

#### Scenario: Leave the Tasks module
- **WHEN** a user navigates from Tasks to another BathOS module or signs out
- **THEN** the Tasks runtime may close its owner-bound local database and synchronization session according to the existing cleanup contract

### Requirement: Concise Tasks Navigation
The system SHALL keep Tasks navigation to five or fewer persistent destinations at every viewport and SHALL place secondary task views behind one More menu.

#### Scenario: Navigate secondary views by keyboard
- **WHEN** a keyboard user opens More and moves through its destinations
- **THEN** every destination receives visible focus, exposes a nonempty programmatic name, and can be activated without a pointer

#### Scenario: Render concise desktop navigation
- **WHEN** Tasks renders at a desktop or tablet viewport
- **THEN** persistent navigation presents Today, Upcoming, Anytime, Someday, and More without clipping, overlap, overflow, or a second row

#### Scenario: Render five mobile destinations
- **WHEN** Tasks renders below the desktop breakpoint
- **THEN** persistent mobile navigation presents exactly Today, Upcoming, Anytime, Someday, and More

#### Scenario: Preserve link behavior
- **WHEN** a user invokes a direct or overflow navigation item with an ordinary or modified click
- **THEN** the destination remains a real link, plain left click uses SPA navigation, and modified or middle click preserves browser behavior

### Requirement: Config-Owned Task Maintenance
The system SHALL keep infrequent Tasks settings, capability state, diagnostics, and recovery controls on a dedicated Config route instead of persistent daily-planning chrome.

#### Scenario: Open Tasks Config
- **WHEN** a user follows the Config destination
- **THEN** `/tasks/config` renders inside the existing Tasks runtime and presents Browser Reminders, Synchronization, and Backup and Restore sections

#### Scenario: Manage browser reminders
- **WHEN** a user opens Browser Reminders on Config
- **THEN** the interface reports the current capability and exposes only the safe enable or disable action available under the existing reminder contract

#### Scenario: Inspect synchronization
- **WHEN** a user opens Synchronization Details from Config
- **THEN** the existing connection, offline-launch, health, full-sync, queue, activity, reliability-event, and conflict-receipt evidence remains available

#### Scenario: Manage data portability
- **WHEN** a user opens Backup and Restore from Config
- **THEN** the existing verified export, merge, replacement, and safety behavior remains available without a persistent module-header control

### Requirement: Concise Task View Presentation
The Tasks module SHALL keep Today, Upcoming, Anytime, Someday, Done, and Area views task-focused and compact while presenting full metadata only when it is needed.

#### Scenario: Mark an Anytime day horizon
- **WHEN** an active Anytime row has an Inbox, Now, Next, or Later horizon
- **THEN** the secondary metadata line displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an unavailable day-horizon marker
- **WHEN** an Anytime row has a null day horizon or the user is viewing another list
- **THEN** the row does not reserve empty marker space or show a decorative horizon icon

#### Scenario: Summarize nearby calendar dates relatively
- **WHEN** a task row displays a Deadline that differs from the owner-local planning date by no more than 9 days
- **THEN** the wider row uses Today, Tomorrow, `1 day ago`, N days ago, or N days left as appropriate
- **AND** the compact mobile row uses Today or a signed singular or plural day count as appropriate

#### Scenario: Summarize a reminder by time
- **WHEN** a task row has an active reminder and valid Start planning
- **THEN** the row shows a Lucide reminder bell followed only by the reminder's 12-hour local time with an uppercase AM or PM marker

#### Scenario: Mask immediate dates in date controls
- **WHEN** a Start or Deadline input displays the owner-local date immediately before, equal to, or immediately after the planning date
- **THEN** the input respectively presents Yesterday, Today, or Tomorrow instead of an explicit calendar date

#### Scenario: Keep temporal input hover neutral
- **WHEN** a pointer hovers over an enabled Start or Deadline input
- **THEN** the control retains its ordinary input background while preserving its focus, keyboard, and popover behavior

#### Scenario: Summarize distant calendar dates compactly
- **WHEN** a displayed Deadline is more than 9 days before or after the owner-local planning date
- **THEN** both wider and compact mobile task rows use a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a task editor is open
- **THEN** the card presents its summary row followed by Summary, Notes, Primary Link disclosure or input, Checklist disclosure or items, Start, Deadline, Area when available, and Actionability in DOM, visual, and keyboard order

#### Scenario: Keep Notes visibly multiline
- **WHEN** Notes is empty or contains no more than two visible lines
- **THEN** the Notes control reserves a minimum of two text lines plus its ordinary vertical padding
- **AND** it continues growing for additional content rather than behaving as a single-line input

#### Scenario: Identify drawer fields without visible labels
- **WHEN** the expanded metadata drawer presents its editable controls
- **THEN** it omits repeated visible field labels, presents Summary as the empty primary-text placeholder, uses field-identifying empty-state copy where applicable, and retains a nonempty programmatic name for every control

#### Scenario: Use the task card as the editor boundary
- **WHEN** a task editor expands
- **THEN** the form has no redundant top rule or checkbox-column indentation, uses only a small top gap, follows the card's ordinary responsive horizontal padding, and lets its controls fill the resulting content width

#### Scenario: Use shared BathOS form controls
- **WHEN** the expanded editor presents Notes, Area, or Actionability
- **THEN** Notes matches the standard Input and date-control border and focus treatment while both dropdowns use the shared BathOS Select trigger, popover, selection, and keyboard conventions

#### Scenario: Pair absent metadata disclosures
- **WHEN** an expanded task has neither a Primary Link nor Checklist content
- **THEN** Add Primary Link and Add Checklist appear in one row as equal half-width controls with centered contents and one subtle divider between them
- **AND** Primary Link remains before Checklist in DOM and keyboard order

#### Scenario: Present one absent metadata disclosure
- **WHEN** an expanded task has either Primary Link or Checklist content but not the other
- **THEN** the remaining add action appears at automatic width on its own line with left-aligned contents and no divider

#### Scenario: Preserve disclosure layout during planning changes
- **WHEN** the user changes Start or destination while an expanded task already has Primary Link or Checklist content
- **THEN** the existing content and any remaining add action continue on separate full-width rows
- **AND** selecting Someday does not recombine them into the paired absent-metadata layout

#### Scenario: Preserve an open Anytime task's rendered placement
- **WHEN** the user changes Area, Start, Deadline, Actionability, ordering, or any other metadata that would change an expanded Anytime task's visible bucket or invisible automatic-sort position
- **THEN** the editor and summary row may display the current metadata immediately while the task remains in the exact Area bucket and within-bucket slot where it was rendered when opened
- **AND** the final metadata projection is allowed to rebucket or reorder the task only after the drawer closes

#### Scenario: Disclose an absent Primary Link
- **WHEN** an expanded task has no Primary Link
- **THEN** the editor presents an Add Primary Link action with the canonical Primary Link icon instead of an empty URL input

#### Scenario: Begin editing an absent Primary Link
- **WHEN** the user activates Add Primary Link
- **THEN** the editor reveals the standard full-size URL input above Checklist and places the text cursor in that input

#### Scenario: Present an existing Primary Link as a URL control
- **WHEN** the expanded task has a Primary Link or the user has disclosed its input
- **THEN** the editor uses a standard full-size URL input without a dedicated one-click clear button, hides the adjacent activation control while the input is empty, reveals that control as soon as any character is present, and enables activation only for a resolvable supported destination

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

### Requirement: Semantic Today Horizon Identity
The Tasks module SHALL use a consistent icon-and-color identity for each Today horizon wherever the horizon is presented as a symbol: green Inbox, yellow Now, red-orange Next, and reddish-purple Later.

#### Scenario: Color Today bucket symbols
- **WHEN** Today presents an Inbox, Now, Next, or Later bucket
- **THEN** the bucket's Lucide horizon symbol uses the horizon's semantic color while retaining its visible horizon name

#### Scenario: Color horizon markers outside Today
- **WHEN** an Anytime task or another planning row presents an Inbox, Now, Next, or Later horizon marker
- **THEN** the marker uses the same semantic color and Lucide icon as that horizon uses in Today

#### Scenario: Color Start-picker choices
- **WHEN** the Start picker presents the Inbox, Now, Next, and Later choices
- **THEN** each choice's Lucide symbol uses the same semantic horizon color without relying on color as its only label

### Requirement: Ungrouped Primary Task Lists
The Tasks module SHALL render ordinary task rows directly in Anytime, Someday, and Done without a redundant visible Tasks bucket heading.

#### Scenario: Browse Anytime without a generic bucket heading
- **WHEN** Anytime contains ordinary tasks
- **THEN** the task rows appear directly beneath the view's other applicable content without a visible nested Tasks heading

#### Scenario: Browse Someday without a generic bucket heading
- **WHEN** Someday contains ordinary tasks
- **THEN** the task rows appear directly beneath the view's other applicable content without a visible nested Tasks heading

#### Scenario: Preserve accessible list structure
- **WHEN** a generic Tasks heading is omitted
- **THEN** the route retains its named view landmark and the task rows remain inside an accessible task-list region

### Requirement: Consistent Tasks list density
The interface SHALL present Tasks list and grouping headings without item-count adornments, SHALL keep every collapsed task at a dense uniform height, and SHALL present optional task metadata in the stable order Area, Anytime horizon, Reminder, Actionability, Deadline, Notes, and Checklist as flat inline content without resting card or chip decoration or bold typography, except that Anytime SHALL omit a task's Area from the metadata line when the visible Area bucket already communicates it.

#### Scenario: Keep closed rows uniform
- **WHEN** a list contains collapsed tasks with different combinations of hierarchy, notes, checklist content, actionability, deadline, reminder, or other secondary details
- **THEN** every collapsed task row occupies the same 44-pixel height

#### Scenario: Keep secondary details compact
- **WHEN** a collapsed task has one or more secondary details
- **THEN** the interface presents those details in one bounded nonwrapping metadata line without increasing the row height

#### Scenario: Omit absent task metadata
- **WHEN** any canonical secondary metadata item is unavailable or not applicable to a task
- **THEN** the item is absent without a placeholder and the remaining items preserve their relative canonical order

#### Scenario: Present Area quietly outside Anytime
- **WHEN** a task assigned to an Area appears on a view other than Anytime
- **THEN** its Area name is first in the metadata line and uses the ordinary secondary gray text color rather than informational blue

#### Scenario: Omit redundant Anytime Area metadata
- **WHEN** an Anytime task appears inside its visible Area bucket
- **THEN** its secondary metadata line omits the Area name while preserving every other applicable metadata item and its canonical order

#### Scenario: Place actionability between Reminder and Deadline
- **WHEN** a task has Reminder, non-Ready actionability, and Deadline metadata
- **THEN** the metadata line presents Actionability immediately after Reminder and immediately before Deadline

#### Scenario: Present Notes presence
- **WHEN** a task's Notes contain at least one character
- **THEN** its metadata line presents the canonical Lucide `NotepadText` icon immediately before Checklist without a count or written label

#### Scenario: Omit an empty Notes indicator
- **WHEN** a task's Notes are empty
- **THEN** its metadata line does not present the Notes icon

#### Scenario: Present checklist presence
- **WHEN** a task contains at least one checklist item
- **THEN** its metadata line presents the established Task checklist icon after Notes without a count or written label

#### Scenario: Omit an empty checklist indicator
- **WHEN** a task has no checklist items
- **THEN** its metadata line does not present the Task checklist icon

#### Scenario: Present non-ready actionability as an icon
- **WHEN** a task is Waiting or Rechecking at any viewport width
- **THEN** the flat metadata line presents only that state's established symbol in semantic purple while preserving the complete actionability name for assistive technology

#### Scenario: Preserve actionable silence
- **WHEN** a task is Ready
- **THEN** the metadata line presents no actionability symbol or label at any viewport width

#### Scenario: Compress deadlines on mobile
- **WHEN** a mobile task row presents a Deadline
- **THEN** the flat metadata line presents the Deadline symbol, uses `Today` for a zero owner-planning calendar-day offset, and otherwise presents the signed offset followed by the correctly singular or plural `day` label, including `1 day`, `-1 day`, `4 days`, and `-4 days`

#### Scenario: Preserve desktop deadline metadata
- **WHEN** the task row renders at or above the standard small breakpoint
- **THEN** Deadline metadata retains its complete relative-date phrasing while remaining visually flat

#### Scenario: Use quiet task summaries
- **WHEN** an active, Done, or Trash task row renders its Summary
- **THEN** the Summary uses the ordinary interface weight while retaining foreground contrast and the established Summary text size

#### Scenario: Use compact internal spacing
- **WHEN** a collapsed task row renders its Summary, optional metadata, checkbox, source, and actions
- **THEN** it uses compact horizontal and vertical spacing with a slightly reduced leading inset, keeps source and actions controls smaller than the row height and vertically centered, preserves mobile operability, and gives the Summary and metadata lines a small visible separation without clipping controls or text

#### Scenario: Present resting tasks without cards
- **WHEN** an active, Done, or Trash task is collapsed, resting, unfocused, and unselected
- **THEN** the task row has no visible border, background fill, rounded card boundary, shadow, or gap separating it from the next task row

#### Scenario: Highlight focused and selected tasks consistently
- **WHEN** a collapsed task has whole-task keyboard focus or is selected individually or for a bulk action
- **THEN** the task uses the established quiet selection background highlight without adding an outline or focus ring around the row

#### Scenario: Preserve expanded editing containment
- **WHEN** a user opens a task
- **THEN** the complete editor expands beneath the fixed-height row header inside one quiet rounded background with a subtly increased horizontal content inset that visibly contains the summary and editor without a resting border or shadow

### Requirement: Canonical Tasks Iconography
The Tasks module SHALL maintain and consistently reuse a documented Lucide icon for every established Tasks product concept, while preserving accessible text or programmatic names independently from the icon.

#### Scenario: Use canonical task-state controls
- **WHEN** Tasks presents an ordinary, Someday, or completed task leading control
- **THEN** it uses Lucide `Square`, `SquareDashed`, or `SquareCheck`, respectively, while reserving `SquareCheckBig` for the Tasks module icon

#### Scenario: Use canonical navigation icons
- **WHEN** Tasks represents Today, Someday, or Done in navigation
- **THEN** it uses Lucide `Star`, `SquareDashed`, or `ListChecks`, respectively

#### Scenario: Use the canonical add icon
- **WHEN** Tasks presents an action that adds a task or Area
- **THEN** it uses Lucide `Plus`

#### Scenario: Preserve approved existing concepts
- **WHEN** Tasks renders an established concept that is not explicitly overridden
- **THEN** it uses the canonical Lucide component recorded in the Tasks iconography reference rather than choosing a new icon independently at the rendering site

#### Scenario: Reuse one concept across surfaces
- **WHEN** one established Tasks concept appears in navigation, search, a list, a picker, a dialog, or another module surface
- **THEN** every occurrence uses the same canonical icon unless the iconography reference explicitly defines a distinct action concept

### Requirement: Module Isolation
The task module SHALL remain removable without importing code from another BathOS module or requiring another module's data.

#### Scenario: Use shared BathOS infrastructure
- **WHEN** the task module needs authentication, layout, UI primitives, or general utilities
- **THEN** it uses shared platform, component, or library surfaces rather than importing another module

#### Scenario: Remove the task module
- **WHEN** the task module's files, routes, launcher entry, and `tasks_` database objects are removed
- **THEN** unrelated BathOS modules continue to function

### Requirement: Legacy Task Planning Migration
The system SHALL migrate retired planning and terminal vocabulary without losing task content, provenance, hierarchy, reminders, recurrence, history, or stable identity.

#### Scenario: Migrate Inbox work
- **WHEN** the migration encounters an Inbox to-do
- **THEN** it becomes Anytime and Today Later with its stable identifiers and content unchanged

#### Scenario: Migrate current Today work
- **WHEN** the migration encounters eligible daytime or evening Today work
- **THEN** it becomes Anytime and Today Next or Later respectively

#### Scenario: Migrate future Today work
- **WHEN** the migration encounters Today work whose start date is after the owner's current planning date
- **THEN** it becomes future Anytime work with no Today membership and remains in Upcoming

#### Scenario: Retire old routes
- **WHEN** a user opens `/tasks/inbox`, `/tasks/logbook`, or `/tasks/trash`
- **THEN** the router replaces the location with `/tasks/today` or `/tasks/done` and never renders a retired view

### Requirement: Deferral-Anchored Reminder Time
The system SHALL allow at most one active reminder per tasks, SHALL derive its calendar date from the item's future Start Date or owner-local planning date for a Today horizon, and SHALL expose only its local time as user-editable reminder intent.

#### Scenario: Add a reminder to scheduled work
- **WHEN** a user assigns a reminder time to an open item with a future Start Date
- **THEN** the system resolves one reminder on that Start Date in the owner's planning time zone and does not request or store an independently chosen reminder date

#### Scenario: Add a reminder to Today work
- **WHEN** a user assigns a reminder time to an open item with a Today horizon and no future Start Date
- **THEN** the system resolves one reminder on the owner's current planning date and does not request or store an independently chosen reminder date

#### Scenario: Default reminder planning for unplanned work
- **WHEN** an open to-do has neither a future Start Date nor a Today horizon and the user saves a valid reminder time
- **THEN** the system first assigns Today · Inbox and then resolves the reminder on the owner's current planning date

#### Scenario: Clear all Start intent with a reminder
- **WHEN** a user clears both future Start Date and Today horizon from an item that has an active reminder
- **THEN** the system cancels its reminder and pending occurrence

#### Scenario: Move future work directly to Today
- **WHEN** a user replaces a future Start Date with a Today horizon while retaining its reminder time
- **THEN** the system re-resolves the reminder on the owner planning date and replaces the prior pending occurrence exactly once

#### Scenario: Activate work without losing its same-day reminder
- **WHEN** the owner-local Start Date arrives before a task's resolved reminder time
- **THEN** activation clears the parent Start Date, assigns Today Inbox, and preserves the already-scheduled occurrence so it remains deliverable that day

#### Scenario: Move the Start Date with a reminder
- **WHEN** a user changes an item's future Start Date while retaining its reminder time
- **THEN** the system re-resolves the reminder against the new date and replaces the prior pending occurrence exactly once

#### Scenario: Normalize existing reminder data
- **WHEN** the effective-date reminder migration encounters an active reminder
- **THEN** it rebinds that reminder to its parent's future Start Date or current Today planning date and cancels it only when the parent has neither Start form

### Requirement: Structured Task Clipboard
The system SHALL support durable, versioned task-object Copy, Cut, and Paste through the operating-system clipboard, SHALL reconstruct supported user-authored state with fresh identity, and SHALL apply deterministic destination rules before mutation.

#### Scenario: Copy selected tasks as a durable payload
- **WHEN** task selection owns Command+C on Mac or Control+C on Windows
- **THEN** Tasks writes one plain-JSON envelope with a fixed BathOS Tasks kind, schema version, operation, and the selected to-dos in visible order, leaves the source tasks unchanged, and shows a brief Copy confirmation

#### Scenario: Include reconstructible user-authored state
- **WHEN** Tasks serializes a task object for Copy or Cut
- **THEN** the snapshot includes supported Summary, Notes, Primary Link, Start, Deadline, horizon, reminder, actionability, organization, recurrence, and checklist intent and excludes owner, record, source-provenance, history, receipt, idempotency, and terminal-state identity

#### Scenario: Preserve native clipboard behavior in text
- **WHEN** an editable text control owns a platform Cut, Copy, or Paste command
- **THEN** the browser performs its native text operation and Tasks does not read, write, remove, or create task objects

#### Scenario: Cut only after a successful clipboard write
- **WHEN** task selection owns Command+X on Mac or Control+X on Windows for present open tasks
- **THEN** Tasks first writes the complete payload and only after success recoverably deletes the selected sources, clears selection, and shows a brief Cut confirmation

#### Scenario: Leave sources after a failed Cut write
- **WHEN** the clipboard rejects or fails a Cut payload write
- **THEN** Tasks leaves every source task and the selection unchanged and reports the failure

#### Scenario: Reject Cut in Done
- **WHEN** Cut targets any terminal Done to-do
- **THEN** Tasks performs no clipboard or lifecycle mutation and reports that Cut is not available in Done

#### Scenario: Paste structured tasks into Today
- **WHEN** a valid task envelope is pasted in Today
- **THEN** Tasks creates open Anytime tasks at the top in payload order, clears Start Date, assigns Today Inbox horizon, preserves legal nonplanning content, and reports Paste success

#### Scenario: Paste structured tasks into Anytime
- **WHEN** a valid task envelope is pasted in Anytime
- **THEN** Tasks creates open unplanned Anytime tasks at the top in payload order with Start and Today horizon cleared, and the synchronization uploader preserves that explicit null planning state

#### Scenario: Paste structured tasks into Someday
- **WHEN** a valid task envelope is pasted in Someday
- **THEN** Tasks creates open Someday tasks at the top in payload order with Start and Today horizon cleared

#### Scenario: Paste ordinary text as one task
- **WHEN** supported-destination Paste receives clipboard text that is not a valid supported task envelope and is not all whitespace
- **THEN** Tasks creates one open task at the top using the exact clipboard text as Title and applies the destination's planning and organization rules

#### Scenario: Reject malformed claimed task data
- **WHEN** clipboard text claims the BathOS Tasks kind but has an unsupported version, invalid field, invalid size, or invalid task count
- **THEN** Tasks rejects the payload without treating the JSON as a task Title or mutating task data

#### Scenario: Normalize illegal destination metadata
- **WHEN** destination rules clear the planning state required by copied reminder intent or a Today reminder time has already elapsed
- **THEN** Tasks omits that reminder from the new task rather than creating invalid state and does not change unrelated legal metadata

#### Scenario: Reconstruct terminal content as present work
- **WHEN** a task copied from Done is pasted into a supported destination
- **THEN** the new task is open and present with fresh lifecycle identity while the Done source remains unchanged

#### Scenario: Preflight connected deep content
- **WHEN** reconstruction requires reminder or recurrence writes that are unavailable in the current runtime
- **THEN** Tasks rejects the operation before creating task roots rather than silently dropping that user-authored content

#### Scenario: Recover from a child reconstruction failure
- **WHEN** task-root creation succeeds but a later checklist, reminder, or recurrence reconstruction fails
- **THEN** Tasks compensates through the recoverable delete path for roots created by that operation and reports one failure

#### Scenario: Use task clipboard from a menu command
- **WHEN** the browser dispatches Copy, Cut, or Paste from a menu instead of a keydown and task selection or a supported destination owns the operation
- **THEN** Tasks applies the same task-object behavior as the documented keyboard command

### Requirement: Area-Aware Task Planning
The Tasks module SHALL use name-only Areas to organize ongoing responsibilities through direct optional task assignment, SHALL keep Area organization separate from temporal planning, and SHALL present Area choices without obsolete Project-era grouping.

#### Scenario: Keep Areas name-only
- **WHEN** a user creates or edits an Area
- **THEN** the Area exposes a name and manual order without completion, Start, Deadline, destination, or day-horizon state

#### Scenario: Leave Today work intermingled
- **WHEN** Today contains tasks from different Areas and tasks with no Area
- **THEN** the user can order them together inside one day horizon without an Area bucket changing membership or rank

#### Scenario: Order Area buckets manually
- **WHEN** multiple Area buckets contain visible Anytime tasks
- **THEN** the interface orders the buckets by the manual Area order maintained in Config, after the unlabelled unassigned region

#### Scenario: Omit an empty Area bucket
- **WHEN** an Area has no task visible under ordinary Anytime membership and the active Quick Filter
- **THEN** Anytime omits that Area's heading and does not render an empty bucket

#### Scenario: Create inside an Area bucket
- **WHEN** a user activates an Area bucket heading in Anytime or Someday
- **THEN** Tasks opens one new task in that view assigned directly to that Area at the top of the bucket

#### Scenario: Create generic Anytime work
- **WHEN** a user activates the floating New Task action in Anytime
- **THEN** Tasks opens one unassigned Anytime task at the top of the unlabelled region

#### Scenario: Present Area choices directly
- **WHEN** the expanded task editor presents an Area selector
- **THEN** its choices are No Area followed by the owner's ordered Areas without an Areas section heading

#### Scenario: Manage Areas in Config
- **WHEN** a user opens Tasks Config
- **THEN** one Areas card DataGrid allows the user to add Areas, edit names in its single Name column, and use each row's ellipsis menu to move or recoverably delete the Area when those actions are eligible

#### Scenario: Return from an Area detail
- **WHEN** an Area detail presents a return breadcrumb
- **THEN** the breadcrumb returns to Config and Area renaming remains available only in Config

### Requirement: Cyclic Task Area Command
BathOS Tasks SHALL let the platform-specific Control+V task command cycle Area assignment for one or more eligible task targets without opening an Area selector.

#### Scenario: Cycle one task through Areas
- **WHEN** Control+V on Mac or Alt+Shift+V on Windows targets one eligible task
- **THEN** Tasks advances the task through No Area and each owner Area in configured order, wraps after the final Area, and preserves unrelated metadata

#### Scenario: Normalize a mixed bulk selection
- **WHEN** the Area command targets multiple tasks whose Area values differ
- **THEN** Tasks first assigns every target to No Area

#### Scenario: Advance a unified bulk selection
- **WHEN** the Area command targets multiple tasks that all share No Area or the same Area
- **THEN** Tasks advances every target together to the next value in the ordered Area cycle

#### Scenario: Cycle with no defined Areas
- **WHEN** the Area command targets tasks while the owner has no defined Areas
- **THEN** Tasks performs no mutation because No Area is the only available value

### Requirement: Optional Automatic Planning Order
The Tasks module SHALL provide one synchronized, owner-scoped preference that optionally applies deterministic automatic ordering to Anytime and Someday while preserving manual order among exact automatic-sort peers.

#### Scenario: Default automatic sorting off
- **WHEN** an owner has not explicitly enabled automatic list sorting
- **THEN** Anytime and Someday retain their fully manual order and permit ordinary same-Area manual reordering

#### Scenario: Share one preference across lists and devices
- **WHEN** an owner enables or disables automatic list sorting
- **THEN** the same preference governs both Anytime and Someday and synchronizes across the owner's sessions and devices

#### Scenario: Sort independently inside every Area
- **WHEN** automatic sorting is enabled
- **THEN** Tasks preserves the unassigned and effective-Area section order and applies automatic task sorting independently inside each section

#### Scenario: Order deadlines from oldest to absent
- **WHEN** one Area section contains tasks with overdue, Today, future, and absent Deadlines
- **THEN** Tasks orders the oldest overdue Deadline first, then later calendar Deadlines in ascending order through Today and the future, then tasks without a Deadline

#### Scenario: Order Anytime horizons
- **WHEN** automatic sorting is enabled and Anytime tasks in one equal-Deadline group have different Today horizons
- **THEN** Tasks orders Inbox, Now, Next, Later, then tasks without a horizon

#### Scenario: Skip the inapplicable Someday horizon rank
- **WHEN** automatic sorting is enabled in Someday
- **THEN** all tasks tie on the absent horizon rank and continue to Actionability ordering without acquiring Today planning metadata

#### Scenario: Order Actionability
- **WHEN** automatic sorting is enabled and tasks share one Area, Deadline, and horizon rank
- **THEN** Tasks orders Ready first, Rechecking second, and Waiting third

#### Scenario: Preserve manual peer order
- **WHEN** automatically sorted tasks share the same effective Area, normalized Deadline, horizon, and Actionability
- **THEN** Tasks orders them by their durable manual rank and permits pointer reordering among those exact peers

#### Scenario: Restrict an illegal same-Area drag
- **WHEN** a user drags an automatically sorted task over non-peer rows in its current Area
- **THEN** the insertion indicator remains at the most recent legal peer position and dropping uses that displayed legal position

#### Scenario: Commit the last legal position from the Tasks interface
- **WHEN** a task drag has a displayed legal insertion position and the user releases it anywhere inside the Tasks interface
- **THEN** Tasks commits the task at that displayed position even when the release is outside a task row or list

#### Scenario: Preserve an explicitly canceled drag
- **WHEN** the browser does not deliver an in-app drop event because the user cancels the drag or releases it outside the browser
- **THEN** Tasks leaves the task unchanged

#### Scenario: Move across Areas without changing sort metadata
- **WHEN** the user drops an automatically sorted task into another Area or the unassigned region
- **THEN** Tasks applies the ordinary exact organization move and displayed legal manual rank without changing Deadline, horizon, or Actionability

#### Scenario: Retain an edited task until close
- **WHEN** an open task's Deadline, horizon, Actionability, or Area changes while automatic sorting is enabled
- **THEN** Tasks keeps the task in its retained visible position until close and then applies the established delayed animated reconciliation into its automatic position

#### Scenario: Retain a new draft until close
- **WHEN** a task is created in an automatically sorted view
- **THEN** Tasks keeps the open draft at its contextual insertion point and joins it to automatic order only after the editor closes

#### Scenario: Materialize automatic order on disable
- **WHEN** an owner disables automatic sorting
- **THEN** Tasks persists the complete current automatic order of Anytime and Someday as the new manual order before exposing fully manual reordering

#### Scenario: Ignore an active Quick Filter when materializing
- **WHEN** automatic sorting is disabled while a Quick Filter hides some tasks
- **THEN** Tasks materializes the complete unfiltered owner order so hidden tasks retain their correct relative rank

#### Scenario: Fail closed while disabling
- **WHEN** the automatic order cannot be completely materialized
- **THEN** Tasks keeps automatic sorting enabled and reports the failed preference change without exposing a partially materialized manual order

#### Scenario: Present conceptual Actionability order
- **WHEN** Tasks presents an Actionability selection control
- **THEN** its options appear as Ready, Rechecking, then Waiting

### Requirement: Upcoming Date-Section Ordering
The Tasks module SHALL permit manual ordering of ordinary tasks and scheduled recurrence prototypes inside each visible Upcoming date section through one stable mixed-row order.

#### Scenario: Preserve a direct mixed-row drop
- **WHEN** a user drags an ordinary task or scheduled recurrence prototype before or after any eligible row in its current Upcoming date section
- **THEN** Tasks persists the exact displayed placement and retains it through asynchronous save and synchronization

#### Scenario: Upload an ordinary task's Upcoming rank
- **WHEN** an ordinary task reorder changes `upcoming_order_key` in the local synchronized database
- **THEN** the Tasks mutation connector uploads that rank as a supported mutable task field instead of rejecting the queued mutation and restoring the prior remote rank

#### Scenario: Preserve a section-edge drop around prototypes
- **WHEN** a user drops at the beginning or end of an Upcoming date section containing ordinary tasks, recurrence prototypes, or both
- **THEN** Tasks derives the boundary from the complete displayed mixed-row sequence rather than from ordinary tasks alone

#### Scenario: Preserve an ordinary task's cross-section prototype placement
- **WHEN** a user drags an ordinary task from one Upcoming date section before or after a recurrence prototype in another date section
- **THEN** Tasks moves the ordinary task to the target date section and persists its requested placement relative to the prototype

#### Scenario: Reconcile a concurrent prototype revision
- **WHEN** a prototype metadata save or recurrence evaluation advances the recurrence revision while an Upcoming reorder is being committed
- **THEN** Tasks retries the orthogonal rank mutation against the authoritative recurrence definition without flashing the prototype back to its stale position

#### Scenario: Order tied mixed rows consistently
- **WHEN** ordinary tasks or recurrence prototypes share the same fractional order key
- **THEN** rendering and reorder calculations apply the same stable identity tie-breaker

### Requirement: Bulk Task Drag Group
On Today, Upcoming, Anytime, and Someday, the system SHALL allow a pointer drag that begins on a selected task to move the complete current task selection. The system SHALL derive group order from the tasks' current visual order rather than selection order and SHALL close a different open task through the safe autosave boundary when dragging begins.

#### Scenario: Non-contiguous selection moves in visual order
- **WHEN** the user selects non-contiguous tasks and begins dragging any selected task
- **THEN** the system treats every selected task as the drag group and preserves their pre-drag visual order

#### Scenario: Unselected row starts a single-task drag
- **WHEN** the user begins dragging a task that is not part of the current multi-selection
- **THEN** the system treats only that task as the drag subject

#### Scenario: Close another open task when dragging begins
- **WHEN** one task is open and the user begins dragging a different task on Today, Upcoming, Anytime, or Someday
- **THEN** Tasks safely flushes pending edits, closes the open task without redirecting focus to it, and continues the native drag with the reclaimed list space

#### Scenario: Preserve an editor when safe close fails
- **WHEN** pending edits for the open task cannot be flushed after a drag begins on another task
- **THEN** Tasks preserves the open editor and its unsaved state rather than discarding work

#### Scenario: Scope is limited to planning lists
- **WHEN** the user visits a Tasks surface other than Today, Upcoming, Anytime, or Someday
- **THEN** the system does not offer bulk task drag reordering on that surface

### Requirement: Task Drag Preview
Tasks SHALL keep task-list placement feedback anchored to the list and SHALL NOT include a task drop-position indicator in the native drag preview that follows the pointer.

#### Scenario: Drag a task while a placement marker is available
- **WHEN** a user begins dragging a task whose list can render a blue drop-position indicator
- **THEN** the native drag preview contains the task's summary content without the blue indicator while the list remains free to show the indicator at the current legal drop position

#### Scenario: Preserve native drag fallback
- **WHEN** the active browser does not expose a programmable native drag-image API
- **THEN** Tasks continues the native task drag without blocking reordering or changing persisted task data

### Requirement: Bulk Visible-Bucket Projection
The system SHALL interpret a bulk drop as one desired visible boundary after the selected tasks are removed. A drop into a different visible Today horizon, Upcoming date section, or Anytime or Someday Area region SHALL apply the metadata required for every selected task to belong to that visible bucket.

#### Scenario: Today horizon bulk drop
- **WHEN** selected Today tasks are dropped into a different horizon
- **THEN** every selected task receives that horizon and the group is ordered at the requested legal position

#### Scenario: Upcoming date bulk drop
- **WHEN** selected Upcoming tasks are dropped into a different date section
- **THEN** every selected task receives that date as its Start, clears any Today horizon, retains its Deadline, and appears only in the Start date section

#### Scenario: Same Upcoming date reorder
- **WHEN** selected Upcoming tasks are reordered within their existing date section
- **THEN** the system preserves their existing Start and Deadline metadata

### Requirement: Bulk Automatic-Sort Projection
When automatic sorting is enabled for Anytime and Someday, the system SHALL preserve the invisible Deadline, Today horizon, and Actionability tuple for each selected task. It SHALL place each post-drop tuple subgroup at the desired boundary when legal and otherwise at the closest legal boundary within its peer interval.

#### Scenario: Same invisible peer group
- **WHEN** all selected tasks share one invisible automatic-sort tuple and the desired boundary is within that peer interval
- **THEN** the tasks are compacted at that boundary in their prior visual order

#### Scenario: Mixed invisible peer groups
- **WHEN** the selection contains tasks from multiple invisible tuples
- **THEN** each tuple subgroup settles into its own legal peer interval while preserving visual order within the subgroup

#### Scenario: Cross-Area automatic drop
- **WHEN** a mixed selection is dropped into another visible Area while automatic sorting is enabled
- **THEN** the Area metadata changes and each resulting invisible tuple subgroup settles into its legal position in the target Area

#### Scenario: Invisible placement does not rewrite metadata
- **WHEN** the desired pointer boundary lies outside a selected task's legal invisible peer interval
- **THEN** the system clamps placement without changing Deadline, horizon, or Actionability

### Requirement: Bulk Drag Cancellation And Selection
The system SHALL persist a drag only after an accepted in-app drop. Drag end without an accepted drop SHALL not mutate tasks. A successful drop SHALL keep the moved tasks selected.

#### Scenario: Successful drop retains selection
- **WHEN** a bulk drop is accepted and persisted
- **THEN** all moved tasks remain selected and can be dragged again

#### Scenario: Escape reaches BathOS during drag
- **WHEN** the user presses Escape during a drag and BathOS receives the key event
- **THEN** the system clears the pending drag projection and task selection without persisting order or metadata changes

#### Scenario: Release outside an accepted drop surface
- **WHEN** the native drag ends without an accepted BathOS drop
- **THEN** the system clears transient drag state and performs no task mutation

### Requirement: Atomic Bulk Drag History
The system SHALL persist every accepted bulk drop atomically and SHALL represent the complete gesture as one history operation. Undo and redo SHALL validate and traverse all task events in that operation atomically.

#### Scenario: Atomic successful drop
- **WHEN** a bulk drop changes multiple tasks
- **THEN** all task order and visible-bucket metadata changes commit together with one shared operation identity

#### Scenario: Drop failure rolls back
- **WHEN** any task in a bulk drop cannot be validated or persisted
- **THEN** no task in the drop retains a partial persisted change

#### Scenario: One undo restores the group
- **WHEN** the user invokes Undo after a successful bulk drop
- **THEN** every task changed by that drop returns to its prior metadata and order in one action

#### Scenario: One redo reapplies the group
- **WHEN** the user invokes Redo after undoing a bulk drop
- **THEN** every task changed by that drop returns to its post-drop metadata and order in one action

#### Scenario: Unsafe member blocks grouped traversal
- **WHEN** any member of a grouped history operation no longer matches the state required for undo or redo
- **THEN** the complete traversal is rejected and no member is partially changed

### Requirement: Upcoming Bulk Reminder Consistency
When a bulk Upcoming drop changes task Starts, the system SHALL reconcile each affected reminder with the new Start while preserving existing reminder time behavior.

#### Scenario: Cross-date drop reschedules reminders
- **WHEN** selected Upcoming tasks with reminders are dropped into another future date section
- **THEN** each reminder is reconciled to that task's new Start date

#### Scenario: Same-date drop leaves reminders unchanged
- **WHEN** selected Upcoming tasks are reordered within the same date section
- **THEN** the system does not reschedule their reminders

### Requirement: Whole-Task Focus And Selection
The Tasks module SHALL represent no task target, one whole-task-focused closed task, one or more explicitly selected tasks, and one open task as distinct interaction states; SHALL preserve granular sequential keyboard access to every interactive control in collapsed task summaries; and SHALL provide a faster Space-and-arrow whole-task traversal mode.

#### Scenario: Traverse task summaries and the complete page
- **WHEN** a keyboard user presses Tab or Shift+Tab in or around a collapsed task summary
- **THEN** native sequential focus visits the task row and its available completion, title, source-link, and actions controls in DOM order and can continue to controls outside the task list

#### Scenario: Leave whole-task focus for granular Tab traversal
- **WHEN** Tab or Shift+Tab is pressed while one closed task has whole-task focus
- **THEN** Tasks clears whole-task focus and its range anchor without blurring the current element or preventing native sequential focus movement

#### Scenario: Enter whole-task focus from the Tasks background
- **WHEN** no task is focused, open, or multiply selected; no nested surface is open; an eligible noninteractive Tasks page or list surface owns focus; and the user presses a nonrepeated unmodified Space
- **THEN** Tasks prevents page scrolling, gives whole-task focus to the first visible task, scrolls it into view, and does not open it

#### Scenario: Promote a Tab-focused task row
- **WHEN** a closed task row has granular Tab focus without whole-task focus and the user presses a nonrepeated unmodified Space
- **THEN** Tasks prevents page scrolling, promotes that same row into whole-task focus, establishes the range anchor, and does not open or advance the task

#### Scenario: Traverse whole-task focus with Space
- **WHEN** a closed task has whole-task focus and the user presses a nonrepeated unmodified Space or Shift+Space
- **THEN** Tasks prevents page scrolling and moves whole-task focus to the next or previous visible task respectively, wrapping across list boundaries and scrolling the destination into view

#### Scenario: Ignore held Space traversal
- **WHEN** a Space or Shift+Space keydown repeats while a task has whole-task focus
- **THEN** Tasks prevents page scrolling but performs no additional focus movement

#### Scenario: Wrap arrow traversal
- **WHEN** ArrowDown or ArrowUp is pressed while a closed task has whole-task focus
- **THEN** focus moves to the next or previous visible task respectively, wraps across list boundaries, and scrolls the destination into view without moving task order

#### Scenario: Preserve native Space ownership
- **WHEN** Space is pressed while an interactive task control, link, editable control, open task, multiple selection, dialog, menu, listbox, popover, or unrelated page control owns the interaction
- **THEN** Tasks does not invoke whole-task Space traversal and preserves that surface's native or documented Space behavior

#### Scenario: Select one task with a modified click
- **WHEN** a user Command-clicks on Mac, Control-clicks on Windows, or Shift-clicks the activation surface of a task while no task selection is active
- **THEN** Tasks enters explicit selection mode, selects that task, establishes it as the range anchor, presents its selection control and the fixed bulk toolbar, and does not open the editor

#### Scenario: Clear one explicitly selected task
- **WHEN** the user repeats the platform-modifier click on the only explicitly selected task
- **THEN** Tasks clears selection mode and the range anchor without opening the task

#### Scenario: Toggle one task from its selection control
- **WHEN** explicit selection mode is active and the user ordinarily clicks a task's circular selection control
- **THEN** Tasks toggles that task's selected state and preserves selection mode whenever at least one task remains selected

#### Scenario: Open one task from explicit selection
- **WHEN** explicit selection mode is active and the user ordinarily clicks a task's activation surface
- **THEN** Tasks clears the explicit selection and range anchor, closes the bulk toolbar, opens the clicked task, and focuses its Summary without reopening any formerly selected task

#### Scenario: Begin selection from keyboard focus
- **WHEN** one closed task has lightweight whole-task keyboard focus and the user modifier-clicks or Shift-clicks a task activation surface
- **THEN** Tasks enters explicit selection mode with the keyboard-focused task as the selected anchor; selects the clicked task or anchored range as applicable; clears lightweight whole-task focus; and shows the fixed bulk toolbar

#### Scenario: Add to explicit selection
- **WHEN** a user additively modifier-clicks another task or Shift-clicks away from the selection range anchor
- **THEN** Tasks updates the explicit selection, clears closed focus, closes any open editor first, and keeps the fixed bulk toolbar visible

#### Scenario: Enter multiple selection from an open task
- **WHEN** one task is open and the user additively modifier-clicks or Shift-clicks a different visible task
- **THEN** Tasks treats the open task as the initial selection anchor, closes its editor, selects both tasks, and shows the fixed bulk toolbar

#### Scenario: Replace a selected range
- **WHEN** Shift-click selects a new visible endpoint while multi-selection remains active
- **THEN** Tasks replaces the prior range with the contiguous visible task range from the stable anchor to that endpoint

#### Scenario: Retain selection mode with one task
- **WHEN** pointer selection reduces a multi-selection to exactly one task
- **THEN** Tasks keeps selection mode, the remaining task's selection control, and the fixed bulk toolbar visible, and does not reopen an editor

#### Scenario: Clear all task targeting
- **WHEN** a user clicks outside every task and selection-owned surface or navigates to another Tasks view
- **THEN** Tasks clears closed focus, multi-selection, and the range anchor after completing any required open-editor close

#### Scenario: Relinquish collapsed task focus with Escape
- **WHEN** Escape is pressed while a collapsed task row or one of its granular row controls has keyboard focus and no nested surface owns Escape
- **THEN** Tasks clears whole-task focus and its range anchor, blurs the row-owned active element, and performs no task mutation

#### Scenario: Preserve direct row controls
- **WHEN** a user clicks a completion control, actions trigger, source link, or Primary Link, including a modified click on a link
- **THEN** that control retains its pointer behavior and ordinary modified-link behavior without being reinterpreted as task focus or selection

#### Scenario: Open a focused task
- **WHEN** Return or the platform Open/Close Task command is invoked on one focused closed task
- **THEN** Tasks clears closed focus, opens that task, focuses its Summary at the insertion point end, and keeps multi-selection inactive

#### Scenario: Close to whole-row focus
- **WHEN** the Open/Close Task command closes an open task
- **THEN** Tasks flushes autosave, commits deferred completion, and returns focus to the complete surviving task row or the documented same-position fallback

#### Scenario: Target one focused task
- **WHEN** a supported completion, planning, actionability, organization, checklist, clipboard, duplication, or lifecycle command is invoked with one focused closed task
- **THEN** Tasks applies the same eligible single-target behavior available to an open task or multi-selection without showing bulk controls

#### Scenario: Converge bulk actionability before advancing
- **WHEN** the user cycles actionability for multiple selected tasks whose actionability states are mixed or uniformly Ready
- **THEN** Tasks sets every selected task to Waiting
- **WHEN** every selected task is already Waiting
- **THEN** Tasks sets every selected task to Rechecking
- **WHEN** every selected task is already Rechecking
- **THEN** Tasks sets every selected task to Ready

#### Scenario: Open inline metadata from closed focus
- **WHEN** a focused closed task receives a command whose interaction surface exists only inside the expanded editor
- **THEN** Tasks opens the task, focuses the requested surface, and preserves ordinary autosave behavior

#### Scenario: Copy or cut one focused task
- **WHEN** a task-object Copy or eligible Cut command is invoked with one focused closed task and no editable control owns native clipboard behavior
- **THEN** Tasks serializes that task through the ordinary task clipboard contract and applies Cut lifecycle behavior only after the clipboard write succeeds

#### Scenario: Duplicate one focused closed task
- **WHEN** Duplicate is invoked with one focused closed task
- **THEN** Tasks creates one closed duplicate at the documented destination and transfers whole-row focus to the duplicate without opening it

#### Scenario: Traverse while opening
- **WHEN** Control+S or Control+W on Mac, or the corresponding Alt+Shift chord on Windows, is invoked with no open task
- **THEN** Tasks uses the focused closed task as the current position, opens the next or previous visible task, opens the first or last task when no task is focused, and does not wrap at list boundaries

#### Scenario: Focus after a task leaves the view
- **WHEN** an immediate command removes the focused closed task from the current view
- **THEN** focus moves to the task at the same visual position, then the prior visible task, then clears when no visible task remains

#### Scenario: Restore action focus to the whole task
- **WHEN** a task completion, lifecycle, menu, or task-owned dialog action returns keyboard focus to a collapsed task that remains in the current list or to its same-position fallback
- **THEN** Tasks establishes whole-task focus on the complete task row and does not leave focus on a nested completion, title, source-link, or actions control

#### Scenario: Select all under the state threshold
- **WHEN** Select All targets one visible task
- **THEN** Tasks establishes single-task focus without showing bulk controls
- **WHEN** Select All targets two or more visible tasks
- **THEN** Tasks enters multi-selection and shows the bulk toolbar

#### Scenario: Present one whole-task focus target accessibly
- **WHEN** assistive technology inspects a collapsed task
- **THEN** the complete row has a nonempty task name and visible focus treatment while every available nested interactive control remains named and sequentially keyboard accessible

#### Scenario: Keep the focus treatment consistent across navigation methods
- **WHEN** whole-task focus is established or moved by Space, Shift+Space, ArrowUp, or ArrowDown
- **THEN** the focused task uses the shared info-blue background highlight without an additional browser-native focus color

#### Scenario: Present granular row focus without whole-task focus
- **WHEN** native Tab traversal focuses a closed task row without promoting it into whole-task focus
- **THEN** the row exposes the shared info-blue keyboard focus background while task commands do not retain a stale whole-task target after granular traversal continues

#### Scenario: Describe the toggle command
- **WHEN** the Keyboard Commands reference presents the former Close Task action
- **THEN** it labels the action Open/Close Task and documents its focused-closed and open-task behavior for Mac and Windows

### Requirement: Pointer Selection Focus Discipline
Tasks SHALL keep pointer-driven selection membership separate from keyboard task focus and SHALL not retain incidental DOM focus on a task summary control after a modified-click selection gesture.

#### Scenario: Clear focus after platform-modifier selection
- **WHEN** a user Command-clicks a task on Mac or Control-clicks a task on Windows to enter or alter selection mode
- **THEN** Tasks updates selection membership and its stable anchor without retaining DOM focus on the clicked summary control

#### Scenario: Clear focus after range selection
- **WHEN** a user Shift-clicks a task to establish or replace an anchored selection range
- **THEN** Tasks updates the selected range without retaining DOM focus on the clicked summary control

#### Scenario: Ignore a bare modifier after pointer selection
- **WHEN** pointer-driven selection is active and the user presses or releases Shift without another key
- **THEN** Tasks leaves selection unchanged and does not reveal keyboard focus on any task summary

#### Scenario: Preserve genuine keyboard focus
- **WHEN** a user intentionally navigates tasks through Space, arrow keys, Tab, or another declared keyboard traversal
- **THEN** Tasks continues to expose its ordinary accessible whole-task focus indication

### Requirement: Unified Task And Checklist Selection Presentation
Tasks SHALL use canonical Lucide `Circle` and `CircleCheck` selection indicators with the semantic info-blue color and SHALL use the checklist selection blue as the shared background treatment for closed task focus, explicit task selection, and checklist item selection.

#### Scenario: Highlight a focused closed task
- **WHEN** a closed task receives whole-task keyboard focus
- **THEN** its row uses the same blue background highlight used by a selected checklist item

#### Scenario: Highlight explicitly selected tasks
- **WHEN** one or more tasks are in explicit selection mode
- **THEN** every selected task uses the shared blue background highlight and a blue Lucide `CircleCheck`, while unselected tasks expose a blue Lucide `Circle`

#### Scenario: Open a blue-highlighted task
- **WHEN** a blue-highlighted focused or explicitly selected task is opened
- **THEN** its background transitions to the existing gray expanded-task surface while the editor opens

#### Scenario: Use selection presentation in Done
- **WHEN** a Done-list task receives whole-task focus or explicit selection
- **THEN** it uses the same blue task-selection presentation as an active-list task

### Requirement: Revised Control task-command layout
BathOS Tasks SHALL expose the revised Control-based task-command layout, SHALL remove the displaced task-command assignments, and SHALL preserve platform-standard Undo and Redo behavior.

#### Scenario: Windows task commands use shifted Alt
- **WHEN** a user operates Tasks on Windows
- **THEN** every revised Tasks-specific command SHALL use Alt+Shift with the same letter assigned to Control on Mac
- **AND** unshifted Windows Control combinations SHALL retain their standard application meanings

#### Scenario: Undo and Redo preserve platform conventions
- **WHEN** a Mac user presses either Command+Z or Control+Z
- **THEN** Tasks SHALL invoke Undo
- **WHEN** a Mac user presses Command+Y or Command+Shift+Z
- **THEN** Tasks SHALL invoke Redo
- **WHEN** a Windows user presses Control+Z
- **THEN** Tasks SHALL invoke Undo
- **WHEN** a Windows user presses Alt+Shift+Z
- **THEN** Tasks SHALL invoke Undo
- **WHEN** a Windows user presses Control+Y or Control+Shift+Z
- **THEN** Tasks SHALL invoke Redo

#### Scenario: Displaced task-command assignments are removed
- **WHEN** a user presses a former Tasks-specific chord that is absent from the revised layout
- **THEN** Tasks SHALL NOT invoke that chord's former task action

#### Scenario: Keyboard reference matches executable behavior
- **WHEN** a user opens the Keyboard Commands dialog or reads the Tasks guide
- **THEN** the displayed Control commands SHALL match the executable platform-specific layout

#### Scenario: Alternate command notation uses slashes
- **WHEN** the Keyboard Commands dialog presents alternate Undo or Close Open Task chords
- **THEN** it separates those chords with `/` rather than the word `or`, matching the Redo row

### Requirement: Reserved forward task history
Tasks SHALL reserve every user-editable forward task mutation before asynchronous persistence or visual departure can make its result unavailable, and SHALL bind the reservation to the accepted mutation identifier before resolving it.

#### Scenario: Undo completion while its write is in flight
- **WHEN** a user completes a task and invokes Command-Z after the task begins leaving its source list but before the completion write returns
- **THEN** Tasks waits for that reserved completion to settle and undoes its exact accepted history event without traversing an older mutation

#### Scenario: Undo completion while history is projecting
- **WHEN** the completion write has returned but its exact history event or completed task snapshot has not yet projected locally
- **THEN** Tasks waits within a bounded interval for both projections and reopens the task into its retained prior planning state

#### Scenario: Make an accepted deletion the newest undo action
- **WHEN** a user recoverably deletes a task and the accepted delete transition moves it to Done
- **THEN** Tasks exposes that exact deletion as the newest undo intent instead of reporting Nothing to Undo or selecting an older history event

#### Scenario: Undo deletion while history is projecting
- **WHEN** the delete write has returned but its exact history event or deleted task snapshot has not yet projected locally and the user invokes Undo
- **THEN** Tasks retains the request for that deletion within the bounded projection interval and restores the task hierarchy to its retained prior planning state as soon as both projections agree

#### Scenario: Match equivalent synchronized terminal timestamps
- **WHEN** a local task projection and its authoritative history snapshot encode the same completion, cancellation, or deletion instant with different valid ISO time-zone spellings
- **THEN** Tasks treats those terminal timestamps as equal for guarded undo while continuing to reject malformed values and genuinely different instants

#### Scenario: Redo an undone completion
- **WHEN** a user undoes a completion and then invokes redo without an intervening forward mutation
- **THEN** Tasks reapplies the exact completion event and returns the task to Done

#### Scenario: Invoke redo with either standard chord
- **WHEN** a user presses Command-Y or Command-Shift-Z on Mac, or Control-Y or Control-Shift-Z on Windows
- **THEN** Tasks captures the command before the browser or an editable field and traverses the same redo cursor

#### Scenario: Reach an unavailable history boundary
- **WHEN** undo or redo has no cursor entry, or its next historical state can no longer satisfy current task invariants
- **THEN** Tasks performs no mutation and shows an ordinary Nothing to Undo or Nothing to Redo toast without destructive styling

#### Scenario: Cancel a failed reservation
- **WHEN** a reserved forward mutation fails before acceptance
- **THEN** Tasks cancels that reservation, restores the visible task state, and does not let a later undo substitute an older or unrelated history event for the failed mutation

#### Scenario: Include all editable task metadata
- **WHEN** a user changes any task field or state that Tasks permits them to edit, including title, notes, link, planning, organization, actionability, Deadline, completion, cancellation, deletion, reopening, or restoration
- **THEN** the accepted mutation participates in the same guarded undo and redo chain

### Requirement: Directly recoverable Done task controls
Done SHALL present retained completed, canceled, and deleted tasks as fully inspectable, editable, selectable, recoverable, and explicitly removable task states, grouped by their owner-local terminal-entry day and never drag-reorderable. Done MUST NOT present deleted checklist items as list entries, while their deletion history remains available to undo.

#### Scenario: Delete a task from its menu
- **WHEN** a user activates Delete in a task's ellipsis menu outside Done
- **THEN** Tasks recoverably deletes the task hierarchy and presents its root in Done as trashed

#### Scenario: Delete an open task
- **WHEN** a task is open and the user presses Command+Delete on Mac or the corresponding Windows shortcut
- **THEN** Tasks closes and recoverably deletes that task while unmodified Delete remains field-local

#### Scenario: Delete a focused task
- **WHEN** a closed whole-task-focused task receives Delete or the platform Command+Delete equivalent outside a text-entry control
- **THEN** Tasks recoverably deletes that task

#### Scenario: Delete selected tasks
- **WHEN** a user presses Delete with one or more tasks explicitly selected outside Done
- **THEN** Tasks applies the guarded recoverable deletion transition to every selected task and retains each accepted deletion in task history

#### Scenario: Reopen a completed task by unchecking it
- **WHEN** Done presents a completed present task
- **THEN** its leading control is a semantic-green Lucide `SquareCheck`, and activating that control reopens the task according to its current planning metadata

#### Scenario: Reopen a canceled task
- **WHEN** Done presents a canceled present task
- **THEN** its leading control communicates cancellation and activating it reopens the task through the same guarded lifecycle path

#### Scenario: Reopen a deleted task from its terminal control
- **WHEN** Done presents a recoverably deleted task root
- **THEN** its leading icon-only control persistently shows a neutral-gray Lucide `SquareX`, is labeled `Reopen`, and reopens the task through the existing hierarchy-safe transition according to its current planning metadata

#### Scenario: Offer Done task actions
- **WHEN** a user opens the ellipsis menu for a completed, canceled, or deleted task in Done
- **THEN** the menu offers `Reopen` and `Delete Permanently...`

#### Scenario: Preview permanent deletion
- **WHEN** a user activates `Delete Permanently...` for a retained Done task
- **THEN** Tasks obtains the owner-authorized server scope and presents a destructive confirmation containing the task identity and the number of records that will be erased
- **AND** no task data is erased before confirmation

#### Scenario: Confirm permanent deletion
- **WHEN** a user confirms a fresh permanent-deletion preview for a retained completed, canceled, or deleted task
- **THEN** the server permanently erases that task content graph, preserves only required content-free safety receipts, and converges the removal to synchronized clients

#### Scenario: Reject ineligible or stale permanent deletion
- **WHEN** permanent deletion targets an active task, a task owned by another user, an unsupported root, or a scope changed since preview
- **THEN** the server rejects the request without deleting task data and Tasks reports the failure

#### Scenario: Hide deleted checklist items
- **WHEN** checklist-item deletion history remains available for undo
- **THEN** Done does not render those checklist items, a deleted checklist section, or a non-empty state based only on those hidden records

#### Scenario: Open and edit a terminal task
- **WHEN** a retained completed, canceled, or deleted task appears in Done
- **THEN** the user can open its ordinary drawer and edit every ordinarily editable metadata field without implicitly recovering it

#### Scenario: Select terminal tasks together
- **WHEN** Done contains completed, canceled, or deleted tasks
- **THEN** whole-task focus, single selection, multi-selection, and eligible bulk recovery treat them as peer task rows

#### Scenario: Present terminal bulk actions
- **WHEN** one or more completed, canceled, or deleted tasks are selected in Done and the user opens Edit
- **THEN** Tasks offers Area, Actionability, and Reopen, keeps the Area and Actionability submenus operable, omits recoverable Delete, and does not offer terminal-ineligible Start or Deadline actions

#### Scenario: Reopen a mixed terminal selection
- **WHEN** the user chooses Reopen for a selection containing any mix of completed, canceled, and deleted tasks
- **THEN** Tasks reopens completed and canceled tasks, restores deleted task hierarchies, clears the terminal metadata that kept every successful task in Done, and treats the bulk request as one user operation

#### Scenario: Bulk edit terminal organization metadata
- **WHEN** the user chooses an Area or Actionability value for selected Done tasks
- **THEN** Tasks applies the value atomically to every selected task without reopening it or removing it from Done

#### Scenario: Preserve task-row interaction in Done
- **WHEN** a retained task appears in Done
- **THEN** its title, source link, terminal date, whole-task focus, selection behavior, direct recovery control, and permanent-deletion menu remain operable

#### Scenario: Group terminal work by day
- **WHEN** Done presents retained terminal tasks
- **THEN** it buckets them by the owner-local date on which each task was completed, canceled, or deleted and orders the newest bucket first

#### Scenario: Prohibit Done reordering
- **WHEN** a user views Done
- **THEN** Tasks exposes no single-task or multi-task drag reordering

#### Scenario: Explain Done retention
- **WHEN** a user views Done
- **THEN** a subtle footer states that items in Done are permanently deleted after 30 days

#### Scenario: Retain terminal work for purge
- **WHEN** a task is completed, canceled, or deleted
- **THEN** its existing completion, cancellation, or deletion timestamp remains the Done grouping and 31-day retention timestamp until the task is recovered, manually deleted permanently, or automatically purged

### Requirement: Project-Free Task Hierarchy
The Tasks module SHALL organize active owner work through optional Areas, tasks, and task checklist items without a Project entity, Project relationship, Project planning root, or Project-specific application surface.

#### Scenario: Organize a task directly in an Area
- **WHEN** a user assigns an owned Area to a task
- **THEN** the task stores that Area directly and every list, sort, search, clipboard, automation, and metadata projection derives organization from that Area alone

#### Scenario: Leave a task unassigned
- **WHEN** a user clears the Area from a task
- **THEN** the task becomes directly unassigned without another container relationship

#### Scenario: Retire Project surfaces
- **WHEN** a user opens Tasks after the project-free release
- **THEN** navigation, creation, editing, planning lists, Quick Find, templates, reminders, recurrence, recovery, command references, and metadata expose no Project entity or Project action

#### Scenario: Redirect a retired Project route
- **WHEN** a browser opens `/tasks/projects` or a former Project detail URL
- **THEN** Tasks replace-navigates to `/tasks/anytime` without rendering a Project view or falling through to another module

### Requirement: Project-Free Production Contraction
The production Tasks data model SHALL remove Project and Template persistence only after a verified private backup and exact dependency audits, SHALL delete the authorized disposable records, and SHALL preserve all ordinary non-Project task instances and recurrence prototypes.

#### Scenario: Apply the approved destructive migration
- **WHEN** production matches the exact preflight for Projects, templates, recurrence definitions, future projections, and ordinary instances
- **THEN** the migration removes obsolete Project and Template persistence, converts recurrence prototypes, deletes only authorized disposable or legacy projection rows, and leaves ordinary task instances unchanged

#### Scenario: Fail closed on unexpected dependency content
- **WHEN** an exact Project, Template, or recurrence conversion assertion does not match at migration time
- **THEN** the transaction aborts before deleting or altering owner data

#### Scenario: Synchronize the contracted topology
- **WHEN** the template-free recurrence release is deployed
- **THEN** PowerSync publishes and projects exactly 17 approved Tasks tables and no client upload or read path references Projects or Templates

### Requirement: Project-Free Portable Tasks
Current Tasks exports SHALL use schema version 14 without Project or Template collections or references, and supported legacy exports SHALL normalize Project-contained tasks and template-backed recurrence prototypes without recreating retired wrappers.

#### Scenario: Export current template-free data
- **WHEN** the user creates a Tasks backup after the migration
- **THEN** the schema-14 envelope contains no Project or Template collection, identifier, provenance, reminder root, or recurrence template reference

#### Scenario: Restore a legacy Project task
- **WHEN** a supported legacy backup contains a task assigned to a Project
- **THEN** restore preserves the task and assigns the Project's Area directly when present, otherwise leaves the task unassigned, and creates no Project

#### Scenario: Discard a standalone legacy template
- **WHEN** a supported legacy backup contains a template that is not required by a recurrence
- **THEN** normalization excludes the template and its instantiation history and reports the deterministic removal without generating a task

#### Scenario: Convert a legacy recurrence snapshot
- **WHEN** a supported legacy backup contains a recurrence whose current revision references a valid template revision
- **THEN** normalization stores that snapshot on the recurrence revision and restores no reusable Template entity

#### Scenario: Reject an incomplete legacy recurrence snapshot
- **WHEN** a legacy recurrence references a missing or invalid template revision
- **THEN** restore preview fails closed with no owner data mutation

### Requirement: Task-Only Planning Roots
Tasks SHALL allow only ordinary tasks to own planning reminders and spawned-instance state, while recurrence definitions and revisions own recurrence prototype content and schedule without a Project or Template root.

#### Scenario: Save task-owned reminder planning
- **WHEN** the user or an authorized integration saves a reminder for ordinary work
- **THEN** the root resolves to a task and no Project or Template discriminator or identifier is accepted

#### Scenario: Save a recurrence prototype
- **WHEN** the user creates or edits repeating work
- **THEN** the definition and immutable current revision store the prototype content and cadence without creating a reusable Template entity or future task row

#### Scenario: Reject a retired Project or Template root
- **WHEN** a stale client or payload requests a Project or Template reminder, recurrence, hierarchy transition, instantiation, or organization assignment
- **THEN** the current database or application boundary rejects the unsupported contract without mutating owner data

### Requirement: Explicit Yearly Recurrence Cadence
Tasks SHALL support fixed-date, last-day-of-month, and ordinal-weekday yearly recurrence rules in both client preview and authoritative server evaluation.

#### Scenario: Repeat on a fixed yearly date
- **WHEN** a yearly recurrence specifies a month and calendar day
- **THEN** each eligible year schedules on that fixed date, clamped only when the date is not present in the year

#### Scenario: Repeat on an ordinal weekday of a month
- **WHEN** a yearly recurrence specifies an ordinal weekday and month such as the second Sunday of May
- **THEN** each eligible year schedules on the matching weekday occurrence in that month

#### Scenario: Repeat on the last day of a month
- **WHEN** a yearly recurrence specifies the last day of a fixed month
- **THEN** each eligible year schedules on that month's final calendar day

#### Scenario: Preserve yearly preview parity
- **WHEN** a yearly fixed-date or ordinal-weekday rule is previewed and later evaluated by the server
- **THEN** both paths produce the same bounded sequence of dates

### Requirement: Empty task drafts leave the list smoothly
Tasks SHALL animate the removal of a newly created task draft that remains empty when its editor closes, while preserving the rule that an empty draft is not retained.

#### Scenario: Close an empty new task
- **WHEN** a user closes a new task whose editable metadata and checklist contain no retained content
- **THEN** the row completes the standard task departure animation before disappearing from the visible list

#### Scenario: Respect reduced motion
- **WHEN** the user prefers reduced motion and closes an empty draft
- **THEN** the empty task is removed without a prolonged animation

### Requirement: Touch task rows expose directional swipe actions
On touch input, Tasks SHALL translate the swiped task row responsively, reveal a directional action icon in the exposed gap, invoke selection from a qualifying left swipe, and invoke the task's Start planning picker from a qualifying right swipe.

#### Scenario: Swipe left for selection
- **WHEN** a touch user drags a closed task row left beyond the qualifying horizontal threshold without the gesture becoming a vertical scroll
- **THEN** the row follows the gesture, reveals the selection affordance, returns to rest, and enters task selection mode with that task selected

#### Scenario: Swipe right for Start planning
- **WHEN** a touch user drags a closed task row right beyond the qualifying horizontal threshold without the gesture becoming a vertical scroll
- **THEN** the row follows the gesture, reveals the Start affordance, returns to rest, and opens the ordinary Start picker scoped to that task

#### Scenario: Cancel an incomplete swipe
- **WHEN** a touch gesture ends before either directional threshold or becomes predominantly vertical
- **THEN** the row returns to its resting position without invoking selection or planning

### Requirement: Summary supports forward cursor traversal into Notes
Tasks SHALL move editing focus from Summary to the start of Notes when the user presses unmodified Right Arrow with a collapsed selection at the end of Summary.

#### Scenario: Move from Summary to Notes
- **WHEN** Summary is editing, its selection is collapsed at the end of the value, and the user presses unmodified Right Arrow
- **THEN** Notes becomes focused with its insertion point at position zero

#### Scenario: Preserve ordinary Summary cursor movement
- **WHEN** Summary has a range selection, the insertion point is not at the end, composition is active, or a command modifier is held
- **THEN** Right Arrow retains its ordinary text-editing behavior

### Requirement: Task Primary Link actions use canonical external-link iconography
Tasks SHALL use canonical protocol-specific identity icons for Primary Links in task rows, the metadata-editor decoration, and native widgets, defaulting to Lucide `Link2` or its closest native equivalent. Task-row and native-widget Primary Link identity icons SHALL use the semantic blue link treatment, while the metadata editor's adjacent launch action SHALL always use Lucide `ExternalLink`.

#### Scenario: Show a generic Primary Link
- **WHEN** a task has a generic HTTP or HTTPS Primary Link
- **THEN** its task-row and metadata-input decoration use Lucide `Link2`, its widget representation uses the closest native chain-link symbol, and the task-row and widget identity icons use their platform's semantic blue link color

#### Scenario: Show a Mail message link
- **WHEN** a task Primary Link uses the recognized Mail message protocol
- **THEN** the task row, metadata-input decoration, and widget retain the established Mail message icon, and the task-row and widget identity icons use their platform's semantic blue link color

#### Scenario: Show a Jira link
- **WHEN** a task Primary Link uses the Jira protocol or a recognized Jira HTTP or HTTPS URL
- **THEN** every task-row and metadata-input decoration uses Lucide `Zap`, native widgets use the closest native system rendering, the task-row and widget identity icons use their platform's semantic blue link color, and activation opens the configured browser or registered Jira application as appropriate

#### Scenario: Show an Obsidian link
- **WHEN** a task Primary Link uses the Obsidian protocol
- **THEN** every task-row and metadata-input decoration uses Lucide `FileText`, native widgets use the closest native system rendering, the task-row and widget identity icons use their platform's semantic blue link color, and activation opens the registered Obsidian application

#### Scenario: Keep the launch action stable
- **WHEN** a nonblank Primary Link appears in an expanded task
- **THEN** the activation control beside the Primary Link input always uses Lucide `ExternalLink` regardless of the Primary Link's identity icon

#### Scenario: Omit the Primary Link slot after clearing a captured link
- **WHEN** a task retains Mail or other typed source provenance but its editable Primary Link is null, blank, malformed, or otherwise not actionable
- **THEN** its task row renders no icon in the Primary Link slot and does not synthesize an icon from source provenance

### Requirement: Settled Task List Transitions
The system SHALL conceal stale or partially projected task rows while navigating from one Tasks planning list to another and SHALL reveal the destination list only after its watched query has settled.

#### Scenario: Navigate between planning lists
- **WHEN** a user navigates from Today, Upcoming, Anytime, Someday, or Done to a different one of those planning lists
- **THEN** the destination route and navigation state update immediately
- **AND** the list content presents a brief loading state instead of rows derived from the previous list's query result
- **AND** the destination rows appear together after the destination query settles

#### Scenario: Use any navigation input
- **WHEN** a user changes planning lists by a navigation link, pointer action, or supported keyboard shortcut
- **THEN** the same route-driven settled transition behavior applies

#### Scenario: Refresh the current planning list
- **WHEN** PowerSync re-evaluates the watched query without a planning-list route change
- **THEN** the currently rendered rows remain visible unless the query enters its existing initial-loading or error state

### Requirement: Native new-task capture presents visible Summary editing focus
Tasks SHALL visibly identify the Summary field and insertion point while a declared native host's keyboard bridge accepts initial new-task typing.

#### Scenario: Begin a new task from a native creation action
- **WHEN** a native creation action opens a blank task and the native keyboard bridge accepts Summary input
- **THEN** the Summary input displays the standard focused border and ring
- **AND** a visible caret appears at the end of the current Summary value while mirrored typing continues to update that field

#### Scenario: Enter ordinary WebKit editing
- **WHEN** the user directly taps the Summary input after native capture begins
- **THEN** the synthetic native-capture focus presentation ends and WebKit presents its ordinary text cursor and focus state

### Requirement: Open tasks use one darker editor surface
Tasks SHALL present the summary row and metadata drawer of an open task as one continuous semantic surface that remains darker than the shared floating mobile navigation.

#### Scenario: Open a task beneath mobile navigation
- **WHEN** a task editor is open and the floating mobile navigation overlaps its viewport area
- **THEN** the task summary and metadata drawer share the same darker background
- **AND** the lighter translucent navigation remains visually distinct above the task

#### Scenario: Preserve closed and selected task treatments
- **WHEN** a task is closed, keyboard-focused, or selected for bulk actions
- **THEN** Tasks retains the established closed, focus, and selection treatments rather than applying the open-editor surface

### Requirement: Touch Pull-Down Quick Find
Task list views SHALL let a touch user reveal and open Quick Find by pulling down from the top of the page.

#### Scenario: Reveal pull progress
- **WHEN** a touch starts while the task list is scrolled to the top and moves downward
- **THEN** a magnifying-glass indicator fades into view in proportion to the pull distance and the list follows with bounded damped displacement

#### Scenario: Open after threshold
- **WHEN** the user releases the pull after crossing the activation threshold
- **THEN** Tasks opens the existing Quick Find dialog, places text focus in its query input inside the releasing user gesture, and requests the touch software keyboard

#### Scenario: Release before threshold
- **WHEN** the user releases before crossing the activation threshold
- **THEN** the indicator and list smoothly retract and Quick Find remains closed

#### Scenario: Do not enable on non-touch devices
- **WHEN** the current device has no touch capability
- **THEN** Tasks does not install or render the pull-down Quick Find interaction

### Requirement: Touch List Edge Elasticity
Task list views SHALL provide bounded native-feeling visual elasticity at the top and bottom edge on touch devices without custom scrolling or displacement of fixed controls.

#### Scenario: Pull beyond the top
- **WHEN** a touch user drags downward while the list is already at its top boundary
- **THEN** the scroll content follows with damped capped displacement and returns smoothly when released

#### Scenario: Pull beyond the bottom
- **WHEN** a touch user drags upward while the list is already at its bottom boundary
- **THEN** the scroll content follows with damped capped displacement and returns smoothly when released

#### Scenario: Preserve ordinary native scrolling
- **WHEN** list content remains scrollable in the gesture direction
- **THEN** Tasks leaves movement and momentum to the browser's native scrolling behavior

#### Scenario: Keep floating controls fixed
- **WHEN** the list content is elastically displaced
- **THEN** mobile navigation, the floating Add button, selection controls, dialogs, and other viewport-fixed surfaces remain stationary

### Requirement: Reached-Start Order After Midnight
The owner-local activation process SHALL preserve the Upcoming order of newly reached starts while placing them after unfinished Today tasks rolled into the new day's Inbox.

#### Scenario: Roll unfinished Today work first
- **WHEN** owner-local midnight is crossed with unfinished Today work and newly reached future starts
- **THEN** the system first retains the unfinished work in Inbox in its prior Today order

#### Scenario: Append newly reached starts
- **WHEN** the same activation processes tasks whose Start has reached the new planning date
- **THEN** it clears their Start, assigns Inbox, and places them after the rolled-over Inbox tail

#### Scenario: Preserve Upcoming order
- **WHEN** multiple ordinary and recurrence-projection tasks reach their Start together
- **THEN** their relative Today Inbox order matches their final manual order in the controlling Upcoming date section

#### Scenario: Keep activation idempotent
- **WHEN** the activation process retries for the same owner and planning date
- **THEN** it does not reorder already activated work or duplicate recurrence instances

### Requirement: Selection Completion Language
The Tasks selection toolbar SHALL label its explicit selection-mode exit action `Done`.

#### Scenario: Finish selection mode
- **WHEN** selection mode is active with zero or more selected tasks
- **THEN** the fixed selection toolbar presents `Done` as its exit action

#### Scenario: Activate Done
- **WHEN** the user activates the selection toolbar's Done action
- **THEN** Tasks clears selection state and exits selection mode without changing task lifecycle

### Requirement: Visible List Search Action
Every Tasks list view SHALL expose a top-right Search button that opens Quick Find.

#### Scenario: Open from the list header
- **WHEN** the user activates the Search button on a task list
- **THEN** the existing Quick Find dialog opens

#### Scenario: Omit from Settings
- **WHEN** the user views Tasks Settings
- **THEN** the list Search button and pull-down Quick Find gesture are absent

### Requirement: Start Reminder Whole-Hour Menu
The Tasks unified Start picker SHALL pair its editable Reminder input with a keyboard-accessible alarm action that is visibly presented as a button appended to the input and offers every currently legal whole-hour reminder choice without committing or closing the containing Start picker.

#### Scenario: Present an appended alarm button
- **WHEN** the unified Start picker renders the Reminder input
- **THEN** the alarm action is separated from the editable field by a visible left border and reads as an appended input-group button rather than a passive field decoration

#### Scenario: Offer every hour for a future Start
- **WHEN** a task has a future Start Date and the user opens the Reminder hour menu
- **THEN** the menu offers each whole hour from 12:00 am through 11:00 pm in chronological order

#### Scenario: Offer only remaining whole hours for Today
- **WHEN** a task has a Today horizon, the owner-local current time is 1:54 pm, and the user opens the Reminder hour menu
- **THEN** the menu offers 2:00 pm through 11:00 pm and omits every elapsed or current-hour choice

#### Scenario: Apply Today rules before Start exists
- **WHEN** a task has no Start intent and the user opens the Reminder hour menu
- **THEN** the menu applies the same remaining-hours rule as Today because choosing a reminder will first assign Today Inbox

#### Scenario: Disable an exhausted Today menu
- **WHEN** a task has no Start or a Today Start and no whole hour remains later than the current owner-local moment
- **THEN** the alarm action is disabled with a visibly muted button state while freeform Reminder entry remains available for any later valid minute

#### Scenario: Open the nested menu without committing Start
- **WHEN** focus is on the enabled alarm action and the user presses Enter or Space
- **THEN** Tasks opens the whole-hour menu, keeps Start open, and gives the nested menu ownership of its arrow, activation, and Escape keys

#### Scenario: Select one whole-hour reminder
- **WHEN** the user activates an offered hour by pointer, Enter, or Space
- **THEN** Tasks saves that canonical reminder through the existing reminder contract, displays its normalized time, closes only the hour menu, and leaves Start open

#### Scenario: Traverse from Reminder to the alarm action
- **WHEN** keyboard focus is in Reminder with a collapsed text selection at the end and the user presses Right Arrow
- **THEN** focus moves to the enabled alarm action without committing Start

#### Scenario: Preserve native Reminder cursor movement
- **WHEN** keyboard focus is in Reminder before the end of its value and the user presses Right Arrow
- **THEN** the text cursor moves natively within Reminder and focus does not move to the alarm action

#### Scenario: Return from the alarm action to Reminder
- **WHEN** focus is on the alarm action and the user presses Left Arrow
- **THEN** focus returns to Reminder with the text cursor at the end of its value

#### Scenario: Keep the hour menu within the viewport
- **WHEN** the available whole-hour choices exceed the visible vertical space
- **THEN** the hour menu remains within the available viewport and scrolls its options without resizing the Start picker

### Requirement: Dependable web view-navigation commands
The system SHALL provide Control+1 through Control+6 as the documented web commands for the six primary Tasks views on Mac and Windows, while compatible Mac browsers MAY continue to accept Command+1 through Command+6 as aliases.

#### Scenario: Navigate with Control-number on Mac web surfaces
- **WHEN** the user presses Control+1, Control+2, Control+3, Control+4, Control+5, or Control+6 on a Mac browser or installed web app
- **THEN** Tasks navigates to Today, Upcoming, Anytime, Someday, Done, or Config respectively
- **AND** suppresses the matching page-level action

#### Scenario: Navigate with Control-number on Windows web surfaces
- **WHEN** the user presses Control+1, Control+2, Control+3, Control+4, Control+5, or Control+6 on Windows
- **THEN** Tasks navigates to Today, Upcoming, Anytime, Someday, Done, or Config respectively
- **AND** suppresses the matching page-level action

#### Scenario: Preserve a delivered Command-number alias
- **WHEN** a Mac browser delivers Command+1 through Command+6 to the mounted Tasks route
- **THEN** Tasks navigates to the corresponding primary view and suppresses the matching page-level action

#### Scenario: Describe the reliable web shortcut
- **WHEN** the user opens Keyboard Commands in the web application or an installed PWA
- **THEN** View Navigation shows Control+1 through Control+6 for both Mac and Windows
- **AND** does not advertise Command-number as a dependable web command

### Requirement: Progressive Start Command Focus
The Tasks module SHALL let the Start keyboard command traverse increasingly later Start choices without changing task metadata until the user activates the focused choice.

#### Scenario: Focus the current Start choice
- **WHEN** Control+E on Mac or Alt+Shift+E on Windows opens Start for one eligible task
- **THEN** keyboard focus lands on the task's current Today horizon or future calendar Start date

#### Scenario: Begin an unplanned task at Inbox
- **WHEN** the Start command opens Start for a task with no Today horizon, future Start date, or Someday destination
- **THEN** keyboard focus begins on Today Inbox

#### Scenario: Advance from Today directly to tomorrow
- **WHEN** the Start picker is open with focus on Inbox, Now, Next, or Later and the user invokes the Start command again
- **THEN** focus advances directly to tomorrow without visiting another Today horizon or committing a Start value

#### Scenario: Advance through future dates
- **WHEN** the Start picker is open with focus on a future calendar date and the user invokes the Start command again
- **THEN** focus advances to the next selectable future calendar date without committing a Start value

#### Scenario: Advance across a calendar month
- **WHEN** the Start command advances focus from the final day of a displayed month
- **THEN** the calendar first displays the following month and then focuses its first selectable day

#### Scenario: Resume advancement after manual date navigation
- **WHEN** the user moves calendar focus with arrow keys and the next Start-command step is a date that the command previously focused
- **THEN** the Start command focuses that date again and continues its chronological traversal without committing a Start value

#### Scenario: Activate the traversed choice explicitly
- **WHEN** the user presses Enter or Space on a Start choice reached through command traversal
- **THEN** Tasks applies that horizon or date through the ordinary Start planning action and closes the picker

### Requirement: Task Temporal Picker Entry Points
The Tasks module SHALL reuse its complete Start picker and ordinary Deadline picker content across expanded-editor, task-menu, focused-task command, and selection-mode command entry points without adding alternate temporal forms.

#### Scenario: Open an anchored Start picker from a task menu
- **WHEN** a user activates Start from an active task's ellipsis menu
- **THEN** Tasks aligns that task's summary row as close as possible to the top of the visible content area and opens the complete Start picker centered beneath the summary row without a dialog title, descriptive header, or close button

#### Scenario: Open an anchored Deadline picker from a task menu
- **WHEN** a user activates Deadline from an active task's ellipsis menu
- **THEN** Tasks aligns that task's summary row as close as possible to the top of the visible content area and opens the same Deadline calendar and Clear action used by the expanded editor centered beneath the summary row without additional modal chrome

#### Scenario: Open a temporal picker for a keyboard-focused task
- **WHEN** Control+E or Control+D on Mac, or the corresponding Alt+Shift command on Windows, targets one keyboard-focused closed task outside selection mode
- **THEN** Tasks leaves the metadata drawer closed, aligns the task summary row near the visible content top, and opens the corresponding Start or Deadline picker beneath that row

#### Scenario: Open a centered temporal picker for selected tasks
- **WHEN** Control+E or Control+D on Mac, or the corresponding Alt+Shift command on Windows, targets one or more tasks in selection mode
- **THEN** Tasks preserves the list scroll position and presents the corresponding shared picker content centered in the viewport for the complete selection

#### Scenario: Continue advancing an open Start picker
- **WHEN** Control+E or its corresponding Windows command is pressed while the complete Start picker is already open
- **THEN** Tasks advances the picker's current Start focus under the existing Start advancement contract instead of reopening or relocating the picker

#### Scenario: Continue advancing an open Deadline picker
- **WHEN** Control+D or its corresponding Windows command is pressed while a single-task or selection-mode Deadline picker is already open
- **THEN** Tasks keeps the picker open and advances keyboard focus to the next calendar date without committing a Deadline

#### Scenario: Advance Deadline across a calendar month
- **WHEN** repeated Deadline-command advancement moves beyond the final day of the displayed month
- **THEN** Tasks displays the following month and focuses its first day without committing a Deadline

### Requirement: Stable Open-Task Area Changes
The Tasks module SHALL preserve the active editor field and the open task's rendered placement while an Area command changes its Area.

#### Scenario: Preserve field focus
- **WHEN** the user invokes the Area command while a field in an open task is focused
- **THEN** the Area changes without moving keyboard focus or the text caret from that field

#### Scenario: Defer visible Area rebucketing
- **WHEN** an open task's Area changes on a list with visible Area buckets
- **THEN** the task remains in its current rendered bucket until the task closes

#### Scenario: Defer invisible automatic sorting
- **WHEN** an open task's metadata changes an invisible automatic-sort bucket
- **THEN** the task retains its rendered placement until the task closes

### Requirement: Editor-Owned Undo and Redo
Focused task-editing controls SHALL own undo and redo without also invoking the Tasks module's global history command.

#### Scenario: Undo inside a task field
- **WHEN** Summary, Notes, Primary Link, or a checklist item is focused and the user invokes undo
- **THEN** only that editor's content history changes and the global task undo action does not also run

#### Scenario: Redo inside a task field
- **WHEN** a task-editing control is focused and the user invokes redo
- **THEN** only that editor's content history changes and the global task redo action does not also run

#### Scenario: Undo outside an editor
- **WHEN** no editable task control is focused and the user invokes undo or redo
- **THEN** Tasks applies the corresponding persisted task-history action

### Requirement: Layered Task Escape
Escape SHALL dismiss exactly the deepest active task-editing layer.

#### Scenario: Close an inner surface first
- **WHEN** a picker, menu, popover, dialog, or checklist selection surface is active inside an open task and the user presses Escape
- **THEN** that inner surface closes or cancels while the task remains open

#### Scenario: Close the task next
- **WHEN** a task is open with no deeper surface owning Escape and the user presses Escape
- **THEN** the task closes and whole-task focus returns to its row

### Requirement: Contextual Floating Task Creation
The Tasks module SHALL fade and disable the floating task-creation action while any task metadata drawer is open.

#### Scenario: Hide creation while adding or editing
- **WHEN** a new or existing task's metadata drawer opens
- **THEN** the floating task-creation action fades out and cannot receive focus or activation

#### Scenario: Restore creation after editing
- **WHEN** the open task metadata drawer closes
- **THEN** the floating task-creation action fades back into view and becomes available again

### Requirement: Unified Task Highlight
The Tasks module SHALL render open, keyboard-focused, and selected tasks with the same subdued blue highlight surface.

#### Scenario: Highlight the complete open task
- **WHEN** a task metadata drawer opens
- **THEN** the task summary row and metadata drawer share a darker blue task-highlight background that preserves contrast for muted controls, links, and text

#### Scenario: Highlight keyboard focus and selection
- **WHEN** a task receives whole-row keyboard focus or is selected in selection mode
- **THEN** the task row uses the same subdued blue background opacity as an open task

#### Scenario: Restore the closed-row surface
- **WHEN** the task metadata drawer closes
- **THEN** the task returns to the ordinary closed-row background unless another focus or selection state applies

### Requirement: Resilient Local Planning Writes
The Tasks module SHALL recover task-planning commands from a recognized transient browser OPFS access-handle conflict without duplicating the requested mutation or indefinitely retrying.

#### Scenario: Recover a clear-Start command
- **WHEN** clearing a task's Start date initially fails because `createSyncAccessHandle` reports another open access handle or writable stream for the same local database file
- **THEN** Tasks retries the complete atomic planning transaction on a short bounded schedule
- **AND** a successful retry applies the Start-date change without showing an error toast

#### Scenario: Preserve genuine planning failures
- **WHEN** a planning transaction fails for any other reason or still encounters the recognized conflict after the bounded retry schedule is exhausted
- **THEN** Tasks stops retrying and surfaces that failure through the existing error handling

### Requirement: Task metadata controls use semantic leading decorations
The expanded Tasks metadata drawer SHALL identify its unlabeled single-line controls with pinned muted leading decorations while retaining placeholders and programmatic names.

#### Scenario: Decorate Primary Link
- **WHEN** the Primary Link input is visible
- **THEN** its decoration uses the recognized Mail, Jira, or Obsidian icon when applicable and otherwise uses Lucide `Link2`

#### Scenario: Decorate Start
- **WHEN** Start is empty or contains a future date
- **THEN** its decoration uses Lucide `Play`

#### Scenario: Decorate a Today Start
- **WHEN** Start represents Today
- **THEN** its decoration uses the task's current horizon-specific icon and semantic horizon color

#### Scenario: Decorate Deadline and Area
- **WHEN** Deadline or Area is visible
- **THEN** Deadline uses Lucide `Flag` and Area uses the canonical Lucide `Layers3` Area icon

#### Scenario: Emphasize an urgent Deadline control
- **WHEN** Deadline contains the owner-local planning date or an earlier date
- **THEN** its Lucide `Flag` decoration and visible date value use the same semantic destructive red as urgent Deadline metadata in a task row

#### Scenario: Keep a future Deadline control neutral
- **WHEN** Deadline is empty or contains a date later than the owner-local planning date
- **THEN** its decoration and visible value retain their ordinary muted or foreground control colors

#### Scenario: Decorate Actionability
- **WHEN** Actionability is visible
- **THEN** its decoration uses the current actionability value's canonical icon, including Lucide `ArrowBigRightDash` for Ready

#### Scenario: Emphasize a non-Ready Actionability decoration
- **WHEN** Actionability is Waiting or Rechecking
- **THEN** its decoration uses the same semantic purple as the corresponding task-row metadata

#### Scenario: Keep a Ready Actionability decoration neutral
- **WHEN** Actionability is Ready
- **THEN** its decoration retains the ordinary muted control-icon color

### Requirement: Task completion boxes use neutral color
Ordinary open task and checklist completion controls SHALL use the established neutral gray and SHALL NOT turn green on hover, while a checked to-do SHALL use semantic success green as visible completion confirmation. Checked checklist items SHALL remain neutral gray.

#### Scenario: Hover an ordinary completion box
- **WHEN** a user points at an open or checked task or checklist completion box
- **THEN** its icon retains its current state color rather than changing color because of hover

#### Scenario: Present a checked to-do
- **WHEN** a to-do is shown as checked after pointer activation, keyboard-command activation, optimistic completion feedback, or persisted completion
- **THEN** its contained checked-square icon uses semantic success green

#### Scenario: Present an open to-do
- **WHEN** a to-do is open and not awaiting completion
- **THEN** its open-square icon uses the established neutral gray

#### Scenario: Present a checked checklist item
- **WHEN** a checklist item is shown as checked
- **THEN** its checked-square icon uses the same neutral gray family as its unchecked-square icon

#### Scenario: Preserve selection-mode color
- **WHEN** task or checklist selection mode replaces completion boxes with selection circles
- **THEN** those selection controls retain their established information-blue selection styling

### Requirement: Start-picker actions use compact label-free layout
The Tasks Start picker SHALL present Reminder as a full-width decorated input without a visible field label and SHALL center the Clear and Someday action labels.

#### Scenario: Present Reminder
- **WHEN** the Start picker renders Reminder
- **THEN** the ordinary time input fills its available row, uses the Bell decoration and Reminder placeholder, retains a nonempty programmatic name, and presents no visible Reminder label

#### Scenario: Present terminal Start actions
- **WHEN** the Start picker renders Clear and Someday
- **THEN** each action keeps its icon while centering its visible label within its available action area

### Requirement: Metadata departure feedback
Tasks SHALL show neutral, informative feedback after a successful metadata mutation causes a previously visible to-do to leave the current list or stop matching the active quick filter.

#### Scenario: A metadata change moves one task out of the current list
- **WHEN** a successful metadata mutation makes a to-do that belonged to the current list no longer eligible for that list
- **THEN** Tasks shows one neutral toast identifying that the task moved and the canonical list where it can now be found

#### Scenario: A metadata change hides one task behind the active filter
- **WHEN** a successful metadata mutation leaves a to-do eligible for the current list but makes it stop matching the active non-All quick filter
- **THEN** Tasks shows one neutral toast identifying the active quick filter that hid the task

#### Scenario: An open task departs after closing
- **WHEN** metadata edited in an open, retained task would move or filter that task out of the current view
- **THEN** Tasks retains the task while its drawer is open and shows the final departure notice when the drawer closes and the task leaves the rendered view

#### Scenario: A later edit restores eligibility before closing
- **WHEN** an open task first receives a departing metadata change and then receives another successful metadata change that restores current list and filter eligibility before closing
- **THEN** Tasks clears the pending departure notice and does not show a stale toast when the drawer closes

#### Scenario: A bulk metadata change affects several selected tasks
- **WHEN** one accepted bulk metadata action moves or filters multiple selected to-dos out of the current view
- **THEN** Tasks shows summarized neutral departure feedback for the accepted batch rather than one toast per to-do

#### Scenario: A metadata change remains visible
- **WHEN** a successful metadata mutation leaves every affected to-do eligible for the current list and active quick filter
- **THEN** Tasks does not show a departure toast

### Requirement: Recoverable Tasks runtime startup
The Tasks module SHALL automatically replace a local database client that is discovered to have already been closed during startup, SHALL bound that automatic recovery to one attempt per startup episode, and SHALL preserve the durable local database and queued mutations.

#### Scenario: Closed client is replaced automatically
- **WHEN** Tasks initialization fails because its PowerSync client has already been closed
- **THEN** Tasks keeps the loading view visible, retires that client generation, creates one fresh client against the same durable local database, and retries initialization without asking the user to intervene

#### Scenario: Replacement client opens successfully
- **WHEN** the one automatic replacement initializes successfully
- **THEN** Tasks opens normally without showing an error and without clearing local task data or pending mutations, while retaining the content-free console and production Sentry report of the recovered incident

#### Scenario: Automatic replacement also fails
- **WHEN** the replacement generation fails to initialize or an initialization failure is not the recognized closed-client condition
- **THEN** Tasks stops automatic recovery and presents a manual Retry action without entering an automatic retry loop

#### Scenario: Retired initialization finishes late
- **WHEN** asynchronous work from a retired client generation finishes after a replacement generation has begun
- **THEN** the retired generation cannot alter the current loading, ready, error, synchronization, timer, or listener state

### Requirement: Tasks startup failure communication
The Tasks module SHALL present terminal startup failures in user-facing language, SHALL log a developer diagnostic report locally, and SHALL report the handled failure to the configured production Sentry client without including private Tasks data.

#### Scenario: Terminal startup failure reaches the user
- **WHEN** Tasks cannot recover from an initialization failure
- **THEN** the interface says that Tasks could not open, says that the issue was logged and reported to the webmaster, and offers Retry without displaying the raw exception message

#### Scenario: Developer inspects the console
- **WHEN** a terminal Tasks startup failure occurs
- **THEN** the console receives the original exception and a structured report containing bounded lifecycle, environment, and timing context but no task content, database contents, owner identifier, credential, or query result

#### Scenario: Production Sentry is available
- **WHEN** a closed-client automatic recovery begins or a terminal Tasks startup failure occurs and the production Sentry client is initialized
- **THEN** Tasks captures the original exception once for that client generation with allowlisted module, phase, outcome, recovery, connectivity, and environment context, using warning level for automatic recovery and error level for terminal failure

#### Scenario: Sentry is unavailable
- **WHEN** a terminal Tasks startup failure occurs without an initialized Sentry client or while event delivery is unavailable
- **THEN** the local console report and manual Retry remain available and Tasks does not block recovery while waiting for telemetry

#### Scenario: User retries
- **WHEN** the user activates Retry after a terminal startup failure
- **THEN** Tasks creates a fresh client generation, returns to the loading view, and allows one bounded automatic closed-client recovery within the new user-initiated startup episode

### Requirement: Unified task action history
Tasks SHALL make every accepted discrete user action affecting tasks or their checklist items undoable through one chronological application-history command and redoable until a new forward user action invalidates the redo path.

#### Scenario: Own history inside task fields
- **WHEN** focus is in an editable task or checklist field and the user invokes a documented Tasks undo or redo command outside active composition
- **THEN** Tasks consumes the command and invokes authoritative application history rather than leaving it to isolated browser-native field history

#### Scenario: Flush a pending task edit
- **WHEN** the user invokes undo while an open task has a pending title, notes, link, checklist, or metadata save
- **THEN** Tasks first commits that pending edit and then undoes the resulting authoritative mutation instead of traversing an older action

#### Scenario: Undo every supported discrete action
- **WHEN** the latest accepted action changes task text, checklist content or order, metadata, task order, lifecycle state, deletion state, completion state, or clipboard-created or clipboard-removed work
- **THEN** one undo invocation restores the exact state before that discrete user action

#### Scenario: Redo the undone action
- **WHEN** the user has undone one or more actions and has not performed a new forward action
- **THEN** each redo invocation reapplies the next undone action in chronological order

#### Scenario: Invalidate redo with new work
- **WHEN** the user performs a new forward action after undoing one or more actions
- **THEN** Tasks clears the incompatible redo path without changing the preserved undo history

#### Scenario: Undo task creation
- **WHEN** a user undoes a newly created or pasted task
- **THEN** Tasks recoverably removes the complete created task hierarchy as one guarded history action and makes the exact creation available to redo

#### Scenario: Undo a grouped clipboard action
- **WHEN** one cut or paste gesture affects multiple tasks or checklist items
- **THEN** Tasks records and traverses the complete accepted gesture as one atomic undo or redo operation

#### Scenario: Choose the newest history stream
- **WHEN** task history and checklist history both contain traversable actions
- **THEN** Undo selects the newest accepted action across both streams and Redo follows the inverse route established by prior undo traversal

#### Scenario: Reject an unsafe traversal
- **WHEN** synchronized current state no longer exactly matches the state required by an undo or redo action
- **THEN** Tasks preserves current data, preserves the authoritative cursor, and reports the conflict without applying a partial inverse

### Requirement: Temporary visible history controls
Every Tasks list SHALL temporarily expose direct Undo and Redo controls for history diagnosis.

#### Scenario: Order list controls
- **WHEN** a Tasks list header renders
- **THEN** its controls appear in the order Undo, Redo, Select, Find, and Filter

#### Scenario: Disable an unavailable control
- **WHEN** the combined authoritative history has no eligible undo or redo action, or a history traversal is pending
- **THEN** the corresponding visible history control is disabled and communicates its function with an accessible label and tooltip

#### Scenario: Invoke history by pointer
- **WHEN** the user activates an enabled Undo or Redo control
- **THEN** Tasks invokes the same application-history path used by the corresponding keyboard command

#### Scenario: Present controls only on lists
- **WHEN** the user views Tasks configuration or another non-list Tasks view
- **THEN** the temporary Undo and Redo controls are absent

### Requirement: Template-Free Tasks Surface
Tasks SHALL expose no reusable Template entity, view, route, navigation action, creation command, synchronized collection, or current portability collection.

#### Scenario: Open Tasks after template removal
- **WHEN** a user opens any Tasks surface after the template-free release
- **THEN** Tasks presents no Templates navigation item, Templates view, template action, or template-backed recurrence representation

#### Scenario: Open the retired Templates route
- **WHEN** a browser opens `/tasks/templates`
- **THEN** Tasks replace-navigates to `/tasks/upcoming` without rendering a Templates view or falling through to another module

#### Scenario: Remove existing standalone templates
- **WHEN** the approved production migration runs after its exact preflight succeeds
- **THEN** it deletes all standalone template definitions, revisions, instantiations, and private template context without generating tasks from them

#### Scenario: Omit templates from synchronization
- **WHEN** the template-free client synchronizes Tasks
- **THEN** no template collection appears in the PowerSync schema, publication, or owner-scoped stream

### Requirement: Closed-task completion has an accidental-click grace period
When a user marks a closed ordinary to-do complete from a list, Tasks SHALL show it as checked in place for two seconds before beginning terminal exit motion and persistence.

#### Scenario: User confirms completion by waiting
- **WHEN** the user checks a closed ordinary to-do and does not interact with its completion control for two seconds
- **THEN** the row SHALL remain visibly checked during the grace period
- **AND** Tasks SHALL then run the established completion exit and persistence behavior

#### Scenario: User cancels accidental completion
- **WHEN** the user checks a closed ordinary to-do and checks the same completion control again before two seconds elapse
- **THEN** Tasks SHALL restore the unchecked state in place
- **AND** Tasks SHALL NOT persist a completion mutation

#### Scenario: User opens a task during its grace period
- **WHEN** a user opens a to-do whose closed-row completion grace period is active
- **THEN** Tasks SHALL preserve the checked intent using the established open-editor deferred-completion behavior
- **AND** the user SHALL remain able to uncheck it before closing the editor

### Requirement: Deadline dates are unrestricted and the command crosses the overdue boundary
Tasks SHALL allow a deadline to be selected on any calendar date before, on, or after the current planning date. An open deadline picker SHALL advance Control+D from the to-do's selected date by one calendar day, including from yesterday to today, before subsequent commands continue from the current keyboard-focused date.

#### Scenario: Past and current deadline dates remain available
- **WHEN** a user opens a Deadline picker
- **THEN** dates before the current planning date SHALL remain enabled and selectable
- **AND** the current planning date SHALL remain enabled and selectable

#### Scenario: Yesterday advances to today
- **WHEN** a to-do's deadline is yesterday and the user invokes Control+D after opening the deadline picker
- **THEN** keyboard focus SHALL move to today rather than skipping to tomorrow
- **AND** a subsequent Control+D SHALL move focus to tomorrow

#### Scenario: Arrow navigation remains authoritative
- **WHEN** the user changes the focused calendar date with arrow keys after opening or advancing the deadline picker
- **THEN** the next Control+D SHALL advance one day from that newly focused date

### Requirement: Online startup conceals stale cached task rows
Tasks SHALL distinguish locally available task rows from task rows that have been refreshed by the authoritative service during the current online launch. While an online connected launch awaits its first current-session completed sync, Tasks SHALL show the centered loading indicator instead of revealing the locally cached list.

#### Scenario: Initial cacheless fetch
- **WHEN** a task-list query has no locally available rows and is still fetching
- **THEN** Tasks SHALL show the task loading indicator
- **AND** Tasks SHALL NOT show a no-tasks empty-state message

#### Scenario: Online launch has cached rows
- **WHEN** locally cached task rows are available during an online launch but PowerSync has not completed a sync in the current runtime session
- **THEN** Tasks SHALL show the centered task loading indicator
- **AND** Tasks SHALL NOT reveal the cached rows before current-session freshness is established

#### Scenario: Current-session sync completes
- **WHEN** the authoritative service completes the first sync of the current online runtime session
- **THEN** Tasks SHALL reveal the newly reconciled task list
- **AND** subsequent same-view background refreshes SHALL leave the currently rendered rows visible

#### Scenario: App launches offline
- **WHEN** Tasks launches without browser network connectivity and a locally cached projection is available
- **THEN** Tasks SHALL render the cached rows immediately as its offline fallback

#### Scenario: Online freshness cannot be established promptly
- **WHEN** a download failure occurs or the bounded startup freshness wait expires before a current-session sync completes
- **THEN** Tasks SHALL release the loading gate and render the locally available projection
- **AND** existing synchronization diagnostics SHALL continue to communicate the degraded connection state

#### Scenario: Settled empty list
- **WHEN** the startup freshness gate is released and the watched query has no rows and is no longer loading or fetching
- **THEN** Tasks SHALL show the applicable empty-state message

### Requirement: Legacy task provenance is render-safe
Tasks SHALL render task lists without crashing when a persisted task contains a source-provenance kind that is no longer part of the current typed source vocabulary.

#### Scenario: Unrecognized persisted source kind
- **WHEN** a task row contains a nonempty source kind that the current client does not recognize
- **THEN** Tasks SHALL render the established generic Source presentation
- **AND** the task list SHALL remain usable

### Requirement: Partially upgraded recurrence data is render-safe
Tasks SHALL keep ordinary task lists usable when synchronized recurrence data is temporarily incomplete during a schema transition or cache refresh.

#### Scenario: Recurrence revision lacks a valid prototype snapshot
- **WHEN** synchronized storage exposes a recurrence revision without a valid prototype snapshot
- **THEN** Tasks SHALL skip that invalid recurrence revision and report the parsing failure to developer diagnostics
- **AND** ordinary tasks SHALL continue rendering

### Requirement: Compatible task-history reconstruction
Tasks SHALL reconstruct its authoritative undo and redo cursor from every synchronized history row that uses current mutation vocabulary or retained legacy snapshot vocabulary produced by an approved Tasks migration.

#### Scenario: Read widget-originated history
- **WHEN** synchronized task history includes an accepted mutation whose channel is `widget`
- **THEN** Tasks decodes that event as valid history and keeps eligible newer task actions available to undo and redo

#### Scenario: Read retained template-era snapshots
- **WHEN** append-only history retains a task snapshot whose source kind was `template` before template removal
- **THEN** Tasks normalizes the retired provenance to the template-free task representation and reconstructs the cursor without discarding otherwise valid history

#### Scenario: Diagnose genuinely incompatible history
- **WHEN** a synchronized history row remains invalid after supported compatibility normalization
- **THEN** Tasks withholds unsafe traversal, logs a content-free diagnostic with the failing event identity and reason, and does not silently describe the condition as an empty history boundary

### Requirement: Selection-Owned Edit Menu Dismissal
Tasks SHALL treat dismissal of the selection-mode Edit menu as a menu interaction rather than an instruction to exit selection mode.

#### Scenario: Dismiss Edit menu with an outside pointer
- **WHEN** one or more tasks are selected, the selection-mode Edit menu is open, and the user clicks or taps outside the menu without choosing an action
- **THEN** Tasks closes the Edit menu, keeps selection mode active, preserves the selected task membership and range anchor, and does not activate the underlying interface target

#### Scenario: Preserve ordinary outside selection dismissal afterward
- **WHEN** the selection-mode Edit menu is closed and the user performs a later pointer interaction outside every task row and selection-owned surface
- **THEN** Tasks applies its ordinary outside-selection dismissal behavior

### Requirement: Compact Tasks Start picker presentation
The Tasks Start picker SHALL match the shared calendar width and reduce non-calendar space through a vertical Today rail, a compact Reminder row, and small terminal action buttons without changing their semantics or traversal order.

#### Scenario: Match the shared calendar width
- **WHEN** the Tasks Start picker opens
- **THEN** its Today, calendar, Reminder, and terminal-action sections share the regular date picker's width
- **AND** the four horizon labels, Reminder content, Clear, and Someday remain fully usable without horizontal clipping

#### Scenario: Present Today beside the horizons
- **WHEN** the Tasks Start picker is open
- **THEN** the Today label appears vertically in a narrow rail to the left of Inbox, Now, Next, and Later
- **AND** all four horizon buttons remain equal-width, labeled, colored, and directly selectable

#### Scenario: Present compact Reminder and terminal actions
- **WHEN** the Tasks Start picker renders Reminder, Clear, and Someday
- **THEN** the Reminder input group and the Clear and Someday buttons use the shared small-control height
- **AND** Reminder remains full-width while Clear and Someday remain equal-width sibling actions with their existing divider

#### Scenario: Preserve Start picker behavior
- **WHEN** a user navigates or activates the compact Start picker by keyboard, pointer, or touch
- **THEN** horizon selection, date selection, reminder entry, reminder-hour selection, Clear, Someday, focus traversal, and picker closure behave exactly as before

#### Scenario: Leave the calendar vertically for Start controls
- **WHEN** keyboard focus is on a date in the first visible calendar row and the user presses Up beyond the legal day cells in that column
- **THEN** focus moves to the appropriate calendar header control without paging to another month
- **WHEN** keyboard focus is on a date in the final visible calendar row and the user presses Down
- **THEN** focus moves to the Reminder input without paging to another month

#### Scenario: Align the Deadline picker to its field
- **WHEN** the Tasks Deadline picker opens from an ordinary task editor
- **THEN** the calendar's right edge aligns with the Deadline input's right edge
- **AND** the Start picker continues to align with the Start input's left edge

#### Scenario: Present the Reminder hour action as an appended button
- **WHEN** the compact Reminder input group is visible
- **THEN** the alarm-clock action has a visible divider only on its left edge
- **AND** its other edges rely on the containing input group's border
- **AND** its enabled icon uses the standard white foreground color without a hover effect
- **AND** its disabled, focus, and activation semantics remain unchanged

#### Scenario: Dismiss only the nested Reminder hour menu
- **WHEN** the Reminder hour menu is open and the user presses Escape, activates its trigger again, or interacts elsewhere inside the Start picker
- **THEN** only the Reminder hour menu closes
- **AND** the Start picker remains open
- **AND** the task metadata drawer remains open

### Requirement: Multiline Task And Checklist Paste
Tasks SHALL interpret normalized plain-text clipboard lines as ordered task or checklist-item boundaries when the corresponding Tasks surface owns Paste, while preserving structured task payloads and native single-line text editing.

#### Scenario: Paste multiline text into a task list
- **WHEN** Paste in a supported task-list destination receives ordinary plain text or the plain-text representation of rich text containing LF, CRLF, or bare CR line boundaries
- **THEN** Tasks creates one open task per nonempty trimmed line in source order at the destination's normal paste position and applies the destination's planning and organization rules to every created task

#### Scenario: Ignore empty task lines
- **WHEN** ordinary multiline task clipboard text contains blank or whitespace-only lines
- **THEN** Tasks creates no task for those lines and preserves the relative source order of every nonempty line

#### Scenario: Preserve structured and single-line task paste
- **WHEN** Paste receives a valid supported task envelope or ordinary text with no line boundary
- **THEN** Tasks retains the existing structured reconstruction or single-task plain-text behavior respectively

#### Scenario: Confirm task paste through created rows
- **WHEN** task Paste succeeds
- **THEN** Tasks renders the created task rows without showing a redundant success toast

#### Scenario: Paste multiline text into a checklist item
- **WHEN** a user pastes plain text or the plain-text representation of rich text containing line boundaries into a persisted or draft checklist-item input
- **THEN** Tasks replaces the active selection as one multiline insertion, keeps the current prefix on the first affected item, places each subsequent line in an adjacent item, appends the current suffix to the final affected item, preserves source order, and keeps the task editor open

#### Scenario: Focus the final checklist paste line
- **WHEN** multiline checklist paste completes
- **THEN** Tasks focuses the final affected checklist input and places the caret immediately after the pasted text and before any suffix retained from the original item

#### Scenario: Preserve native paste in other editable controls
- **WHEN** an editable control other than a checklist item owns Paste
- **THEN** Tasks leaves the control's existing native or specialized paste behavior unchanged and does not create task objects from its clipboard text

#### Scenario: Commit checklist drafts while creating a task
- **WHEN** a user adds a checklist while creating a task, enters a nonempty checklist item, and presses Return
- **THEN** Tasks persists that checklist item, inserts and focuses a following draft item, and retains the saved checklist after the task editor closes

#### Scenario: Flush the final checklist draft when closing
- **WHEN** a task editor closes while its checklist contains a nonempty transient draft
- **THEN** Tasks waits for that draft to persist before unmounting the editor and does not lose the checklist item

#### Scenario: Persist checklist completion locally
- **WHEN** a user checks or reopens a persisted checklist item
- **THEN** Tasks writes the completion state, completion timestamp, revision, and undo-operation metadata to the local PowerSync database and retains that state across rerender and application restart

#### Scenario: Upload checklist completion operation metadata
- **WHEN** PowerSync uploads a persisted checklist completion or reopening mutation
- **THEN** Tasks accepts the mutation's undo-operation identifier as checklist metadata and applies the mutation remotely instead of rejecting and reverting it

### Requirement: Checklist Item Clipboard Transfer
Tasks SHALL let users copy, cut, and paste selected checklist items between task checklists through a strict versioned clipboard payload while preserving item order, text, and completion state.

#### Scenario: Copy selected checklist items
- **WHEN** one or more checklist items are selected and the user invokes Copy
- **THEN** Tasks writes the selected items in visible order to the checklist clipboard payload, preserves their text and completion state, leaves the source items and selection unchanged, and shows a count-bearing success toast

#### Scenario: Cut selected checklist items
- **WHEN** one or more checklist items are selected and the user invokes Cut
- **THEN** Tasks first writes the selected items in visible order to the checklist clipboard payload, then removes those items from the source checklist, clears their selection, and shows a count-bearing success toast

#### Scenario: Preserve source rows when checklist Cut cannot write
- **WHEN** Tasks cannot write a selected checklist Cut payload to the operating-system clipboard
- **THEN** Tasks keeps every selected source item in place and shows a destructive failure toast

#### Scenario: Paste checklist items after a focused item
- **WHEN** a persisted checklist-item input has text-cursor focus and the user pastes a valid checklist clipboard payload
- **THEN** Tasks inserts the copied items immediately after the focused item in source order, preserves each completion state, keeps the destination task editor open, focuses the final pasted item, and does not show a redundant success toast

#### Scenario: Paste checklist items at a draft position
- **WHEN** a transient checklist draft input has text-cursor focus and the user pastes a valid checklist clipboard payload
- **THEN** Tasks inserts the copied items at the draft's current list position in source order, preserves each completion state, moves an empty draft below the pasted group or commits a nonempty draft there through its existing blur behavior, focuses the final pasted item, and does not show a redundant success toast

#### Scenario: Reject a malformed checklist clipboard payload
- **WHEN** a checklist input receives text identifying itself as a checklist clipboard payload but its version, operation, item count, title, or completion state is invalid
- **THEN** Tasks creates no checklist items, leaves the destination checklist unchanged, and shows a destructive failure toast

#### Scenario: Checklist selection owns Copy and Cut
- **WHEN** checklist-item selection is active within an open task and the user invokes Copy or Cut
- **THEN** the checklist editor handles the command and Tasks does not also copy or cut the enclosing task or task-list selection

### Requirement: Protocol-Specific Primary Link Iconography
Tasks SHALL derive Primary Link iconography consistently for the task row, metadata-editor activation control, and native widget while preserving real-link activation behavior.

#### Scenario: Present a Jira Primary Link
- **WHEN** a task has a `jira:` Primary Link or a recognized Jira HTTP or HTTPS URL
- **THEN** its task row and metadata-editor activation control use Lucide `Zap`, and web URLs open in a new browser context while the Jira protocol is handed to its registered application

#### Scenario: Present an Obsidian Primary Link
- **WHEN** a task has an `obsidian:` Primary Link
- **THEN** its task row and metadata-editor activation control use Lucide `FileText` and hand activation to Obsidian

#### Scenario: Preserve other Primary Link iconography
- **WHEN** a task has a Mail message Primary Link or another supported destination
- **THEN** Mail retains its Mail icon and other destinations retain the canonical generic external-link icon

#### Scenario: Keep the editor and row in parity
- **WHEN** a nonblank Primary Link is visible in an expanded task
- **THEN** the activation control beside the Primary Link input uses the same derived icon as the task summary row

### Requirement: Widget Completion Lifecycle Parity
The Tasks domain SHALL treat an accepted native widget completion as an ordinary idempotent task completion with the same lifecycle, history, recurrence, and convergence guarantees as completion from the web interface.

#### Scenario: Complete from a widget
- **WHEN** the native widget endpoint accepts a valid request for an owned present open task
- **THEN** the system sets lifecycle to completed, records the authoritative completion time, increments the task revision, appends one supported history event, and lets applicable recurrence processing observe the transition

#### Scenario: Identify the native mutation
- **WHEN** the completion is written
- **THEN** the stored mutation channel identifies the widget boundary, the actor remains the user, and the request carries stable operation and mutation identifiers without storing secret credential material in history

#### Scenario: Converge every client
- **WHEN** a widget completion is accepted centrally
- **THEN** PowerSync projects the ordinary task and history changes to active clients without adding the credential table to its publication

#### Scenario: Reject foreign or ineligible work
- **WHEN** a credential is invalid or its bound owner does not own a present task eligible for completion
- **THEN** the system changes no task, history, recurrence, or credential ownership data

### Requirement: Authoritative Upcoming Rank
Tasks SHALL persist one Upcoming-specific rank for every ordinary task and dated recurrence prototype, SHALL scope that rank to each visible controlling-date bucket, and SHALL use it independently from Today, Anytime, Someday, or checklist order.

#### Scenario: Reorder ordinary work inside Upcoming
- **WHEN** a user moves an ordinary task before or after any ordinary task or recurrence prototype in the same Upcoming bucket
- **THEN** Tasks updates only its Upcoming rank and preserves its ordering in other lists

#### Scenario: Reorder a recurrence prototype inside Upcoming
- **WHEN** a user moves a recurrence prototype before or after any ordinary task or recurrence prototype in its current Upcoming bucket
- **THEN** Tasks updates the definition's Upcoming rank without changing cadence, prototype content, next occurrence date, or recurrence revision

#### Scenario: Keep a recurrence prototype in its cadence bucket
- **WHEN** a drag would place a recurrence prototype in another Upcoming bucket
- **THEN** Tasks rejects the move and leaves its rank and recurrence data unchanged

#### Scenario: Promote Upcoming order into Today
- **WHEN** multiple ordinary tasks or spawned recurrence instances reach the owner-local planning date together
- **THEN** activation appends them to Today Inbox in their final Upcoming-rank order after unfinished rolled-over work

#### Scenario: Preserve authoritative widget order
- **WHEN** the web bridge or native credential endpoint projects Upcoming for an Apple-platform widget
- **THEN** ordinary tasks and virtual recurrence prototypes are ordered by controlling date and Upcoming rank before the leading ten rows are selected

### Requirement: Open task retains a summary-row drag handle
Tasks SHALL keep the ordinary rendered summary row visible while its metadata drawer is open and SHALL limit task-level drag initiation to that summary row.

#### Scenario: Reorder an open task from its summary
- **WHEN** a user presses and drags the rendered summary region of an open task
- **THEN** Tasks closes the metadata drawer as dragging begins and reorders the task among its eligible peers

#### Scenario: Edit Summary without initiating drag
- **WHEN** a user interacts with the Summary input inside the open metadata drawer
- **THEN** the input edits the task title normally and does not act as a task-level drag source

#### Scenario: Reveal an opened destination
- **WHEN** a task opens through direct interaction, keyboard traversal, creation, or Quick Find
- **THEN** Tasks smoothly positions its summary row about one collapsed task-row below the visible content boundary when available scroll range permits

### Requirement: Quick Find Destination Semantics
Quick Find SHALL derive both its label and activation route from the task's natural planning route and SHALL use one whole-row preliminary focus style while retaining text-cursor focus in the query.

#### Scenario: Label an Upcoming-only task
- **WHEN** an ordinary result belongs only to Upcoming
- **THEN** its secondary label is `Upcoming` and activation opens that task in Upcoming

#### Scenario: Label a Today and Anytime task
- **WHEN** an ordinary result belongs to both Today and Anytime
- **THEN** its secondary label is `Anytime` and activation opens that task in Anytime

#### Scenario: Navigate result focus
- **WHEN** the user moves Quick Find's preliminary selection with Up or Down
- **THEN** the complete active result row uses the standard subdued blue task focus without receiving a white browser focus ring or moving text focus out of the query input

#### Scenario: Place the compact palette
- **WHEN** Quick Find opens with zero or more results
- **THEN** it appears near the top of the visual viewport, grows downward, uses balanced empty-state padding, and presents a transparent dark backdrop that consumes outside dismissal

#### Scenario: Reveal a regular result
- **WHEN** an ordinary Quick Find result is activated
- **THEN** Tasks opens it on the derived route and positions it with about one collapsed task-row of context above it without scrolling past that target

#### Scenario: Reveal a recurrence result
- **WHEN** a recurrence-definition Quick Find result is activated
- **THEN** Tasks opens Upcoming, keeps repeat management closed, scrolls the prototype to the same contextual offset, and applies the whole-row blue focus style

### Requirement: Installed Task Navigation Boundaries
Installed Tasks surfaces SHALL preserve vertical content scrolling and task-owned drag gestures while preventing native web-view history swipe navigation where the host exposes that control.

#### Scenario: Use the iOS native companion
- **WHEN** the user vertically scrolls or drags a reorderable task in the iOS companion
- **THEN** the WKWebView preserves native-feeling vertical movement and task drag ownership without enabling back/forward history swipes

#### Scenario: Use an installed PWA
- **WHEN** the browser permits page CSS to contain horizontal overscroll
- **THEN** Tasks suppresses horizontal overscroll propagation without rewriting browser history or weakening vertical scroll and task drag behavior

### Requirement: Retired Template Sync Boundary
Active Tasks sync configuration SHALL omit the retired Template tables and SHALL preserve exactly 17 approved Tasks publication tables.

#### Scenario: Provision PowerSync after Template removal
- **WHEN** Tasks sync rules are generated or verified
- **THEN** `tasks_templates`, `tasks_template_revisions`, and `tasks_template_instantiations` are absent and the approved Tasks table count is exactly 17

#### Scenario: Reconnect an older client
- **WHEN** a client reconnects after the rules no longer reference retired Template tables
- **THEN** ordinary Tasks data synchronizes without recreating compatibility tables or treating the retired-table warning as a task-data failure

### Requirement: Deadline-Derived Today Start
Tasks SHALL treat a future deadline as an implicit Start only while the task has no explicit Start and the deadline remains ahead of the owner-local planning date. When that deadline reaches or passes the planning date, local and server activation SHALL persist the activation date as Start and place the task in Today Inbox.

#### Scenario: Keep a future deadline implicit
- **WHEN** an open, present Anytime task has no Start or Today horizon and a future deadline
- **THEN** the Start remains visibly and persistently unset

#### Scenario: Materialize a reached deadline
- **WHEN** the task's deadline reaches the owner-local planning date
- **THEN** activation assigns the owner-local planning date as Start, assigns Today Inbox, preserves the deadline, and records one accepted system mutation

#### Scenario: Catch up a missed deadline activation
- **WHEN** activation resumes after one or more missed owner-local dates
- **THEN** the task receives the current owner-local planning date as Start rather than backdating Start to the overdue deadline

### Requirement: Modified-click selection starts from the clicked task
Tasks SHALL begin a new modified-click selection context from the task the user clicked rather than implicitly including a different open or keyboard-focused task.

#### Scenario: Command-click a different task
- **WHEN** selection mode is inactive and a user Command-clicks a task other than the currently open or keyboard-focused task
- **THEN** Tasks flushes and closes any open editor, clears the prior lightweight focus, enters selection mode, and selects only the clicked task

#### Scenario: Shift-click a different task before selection mode exists
- **WHEN** selection mode is inactive and a user Shift-clicks a task while a different task is open or keyboard-focused
- **THEN** Tasks closes and clears the prior task state, enters selection mode, and selects only the clicked task as the new range anchor

#### Scenario: Explicitly start selection from the current task
- **WHEN** a user invokes the documented Control+B current-task selection command
- **THEN** Tasks begins selection mode with the currently open or keyboard-focused task selected according to the existing command contract

### Requirement: Task history traversal provides immediate progress feedback
Tasks SHALL acknowledge every accepted undo or redo invocation immediately and SHALL prevent competing task interactions until the requested history traversal settles.

#### Scenario: Process undo
- **WHEN** a user invokes undo and Tasks begins resolving the history request
- **THEN** a centered spinner overlay appears immediately and remains until undo succeeds, reaches a neutral boundary, or fails

#### Scenario: Process redo
- **WHEN** a user invokes redo and Tasks begins resolving the history request
- **THEN** the same centered spinner overlay appears immediately, prevents duplicate traversal input, and clears when the request settles

### Requirement: Hide mobile navigation for software-keyboard editing
Tasks SHALL hide persistent mobile navigation while a software keyboard materially reduces the visual viewport around an editable control and SHALL otherwise preserve navigation in portrait and landscape layouts.

#### Scenario: Focus a field with the software keyboard visible
- **WHEN** a touch-device native or PWA Tasks surface focuses an editable field and its visual viewport contracts for the software keyboard
- **THEN** the mobile navigation is removed from view without shifting into the keyboard area

#### Scenario: Dismiss the software keyboard
- **WHEN** the editable focus or keyboard-induced viewport contraction ends
- **THEN** mobile navigation returns to its stable safe-area position

### Requirement: Direct Reminder clearing
The Tasks Start picker SHALL provide an inline clear action whenever Reminder contains a value, positioned after the value and before the alarm-clock menu button.

#### Scenario: Present the Reminder clear action
- **WHEN** Reminder contains a displayed value
- **THEN** a small X action appears inside the trailing portion of the input before Alarm
- **AND** the input reserves space so neither trailing action covers the displayed value

#### Scenario: Clear Reminder immediately
- **WHEN** the user activates the Reminder X with pointer, Space, or Return
- **THEN** Tasks immediately clears the displayed Reminder and persists the cleared reminder intent
- **AND** Start remains open

#### Scenario: Hide the clear action for an empty Reminder
- **WHEN** Reminder contains no displayed value
- **THEN** the inline X is absent and Alarm retains its existing position and behavior

#### Scenario: Recover from a failed clear
- **WHEN** clearing a persisted Reminder fails
- **THEN** Tasks restores the last committed display value and retains the existing failure feedback behavior

### Requirement: Recurrence prototypes can be deleted from Upcoming
Tasks SHALL expose a Delete action on each dated or waiting recurrence prototype in Upcoming, SHALL retire that prototype from future recurrence generation, and SHALL leave already generated ordinary task instances unchanged.

#### Scenario: Delete a dated recurrence prototype
- **WHEN** a user activates Delete from the ellipsis menu of a dated recurrence prototype
- **THEN** Tasks archives the recurrence definition and removes the prototype from Upcoming without changing any already generated instance

#### Scenario: Delete a waiting recurrence prototype
- **WHEN** a user activates Delete from the ellipsis menu of a waiting after-completion recurrence prototype
- **THEN** Tasks archives the recurrence definition and removes the prototype from the Repeating Tasks section without changing its outstanding ordinary instance

#### Scenario: Recurrence prototype deletion fails
- **WHEN** the authoritative recurrence status mutation rejects or fails
- **THEN** Tasks keeps or restores the prototype in Upcoming and reports that the repeating task could not be deleted

### Requirement: Unified Task-Like Recurrence Prototype Editing
Tasks SHALL present ordinary task metadata in an opened recurrence prototype through the same task metadata and checklist interaction components used by an opened ordinary task, while applying only the explicit capability differences required by recurrence.

#### Scenario: Present shared prototype metadata controls
- **WHEN** a user opens a recurrence prototype in Upcoming
- **THEN** Summary, Notes, Primary Link, Area, Actionability, disclosure layout, spacing, input sizing, focus treatment, and open-row blue highlight use the same components and presentation rules as an opened ordinary task

#### Scenario: Edit a prototype checklist
- **WHEN** a user adds, edits, splits, joins, pastes, cuts, copies, completes, reopens, selects, deletes, or reorders checklist items in an opened recurrence prototype
- **THEN** Tasks uses the same checklist controls, sizes, keyboard behavior, pointer behavior, selection behavior, and ordering behavior as an ordinary task checklist
- **AND** accepted checklist state is persisted in the current recurrence prototype snapshot for later generated instances

#### Scenario: Preserve recurrence-specific exceptions
- **WHEN** a recurrence prototype is presented or opened
- **THEN** Tasks uses the recurrence symbol instead of a completion checkbox, excludes the prototype from task bulk selection and completion, omits editable Start and Deadline fields, and presents one full-width Edit Repeat control in their place

#### Scenario: Keep one inline editor open
- **WHEN** an ordinary task or recurrence prototype is open in Upcoming and the user opens a different ordinary task or recurrence prototype
- **THEN** Tasks flushes and closes the current editor before opening the requested editor
- **AND** no ordinary task and recurrence prototype are open simultaneously

#### Scenario: Carry future drawer refinements uniformly
- **WHEN** a shared metadata drawer component or shared checklist component changes
- **THEN** the changed component is used by both ordinary task and recurrence prototype editors without a prototype-only visual substitute

### Requirement: Closed task completion preserves interaction-origin focus intent
Tasks SHALL distinguish pointer completion from keyboard completion when a closed task leaves an active list, without changing completion persistence, grace, animation, or error recovery.

#### Scenario: Complete a closed task by pointer
- **WHEN** a user clicks a closed task's completion checkbox
- **THEN** Tasks completes and removes that task without moving whole-task keyboard focus to another task

#### Scenario: Complete a closed task by keyboard shortcut
- **WHEN** a user invokes the task completion keyboard shortcut on a keyboard-focused closed task
- **THEN** Tasks completes and removes that task and moves whole-task keyboard focus to the next eligible task using the established list fallback order

### Requirement: Reminder metadata uses neutral secondary styling
Tasks SHALL present a reminder's icon and time in the second task-row metadata line using the regular muted gray metadata color, while preserving semantic blue for a task-row Primary Link that opens an external website or application.

#### Scenario: Present Reminder beside other metadata
- **WHEN** a task row displays Reminder metadata
- **THEN** both the Reminder icon and its time text use the regular muted gray metadata color
- **AND** the Reminder does not use the semantic blue reserved for an external link affordance

#### Scenario: Preserve external Primary Link styling
- **WHEN** the same task row also displays a Primary Link action
- **THEN** that Primary Link icon retains the semantic blue link treatment

### Requirement: Dated recurrence prototype selection
Tasks SHALL include every dated recurrence prototype in the Upcoming list's transient row-selection model alongside ordinary tasks while retaining recurrence-owned scheduling behavior.

#### Scenario: Enter selection from a prototype
- **WHEN** selection mode is inactive and a user Command-clicks a dated prototype on Mac, Control-clicks it on Windows, or Shift-clicks it as a new selection target
- **THEN** Tasks closes any open editor, enters selection mode, selects only that prototype, establishes it as the range anchor, and does not open the prototype editor

#### Scenario: Extend a mixed range
- **WHEN** selection mode is active and a user Shift-clicks an ordinary task or dated prototype with an existing anchor
- **THEN** Tasks selects the contiguous visible range across ordinary task and prototype rows in their rendered Upcoming order

#### Scenario: Toggle a prototype in active selection
- **WHEN** selection mode is active and the user activates a prototype summary or its circular selection control
- **THEN** Tasks toggles that prototype's membership without opening its editor and applies the same zero-selection exit behavior used by ordinary task rows

#### Scenario: Present a selected prototype
- **WHEN** a dated prototype renders while selection mode is active
- **THEN** it replaces its recurrence control with the canonical circular selected or unselected control, uses the canonical selected-row highlight when selected, communicates its selection state accessibly, and hides its ellipsis action button

#### Scenario: Select all Upcoming rows
- **WHEN** selection mode is active on Upcoming and the user activates Select All
- **THEN** Tasks selects every visible eligible ordinary task and dated recurrence prototype and includes both kinds in the reported count

#### Scenario: Edit metadata shared by tasks and prototypes
- **WHEN** a selection contains one or more dated recurrence prototypes
- **THEN** Tasks keeps Edit enabled and offers Area, Actionability, and Delete while omitting Start and Deadline

#### Scenario: Apply a shared metadata edit
- **WHEN** the user chooses an Area or Actionability value for a mixed or prototype-only Upcoming selection
- **THEN** Tasks applies that value to every selected ordinary task and recurrence prototype through the appropriate guarded persistence path and keeps every still-visible row selected

#### Scenario: Delete any Upcoming selection
- **WHEN** the user chooses Delete for any non-empty Upcoming selection of ordinary tasks, recurrence instances, and dated recurrence prototypes
- **THEN** Tasks moves every selected ordinary task or recurrence instance to Done, archives every selected recurrence prototype, removes successful targets from Upcoming, and restores any target whose mutation fails

### Requirement: Mixed Upcoming group reordering
Tasks SHALL allow a selected group containing ordinary tasks and dated recurrence prototypes to reorder through the Upcoming list while preserving every prototype's recurrence-owned date.

#### Scenario: Reorder a mixed group within one day
- **WHEN** selected ordinary tasks and dated prototypes are dragged to another position in their shared Upcoming day bucket
- **THEN** Tasks assigns the group consecutive Upcoming order keys in its existing visible relative order and persists ordinary-task and prototype ordering through their respective guarded mutation paths

#### Scenario: Start a group drag from a prototype
- **WHEN** a selected dated prototype begins a native drag
- **THEN** Tasks drags the complete selected group rather than only that prototype

#### Scenario: Reject illegal prototype movement across days
- **WHEN** a selected group contains prototypes from days other than the target day and is dropped into the target day bucket
- **THEN** Tasks leaves those prototypes in their recurrence-owned buckets without changing their occurrence dates or Upcoming order keys for the target bucket

#### Scenario: Move eligible ordinary tasks during a cross-day drop
- **WHEN** a mixed selected group is dropped into another Upcoming day bucket
- **THEN** Tasks may move selected ordinary tasks through the existing cross-day planning behavior while every schedule-ineligible prototype remains in its original bucket

### Requirement: Selection lasso toggle
Tasks SHALL keep the top-right selection lasso available as a visible toggle throughout selection-capable list interaction.

#### Scenario: Show active lasso state
- **WHEN** selection mode is active
- **THEN** the lasso remains visible, exposes an accessible pressed state, and uses the established information highlight to indicate that selection mode is active

#### Scenario: Cancel selection with the lasso
- **WHEN** the user activates the lasso while selection mode is active
- **THEN** Tasks clears selection membership and its anchor and returns to ordinary list interaction

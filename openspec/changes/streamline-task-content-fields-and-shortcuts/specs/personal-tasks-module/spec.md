## MODIFIED Requirements

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
- **WHEN** a focused or open task receives the checklist keyboard command outside the ordinary insertion-slot draft
- **THEN** Tasks opens the task if necessary, creates one empty checklist row immediately before the first completed checklist item, and focuses that new row
- **AND** when no completed checklist item exists, Tasks appends and focuses the new empty row at the end of the checklist

#### Scenario: Toggle checklist focus to the top
- **WHEN** keyboard focus is inside the empty checklist draft at the ordinary insertion slot and the user invokes the checklist keyboard command again
- **THEN** Tasks moves and focuses that empty draft at the top of the checklist without persisting an empty item
- **AND** invoking the command from that focused top draft moves and focuses it back at the ordinary insertion slot

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
- **THEN** the card presents its summary row followed by Summary, Start, Deadline, Area when available, Actionability, existing optional Notes, Link, and Checklist content, and the missing-content action row in DOM, visual, and keyboard order
- **AND** Checklist remains the final content editor when all optional content exists

#### Scenario: Keep disclosed Notes visibly multiline
- **WHEN** Notes is disclosed and empty or contains no more than two visible lines
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

#### Scenario: Present absent optional-content actions
- **WHEN** one or more of Notes, Link, or Checklist is absent from an expanded task
- **THEN** the drawer presents the corresponding `+ Notes`, `+ Link`, and `+ Checklist` actions in that order as evenly distributed primary-outline buttons in one row at the bottom of the drawer
- **AND** each present action receives an equal share of the available row width without reserving columns for content that already exists

#### Scenario: Reveal optional task content
- **WHEN** the user activates an absent Notes, Link, or Checklist action
- **THEN** that action leaves the bottom disclosure row, the associated standard editor appears, and Tasks places the text cursor in the revealed control

#### Scenario: Restore an empty optional-content action
- **WHEN** a revealed optional content field remains empty when the drawer closes
- **THEN** Tasks treats that content as absent and presents its add action the next time the drawer opens

#### Scenario: Preserve disclosure layout during planning changes
- **WHEN** the user changes Start or destination while an expanded task already has optional content or missing-content actions
- **THEN** existing content remains on its own full-width row and the missing-content action group remains a single evenly distributed bottom row
- **AND** selecting Someday does not recombine existing content with the disclosure row

#### Scenario: Present an existing Link as a URL control
- **WHEN** the expanded task has a Link or the user has disclosed its input
- **THEN** the editor uses a standard full-size URL input without a dedicated one-click clear button, hides the adjacent activation control while the input is empty, reveals that control as soon as any character is present, and enables activation only for a resolvable supported destination

#### Scenario: Compact a checklist-ended drawer
- **WHEN** an expanded task has Notes, Link, and Checklist content, no optional-content actions remain, and Checklist is the final drawer content
- **THEN** the drawer uses reduced bottom padding consistent with the spacing between its ordinary controls

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

### Requirement: Revised Control task-command layout
BathOS Tasks SHALL expose the revised Control-based task-command layout, SHALL remove the displaced task-command assignments, and SHALL preserve platform-standard Undo and Redo behavior.

#### Scenario: Windows task commands use shifted Alt
- **WHEN** a user operates Tasks on Windows
- **THEN** every revised Tasks-specific command SHALL use Alt+Shift with the same letter assigned to Control on Mac
- **AND** unshifted Windows Control combinations SHALL retain their standard application meanings

#### Scenario: Focus or reveal Link
- **WHEN** exactly one task is open, keyboard-focused, or selected in selection mode and the user invokes Control+H on Mac or Alt+Shift+H on Windows
- **THEN** Tasks opens the task if necessary, reveals Link if absent, focuses its input, and places the caret at the end of its current value
- **AND** when the same command is invoked while a collapsed caret is already at the end of that Link input, Tasks moves the caret to its beginning

#### Scenario: Focus or reveal Notes
- **WHEN** exactly one task is open, keyboard-focused, or selected in selection mode and the user invokes Control+N on Mac or Alt+Shift+N on Windows
- **THEN** Tasks opens the task if necessary, reveals Notes if absent, focuses its input, and places the caret at the end of its current value
- **AND** when the same command is invoked while a collapsed caret is already at the end of that Notes input, Tasks moves the caret to its beginning

#### Scenario: Ignore field focus commands for ambiguous task selection
- **WHEN** no single task target exists or more than one task is selected
- **THEN** the Link and Notes field-focus commands do not open or focus a task editor

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

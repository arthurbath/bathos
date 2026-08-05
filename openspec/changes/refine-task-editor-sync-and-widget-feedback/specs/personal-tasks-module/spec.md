## ADDED Requirements

### Requirement: Notes receives an explicit task command
Tasks SHALL preserve ordinary native cursor movement inside Summary and SHALL provide a dedicated task command for focusing Notes.

#### Scenario: Keep Summary cursor movement native
- **WHEN** Summary is editing and the user presses an unmodified arrow key at any insertion point
- **THEN** the browser moves or preserves the text selection natively without transferring focus to Notes

#### Scenario: Focus Notes directly
- **WHEN** Control+N on Mac or Alt+Shift+N on Windows targets one open task outside selection mode
- **THEN** Tasks suppresses the matching browser command, focuses Notes, and places its insertion point at the end of the current Notes source

#### Scenario: Ignore the Notes command without one open task
- **WHEN** the Notes command is invoked with no open task or while selection mode is active
- **THEN** Tasks suppresses no unrelated text input and does not mutate a task

### Requirement: Start clearing closes its active picker
The direct Clear Start command SHALL close an open Start picker for its target after applying the clear operation.

#### Scenario: Clear Start while its picker is open
- **WHEN** Control+R on Mac or Alt+Shift+R on Windows targets an open task whose Start picker is open
- **THEN** Tasks clears Start, Today horizon, and Start-dependent reminder state, closes the picker, and leaves the task editor open

#### Scenario: Clear Start without opening its picker
- **WHEN** the direct Clear Start command targets an open task whose Start picker is closed
- **THEN** Tasks applies the same planning mutation without opening Start

### Requirement: Open Today tasks retain their rendered placement
Tasks SHALL keep an expanded Today task in its opened bucket and slot until the editor closes even when accepted metadata removes it from Today.

#### Scenario: Clear Start from an open Today task
- **WHEN** an expanded Today task has its Start and Today horizon cleared
- **THEN** its editor remains visible in the bucket and slot where it opened while its displayed metadata reflects the accepted clear

#### Scenario: Reconcile after closing the Today task
- **WHEN** the cleared task editor closes after pending autosave succeeds
- **THEN** Tasks removes it from Today, keeps it available in Anytime, and emits departure feedback only after the task has left the current view

### Requirement: Empty Summary follows meaningful-content persistence
Tasks SHALL allow a blank Summary when other meaningful task content exists and SHALL recoverably delete an existing task that is closed without meaningful user content.

#### Scenario: Preserve a blank Summary with Notes
- **WHEN** a user clears Summary while Notes contains at least one non-whitespace character and closes the editor
- **THEN** Tasks persists the blank Summary and retains the task without restoring the former Summary

#### Scenario: Preserve a blank Summary with a Primary Link
- **WHEN** a user clears Summary while Primary Link contains a nonblank value and closes the editor
- **THEN** Tasks persists the blank Summary and retains the task without restoring the former Summary

#### Scenario: Preserve a blank Summary with Checklist content
- **WHEN** a user clears Summary while at least one checklist item contains non-whitespace text and closes the editor
- **THEN** Tasks persists the blank Summary and retains the task without restoring the former Summary

#### Scenario: Trash a task with no meaningful content
- **WHEN** an existing task closes with blank Summary, blank Notes, no Primary Link, and no nonblank checklist items
- **THEN** Tasks moves the task to Done with the deleted disposition through the ordinary recoverable-delete lifecycle

### Requirement: Far-future Upcoming rows identify Start
Upcoming SHALL show the controlling Start date in the metadata line when a task falls beyond the seven-day daily horizon.

#### Scenario: Show a distant Upcoming Start
- **WHEN** an ordinary Upcoming task begins more than seven owner-local calendar days after the planning date
- **THEN** its metadata line shows the Start icon and short month-and-day value after Area and before Reminder

#### Scenario: Omit redundant nearby Start metadata
- **WHEN** an Upcoming task appears within the seven-day daily horizon where its bucket communicates the Start date
- **THEN** the metadata line omits the additional Start month-and-day item

### Requirement: Reminder toast presents compact temporal context
An in-app reminder fallback toast SHALL identify the reminder with a compact icon and SHALL prefix the task Summary with the owner-local reminder time.

#### Scenario: Present a reminder fallback toast
- **WHEN** a due reminder is delivered as an in-app toast at 10:05 AM for a task whose Summary is `Example task summary`
- **THEN** the toast title remains `Reminder`, its body is `10:05 AM: Example task summary`, and its leading Reminder icon uses the compact toast-icon size

## MODIFIED Requirements

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
- **THEN** the card presents its summary row followed by Summary, Start, Deadline, Area when available, Actionability, Notes, Primary Link disclosure or input, and Checklist disclosure or items in DOM, visual, and keyboard order

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
- **THEN** the editor reveals the standard full-size URL input after Notes and before Checklist and places the text cursor in that input

#### Scenario: Present an existing Primary Link as a URL control
- **WHEN** the expanded task has a Primary Link or the user has disclosed its input
- **THEN** the editor uses a standard full-size URL input without a dedicated one-click clear button, hides the adjacent activation control while the input is empty, reveals that control as soon as any character is present, and enables activation only for a resolvable supported destination

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

## REMOVED Requirements

### Requirement: Summary supports forward cursor traversal into Notes
**Reason**: Right Arrow at the end of Summary must remain ordinary text editing and Notes now has a dedicated Control+N command.

**Migration**: Use Control+N on Mac or Alt+Shift+N on Windows to focus the end of Notes for the open task.

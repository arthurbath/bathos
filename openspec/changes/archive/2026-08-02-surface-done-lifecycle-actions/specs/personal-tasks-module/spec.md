## MODIFIED Requirements

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

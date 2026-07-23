## ADDED Requirements

### Requirement: Deferral-Anchored Reminder Time
The system SHALL allow at most one active reminder per to-do or project, SHALL derive its calendar date from that item's future-only start date, and SHALL expose only its local time as user-editable reminder intent.

#### Scenario: Add a reminder to scheduled work
- **WHEN** a user assigns a reminder time to an open item with a start date
- **THEN** the system resolves one reminder on that start date in the owner's planning time zone and does not request or store an independently chosen reminder date

#### Scenario: Withhold reminders from undated work
- **WHEN** an open item has no start date
- **THEN** the interface hides Reminder Time and every mutation surface rejects a new reminder for that item

#### Scenario: Clear a future start date with a reminder
- **WHEN** a user manually clears the future start date from an item that has an active reminder
- **THEN** the system cancels its reminder and pending occurrence while retaining or clearing its day horizon according to the requested active placement

#### Scenario: Activate work without losing its same-day reminder
- **WHEN** the owner-local start date arrives before the item's resolved reminder time
- **THEN** activation clears the parent start date, retains its day horizon, and preserves the already-scheduled occurrence so it remains deliverable that day

#### Scenario: Move the start date with a reminder
- **WHEN** a user changes an item's start date while retaining its reminder time
- **THEN** the system re-resolves the reminder against the new date and replaces the prior pending occurrence exactly once

#### Scenario: Normalize existing reminder data
- **WHEN** the start-anchored reminder migration encounters an active reminder
- **THEN** it rebinds that reminder to its parent's start date when present and cancels it when the parent is undated without deleting the parent item

## MODIFIED Requirements

### Requirement: Independent Task Day Horizon
The system SHALL store an optional to-do or project day horizon independently for active work and SHALL require one of `inbox`, `now`, `next`, or `later` while a future start date exists.

#### Scenario: Default a newly assigned start date to Next
- **WHEN** a user assigns a start date without explicitly selecting a day horizon
- **THEN** the system stores `next` for that item

#### Scenario: Retain a future day horizon
- **WHEN** a user assigns a future start date and Inbox, Now, Next, or Later to an Anytime to-do or project
- **THEN** the system keeps the item in Upcoming until its owner-local start date and retains the selected day horizon unchanged

#### Scenario: Keep undated work outside Today
- **WHEN** an open present Anytime item has no start date and no day horizon
- **THEN** the system includes it in Anytime while withholding it from Today

#### Scenario: Keep active undated work in Today
- **WHEN** an open present Anytime item has no start date and an Inbox, Now, Next, or Later horizon
- **THEN** the system includes it in Anytime and the selected Today section

#### Scenario: Preserve horizon through structured generation and portability
- **WHEN** templates, recurrence, MCP, export, merge, replacement restore, or synchronization carry an Anytime item's planning state
- **THEN** the system requires a horizon for a future date, permits a horizon on active undated work, and normalizes reached dates to null while retaining or defaulting the active horizon

### Requirement: Core Task Organization
The system SHALL organize active work through Anytime, Someday, areas, projects, to-dos, and checklist items without headings, a separate Inbox destination, generic tags, multiple membership, or required parent containers.

#### Scenario: Organize work in a project
- **WHEN** a user places a to-do under a project
- **THEN** the to-do belongs to exactly that one project and retains its stable identity and planning membership

#### Scenario: Organize ongoing responsibility
- **WHEN** a user places a project or loose to-do in an area
- **THEN** the item belongs to exactly that one area and the system includes it in that area's active work

#### Scenario: Leave work unattached
- **WHEN** a to-do has no project or area, or a project has no area
- **THEN** the system preserves that valid unattached state without inventing a container

#### Scenario: Review active work in an area
- **WHEN** a user opens an area from Projects
- **THEN** the interface presents that owner's present open loose to-dos and projects, preserves real links to project details and each to-do's current planning view, and excludes Done or unrelated work

#### Scenario: Keep project membership canonical
- **WHEN** a to-do belongs to a project whose area changes
- **THEN** the to-do remains in its one project, derives its area from that project, and does not retain a competing direct area assignment

#### Scenario: Keep project identity legible beside lifecycle controls
- **WHEN** a project with a long title is opened at 390 CSS pixels wide
- **THEN** the complete project title occupies its own mobile row without overlapping or collapsing behind Complete, Cancel, Reopen, or Delete actions, and the actions remain fully operable

#### Scenario: Move a to-do between containers
- **WHEN** a user moves a to-do to one area, one project, or no container
- **THEN** the system clears incompatible parent references, preserves the to-do's stable identity and planning state, and assigns an order within the new hierarchy scope

#### Scenario: Maintain a checklist
- **WHEN** a user adds, edits, reorders, completes, reopens, or recoverably removes a checklist item
- **THEN** the checklist item remains owned by exactly one to-do and its completion state remains independent from the parent to-do's lifecycle

#### Scenario: Order hierarchy independently from planning views
- **WHEN** a user reorders an area, project, project to-do, loose area to-do, unattached to-do, or checklist item
- **THEN** the system changes only the selected item's hierarchy order and does not change its order or membership in Today, Anytime, Someday, Upcoming, or Done

#### Scenario: Preserve to-dos while removing headings
- **WHEN** the system migrates a to-do previously assigned to a heading
- **THEN** it retains the to-do in the same project with the same stable identity, task content, planning state, hierarchy order, checklist, history, and source metadata while removing the heading reference

#### Scenario: Capture new work for triage
- **WHEN** a user or supported integration creates a to-do without an explicit planning placement
- **THEN** the system creates one open present Anytime to-do with no start date and the Today Next horizon

### Requirement: Readable Markdown Task Notes
The system SHALL retain task notes as plain text while presenting one complete, directly editable, live-styled Markdown source surface in an expanded to-do without separate editing and preview modes.

#### Scenario: Edit complete live-styled source
- **WHEN** a user opens a to-do and edits its notes
- **THEN** the interface keeps the complete plain-text source directly editable without an internal height limit, preserves every Markdown delimiter visibly, and updates recognized Markdown styling as the source changes without requiring an alternate mode

#### Scenario: Limit live Markdown recognition
- **WHEN** notes contain supported Markdown syntax
- **THEN** the editor recognizes headings introduced by one or more hashmarks and a space, single-asterisk italic, double-asterisk bold, asterisk-plus-space bullets, Markdown links, and single-backtick inline code while treating other Markdown constructs as ordinary text

#### Scenario: Style Markdown indicators
- **WHEN** the editor recognizes a heading, italic, bold, bullet, or Markdown link
- **THEN** the original hashmark-and-space, asterisk, bracket, and parenthesis indicators remain visible in a fixed-width font while the complete recognized construct receives its heading, italic, bold, bullet, or link presentation

#### Scenario: Style inline code completely
- **WHEN** the editor recognizes text enclosed by single backticks on one line
- **THEN** the complete string including both backticks uses a fixed-width font and a light semantic background

#### Scenario: Continue an asterisk bullet
- **WHEN** a user presses Enter without Shift while editing a line that begins with `* `
- **THEN** the editor inserts a new line beginning with `* ` and wraps each bullet with a two-fixed-width-character hanging indent

#### Scenario: Follow a note link
- **WHEN** notes contain a Markdown link, bare HTTP(S) URL, or bare alphanumeric `scheme://` destination such as `message://`
- **THEN** the live editor exposes the safe destination with a pointer cursor and no hover underline, opens HTTP(S) in a new browser context, dispatches `message://` to Mail, and keeps known executable or content-injection schemes inert

#### Scenario: Preserve editing mechanics while styling
- **WHEN** the editor retokenizes changed source
- **THEN** it preserves the user's caret or selection, defers decoration during composition, accepts pasted content as plain text, yields documented undo and redo commands to Tasks, and autosaves the identical source to the same notes field

#### Scenario: Start empty notes directly
- **WHEN** an expanded to-do has empty notes
- **THEN** the same live editor presents its placeholder without requiring a separate preview step

### Requirement: Date-Based Planning Views
The system SHALL derive Today, Upcoming, Anytime, Someday, and Done from task state, owner-local start dates, deadlines, independent day horizons, and terminal timestamps.

#### Scenario: Defer work to a future date
- **WHEN** a user assigns a future start date to a to-do or project
- **THEN** the system includes the item in Upcoming, withholds it from Today and Anytime until its owner-local start date arrives, and stores its selected horizon or Next by default

#### Scenario: Store an uncommitted possibility
- **WHEN** a user assigns a to-do or project to Someday
- **THEN** the system clears its start date, day horizon, and reminder and withholds it from Today, Upcoming, and Anytime

#### Scenario: Activate Someday work
- **WHEN** a user moves a Someday item to Anytime without a start date
- **THEN** the system changes its destination to Anytime, includes it in Anytime, and retains a null day horizon

#### Scenario: Schedule Someday work
- **WHEN** a user assigns a start date and optional day horizon to Someday work
- **THEN** the system changes its destination to Anytime, includes it in Upcoming or available views according to that date, and stores the chosen horizon or Next by default

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

#### Scenario: Preserve a future day horizon
- **WHEN** a user opens Upcoming for an item with a future start date
- **THEN** the interface preserves and exposes its Inbox, Now, Next, or Later horizon without showing the item in Today early

#### Scenario: Remove work from Today
- **WHEN** a user removes Today placement from a to-do
- **THEN** the system clears its day horizon, removes the to-do from Today, and keeps it undated in Anytime without changing its identity or container

#### Scenario: Activate deferred work
- **WHEN** an Anytime item reaches its owner-local start date
- **THEN** an idempotent activation clears its start date, retains its selected horizon, and includes it in Anytime and Today

#### Scenario: Complete, cancel, or delete work
- **WHEN** a user completes, cancels, or deletes a to-do or supported hierarchy root
- **THEN** the system removes it from active planning views and includes it in Done until recovery or automatic purge

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

#### Scenario: Preserve non-actionable work in a planned view
- **WHEN** a waiting or rechecking to-do belongs to Today, Anytime, Someday, Upcoming, a project, or another defined view
- **THEN** the system keeps it in that deliberate placement, presents its exact actionability state, and excludes it only when an actionability filter requests actionable work

#### Scenario: Reject actionability changes outside active work
- **WHEN** a caller attempts to change actionability on completed, canceled, or recoverably deleted work
- **THEN** the system rejects the mutation without changing the record or appending history

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
- **THEN** `message://` uses a Mail icon and operating-system dispatch, HTTP(S) uses a Link icon and new browser context, and another value uses a Link icon and an HTTPS destination formed by prepending `https://`

#### Scenario: Reopen a structured task source
- **WHEN** the interface displays present active or terminal work whose typed source contains a supported HTTP(S), Mail-message, or originating-Mac file reference
- **THEN** it exposes a named real link derived from the structured source fields, opens web sources in a separate browser tab, hands platform deep links to their originating application, and never parses the task title or notes to find the source

#### Scenario: Present provenance without an actionable source link
- **WHEN** a task has typed source provenance but its source reference is absent, malformed, or uses a protocol outside that source type's supported contract
- **THEN** the interface retains a visible named origin indicator without exposing the reference as an actionable link

#### Scenario: Retry an automated capture
- **WHEN** an automated entry channel retries creation with the same idempotency key
- **THEN** the system returns the original task and does not duplicate the source record

#### Scenario: Render an origin indicator
- **WHEN** the interface displays a task whose origin has a configured indicator
- **THEN** the interface derives that presentation from origin metadata rather than parsing the task title

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for open tasks and SHALL apply supported day-horizon, future scheduling, Anytime, or Someday actions to selected records as one local transaction.

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
- **WHEN** selection is active and a user ordinarily clicks, Command-clicks on Mac, or Control-clicks on Windows on a visible task
- **THEN** the interface toggles that task's selected state without opening its editor

#### Scenario: Preserve ordinary task expansion
- **WHEN** selection is inactive and a user ordinarily clicks a task
- **THEN** the interface opens or closes that task's editor exactly as before

#### Scenario: Operate selection accessibly
- **WHEN** one or more visible tasks are selected in Today, Upcoming, Anytime, or Someday
- **THEN** the interface reports the selected count, exposes Select All and Clear, and communicates each selected state to keyboard and assistive-technology users without requiring a persistent header selection button

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Preserve a bulk horizon while scheduling
- **WHEN** a user applies a future date to selected tasks with an Inbox, Now, Next, or Later horizon
- **THEN** the system retains the requested horizon for every valid selected task while the tasks remain in Upcoming

#### Scenario: Allow deliberately overdue bulk work
- **WHEN** a requested start date is later than one or more selected deadlines
- **THEN** the system retains those deadlines and accepts the schedule when every selected record is otherwise valid

#### Scenario: Reject one invalid bulk member
- **WHEN** any selected task is no longer open and present
- **THEN** the system rejects the operation without writing any selected task and leaves selection available for correction or retry

#### Scenario: Keep bulk scope bounded
- **WHEN** the user exits selection, changes views, or completes a successful bulk plan
- **THEN** the client clears selection and its range anchor and returns to ordinary editing without adding bulk completion, deletion, or hierarchy mutation

### Requirement: Native Templates
The system SHALL support reusable, revisioned to-do and project template definitions that are separate from active task records and contain no heading layer.

#### Scenario: Create work from a template
- **WHEN** a user instantiates a to-do or project template revision with an explicit planning anchor
- **THEN** the system atomically creates independent active areas, projects, to-dos, and checklist items, resolves relative planning values, and records template, revision, instantiation, and template-node provenance

#### Scenario: Edit an instantiated task
- **WHEN** a user edits work created from a template
- **THEN** the system does not modify the source template unless the user explicitly chooses a template-editing action

#### Scenario: Keep templates out of active views
- **WHEN** a template definition exists but has not been instantiated
- **THEN** the system excludes the definition from Today, Upcoming, Anytime, Someday, and Done

#### Scenario: Revise a template
- **WHEN** a user edits a template that already has generated instances
- **THEN** the system creates a new current template revision and leaves every existing instance unchanged

#### Scenario: Retry template instantiation
- **WHEN** a caller retries instantiation with the same idempotency key
- **THEN** the system returns the original generated hierarchy and never exposes a duplicate or partial instance

#### Scenario: Reject a changed template retry
- **WHEN** a caller reuses a template-instantiation idempotency key with a different template, revision, anchor, target area, channel, or actor
- **THEN** the system rejects the request and leaves the original generated hierarchy unchanged

#### Scenario: Capture relative planning from current work
- **WHEN** a user saves a current open to-do or project hierarchy as a template revision with an explicit reference date
- **THEN** the system stores immutable relative start-date and deadline offsets, independent day horizons, ordering, actionability, and checklist content without treating the source work as the template definition

#### Scenario: Normalize a legacy heading template
- **WHEN** the system instantiates a legacy project-template revision containing heading nodes
- **THEN** it preserves each descendant to-do directly beneath the project in deterministic order and creates no heading record or reference

#### Scenario: Capture a template during a concurrent edit
- **WHEN** a source to-do or project hierarchy changes while template capture is reading it
- **THEN** the stored source revision and complete hierarchy snapshot come from one database statement snapshot rather than mixing source state from different moments

#### Scenario: Archive a used template
- **WHEN** a user deletes a template that has generated instances
- **THEN** the system archives the definition, excludes it from new-template selection, and preserves readable provenance for existing work

#### Scenario: Hydrate an owner-safe template response
- **WHEN** an authenticated template RPC omits the owner identifier from its returned definition, revision, or instantiation
- **THEN** the client assigns the already authenticated owner to the parsed result without requiring the server to echo an owner identifier

### Requirement: Temporal Planning Semantics
The system SHALL store Start Date as a future-only deferral calendar fact, store Deadline independently, retain day horizons for active Today work, derive activation and Today from the owner's IANA planning time zone, and store reminder times as unambiguous instants resolved on the future start date.

#### Scenario: Start date and deadline coexist in either order
- **WHEN** a to-do has both a start date and a deadline
- **THEN** the system requires the start date to be future, uses it to control deferral, retains the deadline as an informational completion boundary, and accepts either ordering between those two dates

#### Scenario: Continue work after its deadline
- **WHEN** a caller assigns a start date later than the retained deadline
- **THEN** the system accepts the mutation, preserves the overdue deadline, and keeps the item available according to the new start date

#### Scenario: Travel across time zones
- **WHEN** the owner's current or planning time zone changes
- **THEN** date-only start and deadline values remain assigned to the same calendar dates and Today eligibility follows the owner-local planning date

#### Scenario: Reject a reached Start Date
- **WHEN** a user or automation attempts to assign today or an earlier calendar date as Start Date
- **THEN** the system rejects the value without changing the task because Start Date represents only future deferral

#### Scenario: Activate a reached Start Date
- **WHEN** time advances to a stored Start Date in the owner's planning time zone
- **THEN** local and server activation converge on a null start date, retained day horizon, one accepted revision transition, and defensive Today visibility while synchronization catches up

#### Scenario: Place work in a day horizon
- **WHEN** a user selects Inbox, Now, Next, or Later for Anytime work
- **THEN** the system records the active horizon without inventing a start date or reminder time

#### Scenario: Edit start date and dependent controls
- **WHEN** a user opens a to-do's temporal planning controls
- **THEN** the interface always presents Start Date, presents Day Horizon for active Today or deferred work, and presents Reminder Time only when Start Date contains a future value, with complete keyboard operation

#### Scenario: Resolve a reminder
- **WHEN** a caller schedules a reminder with a wall-clock time and IANA time zone for an item with a start date
- **THEN** the system stores that time intent and the resulting UTC instant on the item's future start date for every delivery client

#### Scenario: Resolve a nonexistent reminder time
- **WHEN** a requested local reminder time falls in a daylight-saving gap on the item's start date
- **THEN** the system selects the first valid instant after the gap and records the adjustment

#### Scenario: Resolve an ambiguous reminder time
- **WHEN** a requested local reminder time occurs twice during a daylight-saving transition and the caller supplies no preference
- **THEN** the system selects the earlier instant and records that choice

#### Scenario: Display a reminder after travel
- **WHEN** the owner's display time zone changes after a reminder is resolved
- **THEN** the interface converts the stored instant for display without moving the scheduled instant

### Requirement: Keyboard-First Daily Operation
The system SHALL provide modifier-based keyboard operation for capture, editing, Today planning, direct view navigation, list traversal, lifecycle transitions, and dialogs while suppressing every matching browser-level command inside the mounted Tasks module.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Complete selected work
- **WHEN** a user invokes Control+D on Mac or Control+Shift+D on Windows while a to-do is open
- **THEN** the system toggles that to-do's pending completion state without closing its editor or transitioning it to Done

#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task title and no editor, unrelated modal, or composition event owns keyboard input
- **THEN** Enter retains ordinary button activation, Option+Up or Option+Down on Mac and Alt+Up or Alt+Down on Windows reorder within the current scope, and no unmodified letter or arrow key triggers a Tasks command

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, cancellation, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then task capture or the primary view heading when no task remains

#### Scenario: Open task capture, search, or keyboard help
- **WHEN** a keyboard user presses Command+N or Command+/ on Mac, or Control+N or Control+/ on Windows
- **THEN** the module respectively focuses task capture or opens a visible keyboard-command reference and suppresses the matching browser command

#### Scenario: Submit inline hierarchy capture
- **WHEN** a keyboard user enters a nonblank area, project, project to-do, or checklist-item name and presses Enter without an active composition event
- **THEN** the corresponding hierarchy form submits exactly as its visible add button would

#### Scenario: Search and filter without unstructured labels
- **WHEN** a user searches present work or filters the result set
- **THEN** the module matches task text and structured source or hierarchy context, filters through explicit planning destination, lifecycle, all three actionability states, and source-kind fields, and does not introduce generic tags

#### Scenario: Open a task across views from search
- **WHEN** a user activates a task search result
- **THEN** the module navigates through a real in-app link to the task's current planning or history view and opens or focuses the stable task record

#### Scenario: Keep structural movement and temporal planning distinct
- **WHEN** a user invokes `M` or `W` on a focused open task
- **THEN** `M` changes only area or project placement while `W` changes only planning destination, start date, day horizon, or reminder time

#### Scenario: Restore focus after a movement command
- **WHEN** a structural or temporal movement command succeeds and its command surface closes
- **THEN** focus returns to the moved task when it remains in the current view, or follows the same-position, prior-task, capture, and primary-heading fallback when the move removes it

#### Scenario: Autosave free-text editing
- **WHEN** a user changes a to-do title or notes in an open editor
- **THEN** the local value changes immediately and the module persists the latest nonblank title or exact notes source after a short debounce without a Save or Cancel action

#### Scenario: Autosave structured editing
- **WHEN** a user changes actionability, organization, start date, day horizon, deadline, reminder time, or reminder ambiguity in an open to-do
- **THEN** the module persists the changed field immediately without waiting for another field or an explicit submission

#### Scenario: Preserve autosave order
- **WHEN** a user makes multiple edits while one or more earlier autosave writes remain in flight
- **THEN** the module submits and resolves the writes in interaction order so an earlier request cannot replace a later accepted value

#### Scenario: Flush autosave on close
- **WHEN** a user closes an editor, opens another to-do, or leaves the current task view while a free-text debounce is pending
- **THEN** the module submits the latest valid draft and waits for that ordered write before committing any deferred completion for the closing to-do

#### Scenario: Keep autosave visually quiet
- **WHEN** an autosave write is pending or succeeds
- **THEN** the editor remains interactive and shows no routine saving or saved indicator

#### Scenario: Preserve autosave history
- **WHEN** an autosave batch is accepted
- **THEN** it is recorded as an ordinary task mutation that can be traversed by app-level undo and redo across to-dos

#### Scenario: Recover from autosave failure
- **WHEN** an autosave write fails while the editor remains open
- **THEN** the module reports the failure through its existing error notice, keeps the local draft available, and permits a later edit to retry persistence

#### Scenario: Override browser commands intentionally
- **WHEN** the user invokes a documented Tasks modifier command while focus is anywhere inside the mounted Tasks route, including an editable control
- **THEN** a capture-phase handler prevents the default browser action, stops later keyboard handling, and dispatches only the Tasks command outside active composition

#### Scenario: Own app undo and redo
- **WHEN** the user presses Command+Z or Command+Shift+Z on Mac, or Control+Z or Control+Shift+Z on Windows
- **THEN** Tasks suppresses browser and text-editor history everywhere in the module and invokes the available app-level undo or redo action, otherwise performing a Tasks no-op

#### Scenario: Navigate views by number
- **WHEN** the user presses Command+1 through Command+8 on Mac, or Control+1 through Control+8 on Windows
- **THEN** Tasks navigates directly to Today, Upcoming, Anytime, Someday, Projects, Templates, Done, or Config respectively and suppresses browser tab-number navigation

#### Scenario: Open the next visible to-do
- **WHEN** the user presses Control+S on Mac or Control+Shift+S on Windows
- **THEN** Tasks opens the first visible to-do when none is open, otherwise closes the current editor and opens the next visible to-do, closing without wrapping when the current to-do is last

#### Scenario: Open the previous visible to-do
- **WHEN** the user presses Control+W on Mac or Control+Shift+W on Windows
- **THEN** Tasks opens the last visible to-do when none is open, otherwise closes the current editor and opens the previous visible to-do, closing without wrapping when the current to-do is first

#### Scenario: Focus a newly opened title
- **WHEN** a pointer, search result, or keyboard traversal command opens a to-do
- **THEN** focus lands in the title input with its insertion point at the end and the page scrolls only as needed to reveal that title, never the bottom of a long editor

#### Scenario: Animate inline editor disclosure
- **WHEN** a user opens or closes a to-do and reduced motion is not requested
- **THEN** Tasks quickly animates the editor's expansion or collapse and smoothly adjusts page scroll only when needed to reveal the opened row

#### Scenario: Close an editor from outside
- **WHEN** a pointer interaction begins outside the open to-do and any calendar, menu, listbox, or dialog launched from its editor
- **THEN** Tasks flushes pending autosave, closes the editor, and commits any deferred completion through the ordinary close path

#### Scenario: Retain an open task's list projection
- **WHEN** autosaved planning or organization metadata would remove or regroup the currently open to-do
- **THEN** Tasks keeps that row at its original visible position and group with the latest editable values until the editor closes, then applies current view membership exactly once

#### Scenario: Edit repeated planning values before closure
- **WHEN** a user changes Start Date, Day Horizon, Deadline, or Organization multiple times while the to-do remains open
- **THEN** every accepted change autosaves in order without unmounting or moving the editor, and the final accepted state controls projection after closure

#### Scenario: Reduce editor disclosure motion
- **WHEN** the operating system requests reduced motion
- **THEN** Tasks opens, closes, and reveals the editor without a visible expansion transition or smooth scrolling

#### Scenario: Defer open to-do completion
- **WHEN** a user activates the completion control while its to-do editor is open
- **THEN** the control toggles a visible pending completion state and the to-do remains open and absent from Done

#### Scenario: Commit deferred completion on close
- **WHEN** an editor with pending completion closes, navigates to another to-do, or leaves its view
- **THEN** Tasks flushes its pending autosave and transitions that to-do to Done exactly once after the editing session ends

#### Scenario: Complete a closed to-do immediately
- **WHEN** a user activates the completion control for a to-do whose editor is closed
- **THEN** Tasks immediately transitions that to-do to Done and applies the documented focus fallback

#### Scenario: Close and clear page focus
- **WHEN** the user presses Control+X on Mac or Control+Shift+X on Windows while a to-do is open
- **THEN** Tasks closes the editor, commits any pending completion, and removes focus from every page control

#### Scenario: Preserve other native input behavior
- **WHEN** focus is in an input, textarea, select, content-editable surface, menu, or dialog and the key chord is not a documented Tasks command
- **THEN** native typing, composition, selection, Tab traversal, and control behavior remain available

#### Scenario: Traverse a task and its complete editor
- **WHEN** a keyboard user advances or reverses focus through a task row or expanded task editor
- **THEN** every available interactive control receives visible focus in documented order and unavailable controls are skipped

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
- **THEN** the specialized service creates one unassigned or area-assigned undated Anytime task with Today Next horizon, an editable Primary Link initialized from the Mail deep link, and a retained source record in one transaction with no generic fallback write

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

#### Scenario: Capture from the keyboard
- **WHEN** the user presses Command+N on Mac or Control+N on Windows
- **THEN** the interface focuses the current capture field or navigates to Today and focuses capture

#### Scenario: Navigate task views
- **WHEN** the user presses the documented Command+number or Control+number chord
- **THEN** the interface navigates directly to Today, Upcoming, Anytime, Someday, Projects, Templates, Done, or Config while suppressing browser tab-number behavior

#### Scenario: Search tasks and views
- **WHEN** the user activates the visible Search Tasks and Views control
- **THEN** a dialog searches owner-scoped tasks and current views and supports keyboard selection without exposing retired Inbox, Logbook, or Trash destinations

#### Scenario: Preserve native editing behavior
- **WHEN** focus is inside an input, textarea, select, content-editable surface, menu, or dialog
- **THEN** undocumented key chords do not replace native typing, composition, selection, or control behavior, while documented Tasks modifier commands retain precedence

### Requirement: Concise Task View Presentation
The system SHALL use the active view name, compact self-evident controls, progressive disclosure, and small structured day-horizon markers so routine browsing remains uncluttered.

#### Scenario: Name the active view
- **WHEN** any supported Tasks route renders
- **THEN** the primary heading identifies Today, Upcoming, Anytime, Someday, Projects, Project, Area, Templates, Done, or Config at every viewport

#### Scenario: Create an area progressively
- **WHEN** a user activates Add Area from Projects
- **THEN** a title-only BathOS form dialog requests the required area title, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Area after close

#### Scenario: Create a project progressively
- **WHEN** a user activates Add Project from Projects
- **THEN** a title-only BathOS form dialog requests the required project title and optional area, disables Save til the title is nonblank, supports Enter submission and complete keyboard traversal, and restores focus to Add Project after close

#### Scenario: Browse projects without setup clutter
- **WHEN** the Projects view is not creating an area or project
- **THEN** it shows compact icon-only Add Area and Add Project controls with nonempty programmatic names and does not render permanent creation fields

#### Scenario: Mark a resolved day horizon
- **WHEN** an active Anytime or deferred Upcoming row has an Inbox, Now, Next, or Later horizon
- **THEN** the row displays compact Lucide iconography with a nonempty accessible name identifying that horizon without repeating a verbose sentence

#### Scenario: Omit an unavailable day-horizon marker
- **WHEN** an undated Anytime row has a null day horizon
- **THEN** the row does not reserve empty marker space or show a decorative icon

#### Scenario: Summarize nearby calendar dates relatively
- **WHEN** a displayed Start Date, Deadline, or reminder date differs from the owner-local planning date by no more than 10 days
- **THEN** the row uses Today, Tomorrow, one day ago, N days ago, or N days left as appropriate

#### Scenario: Summarize distant calendar dates compactly
- **WHEN** a displayed date is more than 10 days before or after the owner-local planning date
- **THEN** the row uses a short month and numeric day such as Aug 27

#### Scenario: Arrange the open editor compactly
- **WHEN** a to-do editor is open
- **THEN** Actionability and Organization share one responsive row, temporal controls use one compact responsive row with no full-width reminder container, and Deadline follows on the next row

#### Scenario: Browse Done without archive ceremony
- **WHEN** a user opens Done
- **THEN** the interface shows retained terminal work in reverse terminal order with its terminal reason, date, and one appropriate restore or reopen action

#### Scenario: Create hierarchy progressively
- **WHEN** a user creates an area or project from Projects
- **THEN** compact icon-only controls open title-only keyboard-complete BathOS dialogs and restore trigger focus after close

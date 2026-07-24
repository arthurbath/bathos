## MODIFIED Requirements

### Requirement: Bulk Task Planning
The system SHALL provide an accessible task-row selection mode for visible to-dos, SHALL treat selection as a temporary context bounded by to-do rows and selection-owned surfaces, SHALL expose its controls as a fixed bottom overlay that does not move list content, and SHALL apply only lifecycle-appropriate planning or clipboard actions to selected records.

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
- **WHEN** one or more visible to-dos are selected in Today, Upcoming, Anytime, Someday, or Done
- **THEN** the fixed bottom selection overlay reports the selected count, exposes Select All and Select None, communicates each selected state to keyboard and assistive-technology users without shifting list content, and withholds planning actions that are illegal for terminal Done records
#### Scenario: Select every visible to-do by keyboard
- **WHEN** focus is not owned by an editable text control and a user presses Command+A on Mac or Control+A on Windows in Today, Upcoming, Anytime, Someday, or Done
- **THEN** the interface suppresses the matching browser command, enters selection when necessary, and selects every to-do in the active view without selecting projects, areas, checklist items, or other non-to-do content
#### Scenario: Preserve native text selection
- **WHEN** a text input, textarea, or contenteditable region owns Command+A on Mac or Control+A on Windows
- **THEN** the interface leaves the gesture available to that editable control and does not change task selection
#### Scenario: Dismiss selection outside a to-do
- **WHEN** bulk selection is active and the user presses the pointer outside every to-do row and outside the controls that operate the active selection
- **THEN** the interface clears the selection and range anchor and returns to ordinary task interaction

#### Scenario: Retain selection for owned interactions
- **WHEN** bulk selection is active and the user interacts with a title or other control inside a to-do row, the bulk toolbar, or its planning, calendar, organization, or reminder surface
- **THEN** the interface leaves selection active until the owned interaction applies its selection or planning behavior

#### Scenario: Preserve access to the final task
- **WHEN** the fixed selection overlay is visible above the list
- **THEN** the list retains enough bottom scroll space for its final task and controls to move fully above the overlay

#### Scenario: Exit selection directly
- **WHEN** a user presses Escape, activates Done, changes views, or clicks outside a to-do and outside a selection-owned surface
- **THEN** the client clears selection and its stable range anchor and returns to ordinary editing

#### Scenario: Plan selected tasks
- **WHEN** a user applies Today Inbox, Today Now, Today Next, Today Later, Remove from Today, Tomorrow, Anytime, or Someday to selected tasks
- **THEN** the system updates every selected task's destination, start date, selected day horizon, dependent reminder, mutation metadata, revision, and relevant order in one local transaction while preserving selected order

#### Scenario: Apply a focused bulk value
- **WHEN** a selected-task keyboard command requires a start date, due date, organization, or reminder time
- **THEN** the interface opens a centered selection-owned surface, moves focus to its primary date or selection control, and applies the chosen value to every eligible selected task

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

#### Scenario: Select terminal Done tasks for nondestructive actions
- **WHEN** the user selects one or more to-dos in Done
- **THEN** Tasks permits Copy and Duplicate, rejects Cut and open-task planning, and does not select deleted hierarchy records

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
- **THEN** the close action shows Command+Return, Command+Escape, or Control+Z on Mac and Control+Return or Control+Shift+Z on Windows, and it does not promise that Windows Control+Escape can override the operating system


### Requirement: Recoverable History
The system SHALL provide append-only history, a projection-safe guarded 100-step task undo and redo cursor, mutation receipts, a recoverable Done queue, versioned export, verified restore, and automatic terminal-data expiry.

#### Scenario: Undo a recent change
- **WHEN** a user invokes undo for the latest supported forward task mutation after its task and history projections agree
- **THEN** the system restores the source event's prior state and synchronizes the restoration as a new valid undo mutation

#### Scenario: Undo a deep sequence
- **WHEN** the authoritative projected history contains a safe contiguous chain of supported task mutations
- **THEN** repeated Command+Z on Mac or Control+Z on Windows can walk backward through as many as 100 source mutations in reverse chronological order

#### Scenario: Redo an undone sequence
- **WHEN** one or more task mutations have been undone and no new forward mutation has invalidated redo
- **THEN** Command+Shift+Z or Command+Y on Mac, or Control+Y on Windows, reapplies the next source event's after-state as a new valid redo mutation
#### Scenario: Reconstruct task history after refresh
- **WHEN** the Tasks client starts or receives projected history rows in any arrival order
- **THEN** it reconstructs the bounded undo and redo cursor from the complete available forward, undo, and redo sequence without treating inverse events as new forward steps

#### Scenario: Wait for matching projections
- **WHEN** the cursor-tip event and its current task snapshot do not yet represent the required exact undo or redo pair
- **THEN** the client withholds that history movement until synchronization makes the pair safe and does not skip to an older event

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

#### Scenario: Delete a task
- **WHEN** a user deletes a to-do or project through the normal interface
- **THEN** the system moves it to a recoverable deleted state rather than immediately erasing it

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

### Requirement: Cross-Platform Task Interaction Reference
The system SHALL present a visible interaction reference that documents the complete supported Tasks keyboard and pointer contract for both Mac and Windows.

#### Scenario: Compare platform commands
- **WHEN** the user opens Keyboard Commands
- **THEN** the interface shows Action, Mac, and Windows columns simultaneously and identifies the current platform when the runtime can detect it

#### Scenario: Discover direct list interactions
- **WHEN** the interaction reference is open
- **THEN** it documents task undo and redo, selection, Copy, Cut, Paste, Duplicate, task creation, task traversal, task editing, direct view navigation, drag reordering, and pointer selection gestures without listing removed Find, Projects, or Templates shortcuts
#### Scenario: Preserve commands outside supported contexts
- **WHEN** a chord is not documented for the active platform and context, an active composition owns input, or the browser or operating system consumes an event before it reaches Tasks
- **THEN** the reference does not imply that Tasks overrides that native or unavailable behavior


### Requirement: Keyboard-First Daily Operation
The system SHALL provide a platform-aware keyboard contract for full-editor creation, editing, planning, direct view navigation, list traversal, lifecycle transitions, clipboard operations, history, and dialogs while preserving unrelated browser and operating-system shortcuts.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Toggle done with the Tasks-specific command
- **WHEN** a user invokes Control+A on Mac or Control+Shift+A on Windows with an open task or nonempty task selection
- **THEN** Tasks toggles pending completion for the open task or applies the ordinary lifecycle transition to every eligible selected task and suppresses the matching browser action


#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task title and no editor, unrelated modal, or composition event owns keyboard input
- **THEN** Enter retains ordinary button activation, Option+Up or Option+Down on Mac and Alt+Up or Alt+Down on Windows reorder within the current scope, and no unmodified letter or arrow key triggers a Tasks command

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, cancellation, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then the primary view heading when no task remains

#### Scenario: Open task creation or keyboard help
- **WHEN** a keyboard user presses Control+N or Command+/ on Mac, or Control+Shift+N or Control+/ on Windows
- **THEN** the module respectively opens a blank task in the complete editor or opens the keyboard-command reference and suppresses the matching browser command
#### Scenario: Create through the complete editor
- **WHEN** Control+N on Mac or Control+Shift+N on Windows is invoked from Today, Upcoming, Anytime, or Someday
- **THEN** Tasks injects one blank local task draft at the top of that view, opens the ordinary complete editor, and focuses its blank title
#### Scenario: Create from outside a planning list
- **WHEN** the new-task command is invoked from Projects, Templates, Done, Config, Search, a project, or an area
- **THEN** Tasks navigates to Today and opens one blank Today Now draft in the complete editor
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
- **WHEN** a user invokes Control+V on Mac or Control+Shift+V on Windows, or invokes a temporal planning command, on an open task or nonempty selection
- **THEN** the organization command changes only area or project placement while temporal commands change only Start, day horizon, Deadline, reminder intent, or lifecycle placement
#### Scenario: Restore focus after a movement command
- **WHEN** a structural or temporal movement command succeeds and its command surface closes
- **THEN** focus returns to the moved task when it remains in the current view, or follows the same-position, prior-task, and primary-heading fallback when the move removes it

#### Scenario: Autosave free-text editing
- **WHEN** a user changes a to-do title or notes in an open editor
- **THEN** the local value changes immediately and the module persists the latest nonblank title or exact notes source after a short debounce without a Save or Cancel action

#### Scenario: Autosave structured editing
- **WHEN** a user changes actionability, organization, start date, day horizon, deadline, Primary Link, reminder time, or reminder ambiguity in an open to-do
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

#### Scenario: Override only documented commands
- **WHEN** the user invokes a documented Tasks command in a supported context while the Tasks route is mounted
- **THEN** a capture-phase handler prevents the default browser action, stops later keyboard handling, and dispatches exactly one Tasks command outside active composition
#### Scenario: Own app undo and redo
- **WHEN** the user presses Command+Z, Command+Shift+Z, or Command+Y on Mac, or Control+Z or Control+Y on Windows
- **THEN** Tasks suppresses browser and text-editor history throughout the Tasks route and invokes the available app-level undo or redo action, otherwise performing a Tasks no-op
#### Scenario: Navigate primary task views
- **WHEN** the user presses Control+W, Control+E, Control+R, Control+T, Control+Y, or Control+U on Mac, or the corresponding Control+Shift chord on Windows
- **THEN** Tasks navigates to Today, Upcoming, Anytime, Someday, Done, or Config respectively and suppresses the matching page-level action
#### Scenario: Apply a task command to one or many tasks
- **WHEN** a planning, completion, duplication, or organization command is invoked with a nonempty multi-selection or an open task
- **THEN** Tasks targets the multi-selection when present and otherwise the open task, applies the command to every eligible target, and reports ineligible terminal targets without mutating them
#### Scenario: Open Start from the keyboard
- **WHEN** Control+D on Mac or Control+Shift+D on Windows targets an open task or nonempty eligible selection
- **THEN** Tasks opens or applies the Start planning surface without changing Deadline, actionability, or organization
#### Scenario: Cycle day horizon
- **WHEN** Control+F on Mac or Control+Shift+F on Windows targets one or more eligible tasks
- **THEN** each task cycles through the supported Inbox, Now, Next, and Later horizon sequence allowed by its current planning state without changing Deadline or organization
#### Scenario: Open reminder planning
- **WHEN** Control+H on Mac or Control+Shift+H on Windows targets one eligible task
- **THEN** Tasks opens Start with Reminder editable, and a valid reminder on unplanned work first assigns Today Inbox before reminder persistence
#### Scenario: Open the next visible to-do
- **WHEN** the user presses Control+X on Mac or Control+Shift+X on Windows
- **THEN** Tasks opens the first visible to-do when none is open, otherwise closes the current editor and opens the next visible to-do, closing without wrapping when the current to-do is last
#### Scenario: Open the previous visible to-do
- **WHEN** the user presses Control+S on Mac or Control+Shift+S on Windows
- **THEN** Tasks opens the last visible to-do when none is open, otherwise closes the current editor and opens the previous visible to-do, closing without wrapping when the current to-do is first
#### Scenario: Focus a newly opened title
- **WHEN** a pointer, search result, creation command, or keyboard traversal command opens a to-do
- **THEN** focus lands in the title input with its insertion point at the end and the page scrolls only as needed to reveal that title, never the bottom of a long editor

#### Scenario: Animate inline editor disclosure
- **WHEN** a user opens or closes a to-do and reduced motion is not requested
- **THEN** Tasks commits the opening row in a collapsed frame, quickly animates expansion or collapse, then focuses and smoothly scrolls only as needed to reveal the opened title
#### Scenario: Close an editor from outside
- **WHEN** a pointer interaction begins outside the open to-do and any calendar, menu, listbox, or dialog launched from its editor
- **THEN** Tasks flushes pending autosave, closes the editor, and commits any deferred completion through the ordinary close path

#### Scenario: Close an editor with a form command
- **WHEN** a task editor is open and the user presses Command+Return, Command+Escape, or Control+Z on Mac, or Control+Return or Control+Shift+Z on Windows, outside active composition
- **THEN** Tasks suppresses the matching delivered browser action, flushes autosave, closes the editor from any focused task field, and commits deferred completion through the ordinary close path
#### Scenario: Keep plain Escape field-local
- **WHEN** a task editor is open and the user presses unmodified Escape
- **THEN** the deepest open task field layer may cancel or revert itself, but the task editor remains open when no field layer owns Escape

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
- **WHEN** the user invokes the platform's Tasks-specific Close Task command while a to-do is open
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

#### Scenario: Navigate task views
- **WHEN** the user presses the documented Tasks-specific view chord
- **THEN** the interface navigates directly to Today, Upcoming, Anytime, Someday, Done, or Config while leaving browser tab-number shortcuts and direct Projects or Templates navigation unmodified
#### Scenario: Search tasks and views
- **WHEN** the user activates the visible Search Tasks and Views control
- **THEN** a dialog searches owner-scoped tasks and current views and supports keyboard selection without exposing retired Inbox, Logbook, or Trash destinations

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

#### Scenario: Open Deadline, actionability, or organization
- **WHEN** the user invokes Control+C, Control+G, or Control+V on Mac, or the corresponding Control+Shift chord on Windows, with an eligible task target
- **THEN** Tasks respectively opens Deadline, cycles actionability, or opens organization without changing unrelated task fields

#### Scenario: Reserve checklist command
- **WHEN** the user invokes Control+B on Mac or Control+Shift+B on Windows before the expanded task checklist editor exists
- **THEN** Tasks performs no mutation and the keyboard reference labels the command as reserved rather than claiming checklist editing is available

#### Scenario: Resolve the Windows redo and close collision
- **WHEN** a Windows user presses Control+Y or Control+Shift+Z
- **THEN** Control+Y invokes Redo and Control+Shift+Z closes the open task, so one chord never dispatches both actions

#### Scenario: Avoid promising an intercepted Windows system command
- **WHEN** the Windows operating system owns Control+Escape before the browser receives it
- **THEN** Tasks does not claim that Control+Escape can close a task and exposes Control+Return and Control+Shift+Z as reliable close commands

### Requirement: Task Duplication
The system SHALL duplicate present or Done to-dos from an open task or multi-selection by reconstructing supported user-authored state with fresh identity and open lifecycle.

#### Scenario: Duplicate mutable task content
- **WHEN** the user invokes Duplicate for one or more eligible to-dos
- **THEN** the system creates one new open present task per source with the same Title, Notes, Primary Link, actionability, legal planning, organization, reminder intent, recurrence intent supported by the current model, and checklist content, order, and completion state
#### Scenario: Exclude nonduplicable identity
- **WHEN** a duplicate task is created
- **THEN** it receives new task, checklist, reminder, recurrence, mutation, order, and history identity and does not copy typed source, owner identity, idempotency identity, history, receipt, completion, cancellation, deletion, or terminal lifecycle state


#### Scenario: Open a duplicate made from the open task
- **WHEN** Duplicate targets exactly the currently open to-do
- **THEN** Tasks flushes and closes the original, inserts the duplicate in the active destination, opens the duplicate editor, and focuses the duplicate Title

#### Scenario: Duplicate terminal work as present work
- **WHEN** Duplicate targets a to-do in Done
- **THEN** the new task is open and present while the source remains unchanged in Done

## ADDED Requirements

### Requirement: Structured Task Clipboard
The system SHALL support durable, versioned task-object Copy, Cut, and Paste through the operating-system clipboard, SHALL reconstruct supported user-authored state with fresh identity, and SHALL apply deterministic destination rules before mutation.

#### Scenario: Copy selected tasks as a durable payload
- **WHEN** task selection owns Command+C on Mac or Control+C on Windows
- **THEN** Tasks writes one plain-JSON envelope with a fixed BathOS Tasks kind, schema version, operation, and the selected to-dos in visible order, leaves the source tasks unchanged, and shows a brief Copy confirmation

#### Scenario: Include reconstructible user-authored state
- **WHEN** Tasks serializes a task object for Copy or Cut
- **THEN** the snapshot includes supported Title, Notes, Primary Link, Start, Deadline, horizon, reminder, actionability, organization, recurrence, and checklist intent and excludes owner, record, source-provenance, history, receipt, idempotency, and terminal-state identity

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

#### Scenario: Paste structured tasks into a project
- **WHEN** a valid task envelope is pasted in a project detail view
- **THEN** Tasks creates open tasks at the top in payload order inside that project and derives the containing area from the project

#### Scenario: Paste structured tasks into an area
- **WHEN** a valid task envelope is pasted in an area detail view
- **THEN** Tasks creates open loose area tasks at the top in payload order inside that area without retaining a source project

#### Scenario: Reject unsupported paste destinations
- **WHEN** a user pastes outside an editable text control in Upcoming, Done, Config, Projects index, Templates, Search, or another unsupported Tasks view
- **THEN** Tasks creates no task, leaves the clipboard unchanged, and shows a brief rejection toast

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

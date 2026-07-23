## MODIFIED Requirements

### Requirement: Keyboard-First Daily Operation
The system SHALL provide modifier-based keyboard operation for full-editor creation, editing, Today planning, direct view navigation, list traversal, lifecycle transitions, find, and dialogs while suppressing every matching browser-level command inside the mounted Tasks module.

#### Scenario: Navigate without a pointer
- **WHEN** a keyboard user moves through a task view
- **THEN** focus remains visible and predictable across every interactive control

#### Scenario: Complete selected work
- **WHEN** a user invokes Control+D on Mac or Control+Shift+D on Windows while a to-do is open
- **THEN** the system toggles that to-do's pending completion state without closing its editor or transitioning it to Done

#### Scenario: Toggle completion with Command K
- **WHEN** a user presses Command+K on Mac or Control+K on Windows with an open task
- **THEN** Tasks toggles the same pending completion state as the platform's Control+D completion command and suppresses the matching browser command

#### Scenario: Complete a bulk selection with Command K
- **WHEN** a user presses Command+K on Mac or Control+K on Windows while a nonempty task multi-selection owns task commands
- **THEN** Tasks completes every selected open-lifecycle task through the ordinary lifecycle path and suppresses the matching browser command

#### Scenario: Invoke a task command safely
- **WHEN** focus is on a task title and no editor, unrelated modal, or composition event owns keyboard input
- **THEN** Enter retains ordinary button activation, Option+Up or Option+Down on Mac and Alt+Up or Alt+Down on Windows reorder within the current scope, and no unmodified letter or arrow key triggers a Tasks command

#### Scenario: Preserve keyboard focus after a task leaves the view
- **WHEN** completion, cancellation, movement, or recoverable deletion removes the focused task from the current view
- **THEN** focus moves to the task now occupying the same visual position, then the prior task, then the primary view heading when no task remains

#### Scenario: Open task creation, find, or keyboard help
- **WHEN** a keyboard user presses Command+N, Command+F, or Command+/ on Mac, or Control+N, Control+F, or Control+/ on Windows
- **THEN** the module respectively opens a blank task in the complete editor, opens quick find, or opens the keyboard-command reference and suppresses the matching browser command

#### Scenario: Create through the complete editor
- **WHEN** Command+N or Control+N is invoked from Today, Upcoming, Anytime, or Someday
- **THEN** Tasks removes any persistent Add a Task field, injects one blank local task draft at the top of that view, opens the ordinary complete editor, and focuses its blank title

#### Scenario: Create from outside a planning list
- **WHEN** Command+N or Control+N is invoked from Projects, Templates, Done, Config, Search, a project, or an area
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
- **WHEN** a user invokes Command+M or Control+M, or a temporal planning command, on a focused open task
- **THEN** the organization command changes only area or project placement while temporal commands change only planning destination, start date, day horizon, due date, or reminder time

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

#### Scenario: Override browser commands intentionally
- **WHEN** the user invokes a documented Tasks modifier command while focus is anywhere inside the mounted Tasks route, including an editable control
- **THEN** a capture-phase handler prevents the default browser action, stops later keyboard handling, and dispatches only the Tasks command outside active composition

#### Scenario: Own app undo and redo
- **WHEN** the user presses Command+Z or Command+Shift+Z on Mac, or Control+Z or Control+Shift+Z on Windows
- **THEN** Tasks suppresses browser and text-editor history everywhere in the module and invokes the available app-level undo or redo action, otherwise performing a Tasks no-op

#### Scenario: Navigate views by number
- **WHEN** the user presses Command+1 through Command+6 or Command+Comma on Mac, or Control+1 through Control+6 or Control+Comma on Windows
- **THEN** Tasks navigates directly to Today, Upcoming, Anytime, Someday, Projects, Templates, or Config respectively and suppresses the matching browser navigation command

#### Scenario: Plan one or many tasks from the keyboard
- **WHEN** a user invokes the Today, Anytime, Someday, start date, due date, duplicate, organization, horizon, or reminder command with an open task or nonempty multi-selection
- **THEN** the module targets the multi-selection when present and otherwise targets the open task, applies the command to every eligible target, and suppresses the matching browser command

#### Scenario: Cycle Today with no Inbox transition
- **WHEN** Command+T on Mac or Control+T on Windows targets work outside Today or already in Today
- **THEN** outside work moves to canonical Today Now while Today work cycles Now to Next to Later to Now and never enters Inbox

#### Scenario: Cycle a scheduled day horizon
- **WHEN** Command+H on Mac or Control+H on Windows targets one or more tasks with future Start Dates
- **THEN** each eligible task cycles Now to Next to Later to Now without changing its Start Date

#### Scenario: Ignore an ineligible reminder command
- **WHEN** Command+E on Mac or Control+E on Windows targets no task with a Start Date
- **THEN** the module makes no reminder mutation or focus change

#### Scenario: Open the next visible to-do
- **WHEN** the user presses Control+S on Mac or Control+Shift+S on Windows
- **THEN** Tasks opens the first visible to-do when none is open, otherwise closes the current editor and opens the next visible to-do, closing without wrapping when the current to-do is last

#### Scenario: Open the previous visible to-do
- **WHEN** the user presses Control+W on Mac or Control+Shift+W on Windows
- **THEN** Tasks opens the last visible to-do when none is open, otherwise closes the current editor and opens the previous visible to-do, closing without wrapping when the current to-do is first

#### Scenario: Focus a newly opened title
- **WHEN** a pointer, search result, creation command, or keyboard traversal command opens a to-do
- **THEN** focus lands in the title input with its insertion point at the end and the page scrolls only as needed to reveal that title, never the bottom of a long editor

#### Scenario: Animate inline editor disclosure
- **WHEN** a user opens or closes a to-do and reduced motion is not requested
- **THEN** Tasks quickly animates the editor's expansion or collapse and smoothly adjusts page scroll only when needed to reveal the opened row

#### Scenario: Close an editor from outside
- **WHEN** a pointer interaction begins outside the open to-do and any calendar, menu, listbox, or dialog launched from its editor
- **THEN** Tasks flushes pending autosave, closes the editor, and commits any deferred completion through the ordinary close path

#### Scenario: Close an editor with Command Return or Escape
- **WHEN** a task editor is open and the user presses Command+Return on Mac, Control+Return on Windows, or Escape while no nested dialog or popover owns Escape
- **THEN** Tasks flushes autosave and closes the editor from any focused task field with the same deferred-completion semantics as the ordinary close path

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

#### Scenario: Navigate task views
- **WHEN** the user presses the documented Command+number or Control+number chord
- **THEN** the interface navigates directly to Today, Upcoming, Anytime, Someday, Projects, Templates, or Config while suppressing browser tab-number behavior

#### Scenario: Search tasks and views
- **WHEN** the user activates the visible Search Tasks and Views control
- **THEN** a dialog searches owner-scoped tasks and current views and supports keyboard selection without exposing retired Inbox, Logbook, or Trash destinations

#### Scenario: Preserve native editing behavior
- **WHEN** focus is inside an input, textarea, select, content-editable surface, menu, or dialog
- **THEN** undocumented key chords do not replace native typing, composition, selection, or control behavior, while documented Tasks modifier commands retain precedence

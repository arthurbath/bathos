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

#### Scenario: Offer exhaustive results conditionally
- **WHEN** the full Search page would return at least one result for the current query
- **THEN** Quick Find shows `See All Results` after its compact results
- **WHEN** the full Search page would return no result
- **THEN** Quick Find omits `See All Results`

#### Scenario: Prioritize summary matches
- **WHEN** a query matches one to-do's summary and only ancillary metadata such as notes, source details, or Area on other to-dos
- **THEN** Quick Find ranks the summary match ahead of every ancillary-metadata match

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

### Requirement: Upcoming Date-Section Ordering
The Tasks module SHALL permit manual ordering of ordinary tasks and scheduled recurrence projections inside each visible Upcoming date section and SHALL convert eligible cross-section ordinary-task drops into future Start planning.

#### Scenario: Manually order tasks inside one Upcoming section
- **WHEN** a user drags an Upcoming ordinary task before or after another ordinary task or recurrence projection in the same visible day, month, or year section
- **THEN** Tasks persists the selected manual order without changing either task's Start or Deadline

#### Scenario: Reorder a recurrence projection
- **WHEN** a user drags a scheduled recurrence projection before or after an ordinary task or another recurrence projection in its current visible date section
- **THEN** Tasks persists the selected manual order without changing the recurrence cadence, projected Start, Deadline, or recurrence identity

#### Scenario: Keep recurrence projections in their cadence date
- **WHEN** a user drags a scheduled recurrence projection across another visible Upcoming date section
- **THEN** Tasks does not move the projection into that section or change its cadence-controlled date

#### Scenario: Move a task to another Upcoming section
- **WHEN** a user drags an ordinary Upcoming task into another visible date section
- **THEN** Tasks assigns the destination section's canonical future date as the task's Start, clears any Today horizon, and persists the selected manual position inside that section

#### Scenario: Move a deadline-only task to another Upcoming section
- **WHEN** an ordinary task appears in Upcoming only because of its Deadline and the user drops it into a different Upcoming section
- **THEN** Tasks assigns the destination section date as its Start and retains its existing Deadline

#### Scenario: Prefer Start over Deadline exactly once
- **WHEN** an open task has both a future Start and a future Deadline
- **THEN** Upcoming displays it once in the section controlled by Start and does not also display it in the Deadline section

#### Scenario: Drop into an Upcoming section without another task
- **WHEN** the destination Upcoming section contains no task row that can serve as a manual-order target
- **THEN** dropping an ordinary task on the section still assigns its canonical future Start and places the task as that section's only manually ordered task

#### Scenario: Reschedule a reminder after an Upcoming move
- **WHEN** an ordinary task with a reminder moves to another Upcoming section
- **THEN** Tasks reschedules the reminder against the task's newly assigned Start

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

## ADDED Requirements

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

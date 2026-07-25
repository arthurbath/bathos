## ADDED Requirements

### Requirement: Exclusive Start And Today Horizon Semantics
Tasks SHALL represent future Start and Today horizon as mutually exclusive planning states for to-dos and projects.

#### Scenario: Schedule future work
- **WHEN** a user assigns a Start later than the owner-local planning date
- **THEN** Tasks stores the future Start, clears the Today horizon, and includes the item in Upcoming

#### Scenario: Plan work for Today
- **WHEN** a user assigns Inbox, Now, Next, or Later
- **THEN** Tasks clears any future Start, stores the selected Today horizon, and includes eligible work in Today

#### Scenario: Activate reached future work
- **WHEN** a stored future Start reaches the owner-local planning date
- **THEN** Tasks clears Start, assigns the Next horizon, and includes the item in Today and Anytime

#### Scenario: Normalize existing future work
- **WHEN** the revised contract is deployed over a future-start item that still stores a horizon
- **THEN** the migration clears only that inapplicable horizon while preserving Start, reminder intent, content, organization, ordering, history, and stable identity

### Requirement: Immediate Horizon Command Presentation
Tasks SHALL make the accepted result of its horizon-cycle command visible immediately wherever the target is presented.

#### Scenario: Cycle an existing Today horizon
- **WHEN** Control+R on Mac or Control+Shift+R on Windows targets work already in Today
- **THEN** Tasks cycles Now to Next, Next to Later, Later to Now, and Inbox to Now while keeping the work in Today

#### Scenario: Cycle work not currently in Today
- **WHEN** the horizon command targets unplanned, Someday, or future-start work
- **THEN** Tasks moves the work to Today Now by clearing future Start or Someday placement and assigning the Now horizon

#### Scenario: Reflect an open-task command
- **WHEN** the horizon command changes an open task
- **THEN** its Start control and task-row horizon icon show the optimistic accepted value without waiting for synchronization or closing the editor

#### Scenario: Retain an open task's presentation slot
- **WHEN** an open task receives a planning, actionability, organization, Start, Deadline, or other metadata edit that would change current view membership, grouping, or automatic sort position
- **THEN** Tasks shows the accepted metadata immediately while retaining the task's original visible group and slot until the editor closes

#### Scenario: Apply deferred placement after close
- **WHEN** the user closes an edited task whose accepted metadata changes current view membership, grouping, or automatic sort position
- **THEN** Tasks closes the editor, briefly retains the closed task in its original slot, applies the current projection once, removes or repositions the task as required, and animates an on-page position change with calm motion when motion is allowed

#### Scenario: Settle a completed task before removal
- **WHEN** the user completes a task by keyboard command or pointer
- **THEN** Tasks immediately shows the completion intent, briefly retains the task in place, and only then animates and removes it from the active list

#### Scenario: Respect reduced motion while settling
- **WHEN** the user requests reduced motion
- **THEN** Tasks omits decorative movement and collapse delays while preserving the accepted task mutation

#### Scenario: Retain lifecycle undo intent during projection lag
- **WHEN** the user invokes undo immediately after completing a task and the local task mutation is accepted before its matching history event is projected
- **THEN** Tasks retains the undo intent for that exact client mutation, withholds older history, and performs the guarded inverse as soon as the matching task and history projections agree

#### Scenario: Keep buffered history movement bounded
- **WHEN** the exact requested mutation does not become safely undoable within the bounded projection-wait interval
- **THEN** Tasks performs no inverse, does not apply the request to a later unrelated mutation, and preserves the authoritative history cursor

#### Scenario: Preserve Anytime manual order
- **WHEN** planning or other metadata changes for a task that remains in the Anytime destination
- **THEN** Tasks preserves its manual order key before, during, and after editing rather than ranking it by Start, Today horizon, Someday intent, actionability, or other metadata

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
- **THEN** Clear and Someday appear as sibling actions on one footer row and remain reachable by pointer and keyboard

## MODIFIED Requirements

### Requirement: Reminder-Initiated Today Planning
The Tasks unified Start picker SHALL allow reminder entry before a task has Start planning and SHALL convert a successfully entered reminder into owner-local Today Inbox planning without replacing an existing planning choice.

#### Scenario: Default an unplanned reminder to Today Inbox
- **WHEN** a user confirms one valid reminder time on a task without Start planning
- **THEN** Tasks assigns Today Inbox before saving exactly one reminder, preserves the entered reminder value while synchronization settles, closes the Start picker after acceptance, and does not report a failure for temporary planning-projection lag

### Requirement: Concise Reminder Row Presentation
Tasks SHALL present an active reminder on a task row as compact local-time metadata without repeating its Start-derived calendar date.

#### Scenario: Show a task-row reminder
- **WHEN** a task row has an active reminder and valid Start planning
- **THEN** the row shows a Lucide reminder bell followed only by the reminder's 12-hour local time with an uppercase AM or PM marker, such as `11:00 PM`

### Requirement: Neutral Temporal Input Hover
Tasks SHALL style the Start and Deadline popover triggers as form inputs whose background color does not change on hover.

#### Scenario: Hover a temporal input
- **WHEN** a pointer hovers over an enabled Start or Deadline input
- **THEN** the control retains its ordinary input background while preserving its focus, keyboard, and popover behavior

### Requirement: Canonical Tasks Language
The Tasks module SHALL use "task" for its work items, "Deadline" for their final acceptable date, and "Start" for their planning-start control in user-facing copy and accessible names.

#### Scenario: Present task terminology
- **WHEN** the interface labels, counts, searches, or describes work items
- **THEN** it calls them tasks rather than to-dos

#### Scenario: Present planning terminology
- **WHEN** the interface labels or describes a task's temporal planning controls
- **THEN** it calls the planning-start control "Start" and the final acceptable date "Deadline" without presenting "Task's Start", "Start Date", or "Due Date"

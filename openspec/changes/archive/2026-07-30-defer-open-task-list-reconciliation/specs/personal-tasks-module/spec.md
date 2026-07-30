## MODIFIED Requirements

### Requirement: Immediate Horizon Command Presentation
Tasks SHALL make accepted metadata changes visible immediately in an open task while deferring list membership, filtering, grouping, and automatic-sort reconciliation until that task's editor closes.

#### Scenario: Cycle an existing Today horizon
- **WHEN** Control+R on Mac or Alt+Shift+R on Windows targets work already in Today
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

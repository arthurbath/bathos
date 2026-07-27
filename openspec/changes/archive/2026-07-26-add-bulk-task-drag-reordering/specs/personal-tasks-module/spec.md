## ADDED Requirements

### Requirement: Bulk Task Drag Group
On Today, Upcoming, Anytime, and Someday, the system SHALL allow a pointer drag that begins on a selected task to move the complete current task selection. The system SHALL derive group order from the tasks' current visual order rather than selection order.

#### Scenario: Non-contiguous selection moves in visual order
- **WHEN** the user selects non-contiguous tasks and begins dragging any selected task
- **THEN** the system treats every selected task as the drag group and preserves their pre-drag visual order

#### Scenario: Unselected row starts a single-task drag
- **WHEN** the user begins dragging a task that is not part of the current multi-selection
- **THEN** the system treats only that task as the drag subject

#### Scenario: Scope is limited to planning lists
- **WHEN** the user visits a Tasks surface other than Today, Upcoming, Anytime, or Someday
- **THEN** the system does not offer bulk task drag reordering on that surface

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

#### Scenario: Area bulk drop
- **WHEN** selected Anytime or Someday tasks are dropped into a different Area region
- **THEN** each task that crosses into the Area becomes directly assigned to that Area and clears Project

#### Scenario: Unassigned Area bulk drop
- **WHEN** selected Anytime or Someday tasks are dropped into the unassigned region
- **THEN** every selected task clears both Area and Project

#### Scenario: Existing effective Area retains Project
- **WHEN** a selected task already belongs effectively to the target Area through its Project
- **THEN** the system preserves that Project while reordering the task in the target Area

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

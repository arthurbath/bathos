## ADDED Requirements

### Requirement: Optional Automatic Planning Order
The Tasks module SHALL provide one synchronized, owner-scoped preference that optionally applies deterministic automatic ordering to Anytime and Someday while preserving manual order among exact automatic-sort peers.

#### Scenario: Default automatic sorting off
- **WHEN** an owner has not explicitly enabled automatic list sorting
- **THEN** Anytime and Someday retain their fully manual order and permit ordinary same-Area manual reordering

#### Scenario: Share one preference across lists and devices
- **WHEN** an owner enables or disables automatic list sorting
- **THEN** the same preference governs both Anytime and Someday and synchronizes across the owner's sessions and devices

#### Scenario: Sort independently inside every Area
- **WHEN** automatic sorting is enabled
- **THEN** Tasks preserves the unassigned and effective-Area section order and applies automatic task sorting independently inside each section

#### Scenario: Order deadlines from oldest to absent
- **WHEN** one Area section contains tasks with overdue, Today, future, and absent Deadlines
- **THEN** Tasks orders the oldest overdue Deadline first, then later calendar Deadlines in ascending order through Today and the future, then tasks without a Deadline

#### Scenario: Order Anytime horizons
- **WHEN** automatic sorting is enabled and Anytime tasks in one equal-Deadline group have different Today horizons
- **THEN** Tasks orders Inbox, Now, Next, Later, then tasks without a horizon

#### Scenario: Skip the inapplicable Someday horizon rank
- **WHEN** automatic sorting is enabled in Someday
- **THEN** all tasks tie on the absent horizon rank and continue to Actionability ordering without acquiring Today planning metadata

#### Scenario: Order Actionability
- **WHEN** automatic sorting is enabled and tasks share one Area, Deadline, and horizon rank
- **THEN** Tasks orders Ready first, Rechecking second, and Waiting third

#### Scenario: Preserve manual peer order
- **WHEN** automatically sorted tasks share the same effective Area, normalized Deadline, horizon, and Actionability
- **THEN** Tasks orders them by their durable manual rank and permits pointer reordering among those exact peers

#### Scenario: Restrict an illegal same-Area drag
- **WHEN** a user drags an automatically sorted task over non-peer rows in its current Area
- **THEN** the insertion indicator remains at the most recent legal peer position and dropping uses that displayed legal position

#### Scenario: Project a legal cross-Area drop
- **WHEN** a user drags an automatically sorted task into another Area
- **THEN** the insertion indicator moves to the canonical position for the task's unchanged Deadline, horizon, and Actionability in that Area and permits manual placement among exact peers

#### Scenario: Move across Areas without changing sort metadata
- **WHEN** the user drops an automatically sorted task into another Area or the unassigned region
- **THEN** Tasks applies the ordinary exact organization move and displayed legal manual rank without changing Deadline, horizon, or Actionability

#### Scenario: Retain an edited task until close
- **WHEN** an open task's Deadline, horizon, Actionability, or Area changes while automatic sorting is enabled
- **THEN** Tasks keeps the task in its retained visible position until close and then applies the established delayed animated reconciliation into its automatic position

#### Scenario: Retain a new draft until close
- **WHEN** a task is created in an automatically sorted view
- **THEN** Tasks keeps the open draft at its contextual insertion point and joins it to automatic order only after the editor closes

#### Scenario: Materialize automatic order on disable
- **WHEN** an owner disables automatic sorting
- **THEN** Tasks persists the complete current automatic order of Anytime and Someday as the new manual order before exposing fully manual reordering

#### Scenario: Ignore an active Quick Filter when materializing
- **WHEN** automatic sorting is disabled while a Quick Filter hides some tasks
- **THEN** Tasks materializes the complete unfiltered owner order so hidden tasks retain their correct relative rank

#### Scenario: Fail closed while disabling
- **WHEN** the automatic order cannot be completely materialized
- **THEN** Tasks keeps automatic sorting enabled and reports the failed preference change without exposing a partially materialized manual order

#### Scenario: Present conceptual Actionability order
- **WHEN** Tasks presents an Actionability selection control
- **THEN** its options appear as Ready, Rechecking, then Waiting

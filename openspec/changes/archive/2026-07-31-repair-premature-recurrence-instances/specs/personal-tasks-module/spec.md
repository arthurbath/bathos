## ADDED Requirements

### Requirement: Recurrence Spawn Boundary
Tasks SHALL materialize an ordinary recurrence instance only when its logical occurrence date has reached the owner's current planning date and SHALL keep unreached work solely as a virtual Upcoming prototype.

#### Scenario: Convert a task before its first spawn date
- **WHEN** a user applies Repeat to an ordinary task with a first occurrence later than the owner's current planning date
- **THEN** the system preserves the task's editable content in the recurrence prototype, removes the ordinary source task from task lists, and presents no ordinary occurrence before that date

#### Scenario: Convert a task on its first spawn date
- **WHEN** a user applies Repeat to an ordinary task whose first occurrence is the owner's current planning date
- **THEN** the system adopts that task as the reached initial ordinary instance and advances the virtual prototype according to its cadence

#### Scenario: Reject future recurrence evaluation
- **WHEN** any client asks the authoritative recurrence evaluator to generate through a date later than the owner's current planning date
- **THEN** the evaluator rejects the request without creating an occurrence or advancing the prototype

#### Scenario: Repair an unreached adopted projection
- **WHEN** migration data contains an open adopted occurrence whose immutable scheduled date is later than the owner's current planning date
- **THEN** the system preserves its current task and checklist content in the prototype, removes the premature task and occurrence, and rewinds the prototype to that scheduled date

#### Scenario: Preserve a reached instance deferred into the future
- **WHEN** an ordinary recurrence instance has an immutable scheduled date on or before the owner's planning date and the user later assigns it a future Start
- **THEN** recurrence cleanup preserves that ordinary instance and its editable metadata

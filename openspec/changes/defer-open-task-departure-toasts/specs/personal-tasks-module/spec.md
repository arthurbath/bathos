## MODIFIED Requirements

### Requirement: Metadata departure feedback
Tasks SHALL show neutral, informative feedback after a successful metadata mutation causes a previously visible to-do to leave the current list or stop matching the active quick filter.

#### Scenario: A metadata change moves one task out of the current list
- **WHEN** a successful metadata mutation makes a to-do that belonged to the current list no longer eligible for that list
- **THEN** Tasks shows one neutral toast identifying that the task moved and the canonical list where it can now be found

#### Scenario: A metadata change hides one task behind the active filter
- **WHEN** a successful metadata mutation leaves a to-do eligible for the current list but makes it stop matching the active non-All quick filter
- **THEN** Tasks shows one neutral toast identifying the active quick filter that hid the task

#### Scenario: An open task departs after closing
- **WHEN** metadata edited in an open, retained task would move or filter that task out of the current view
- **THEN** Tasks retains the task while its drawer is open and shows the final departure notice only when the drawer closes and the task leaves the rendered view

#### Scenario: A persisted creation draft departs after closing
- **WHEN** a new-task drawer has persisted its task and a later metadata edit would move or filter that task out of the current view
- **THEN** Tasks continues to treat the persisted task as owned by the open drawer, shows no departure notice while the drawer is open, and shows the final departure notice only when the drawer closes and the task leaves the rendered view

#### Scenario: A later edit restores eligibility before closing
- **WHEN** an open task first receives a departing metadata change and then receives another successful metadata change that restores current list and filter eligibility before closing
- **THEN** Tasks clears the pending departure notice and does not show a stale toast when the drawer closes

#### Scenario: A bulk metadata change affects several selected tasks
- **WHEN** one accepted bulk metadata action moves or filters multiple selected to-dos out of the current view
- **THEN** Tasks shows summarized neutral departure feedback for the accepted batch rather than one toast per to-do

#### Scenario: A metadata change remains visible
- **WHEN** a successful metadata mutation leaves every affected to-do eligible for the current list and active quick filter
- **THEN** Tasks does not show a departure toast

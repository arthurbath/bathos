## MODIFIED Requirements

### Requirement: Closed-task completion has an accidental-click grace period
When a user marks a closed ordinary to-do complete from a list, Tasks SHALL show it as checked in place for two seconds before beginning terminal exit motion and persistence.

#### Scenario: User confirms completion by waiting
- **WHEN** the user checks a closed ordinary to-do and does not interact with its completion control for two seconds
- **THEN** the row SHALL remain visibly checked during the grace period
- **AND** Tasks SHALL then run the established completion exit and persistence behavior

#### Scenario: User cancels accidental completion
- **WHEN** the user checks a closed ordinary to-do and checks the same completion control again before two seconds elapse
- **THEN** Tasks SHALL restore the unchecked state in place
- **AND** Tasks SHALL NOT persist a completion mutation

#### Scenario: User opens a task during its grace period
- **WHEN** a user opens a to-do whose closed-row completion grace period is active
- **THEN** Tasks SHALL preserve the checked intent using the established open-editor deferred-completion behavior
- **AND** the user SHALL remain able to uncheck it before closing the editor

## ADDED Requirements

### Requirement: Touch Pull-Down Quick Find
Task list views SHALL let a touch user reveal and open Quick Find by pulling down from the top of the page.

#### Scenario: Reveal pull progress
- **WHEN** a touch starts while the task list is scrolled to the top and moves downward
- **THEN** a magnifying-glass indicator fades into view in proportion to the pull distance

#### Scenario: Open after threshold
- **WHEN** the user releases the pull after crossing the activation threshold
- **THEN** Tasks opens the existing Quick Find dialog

#### Scenario: Release before threshold
- **WHEN** the user releases before crossing the activation threshold
- **THEN** the indicator retracts and Quick Find remains closed

#### Scenario: Do not enable on non-touch devices
- **WHEN** the current device has no touch capability
- **THEN** Tasks does not install or render the pull-down Quick Find interaction

### Requirement: Visible List Search Action
Every Tasks list view SHALL expose a top-right Search button that opens Quick Find.

#### Scenario: Open from the list header
- **WHEN** the user activates the Search button on a task list
- **THEN** the existing Quick Find dialog opens

#### Scenario: Omit from Settings
- **WHEN** the user views Tasks Settings
- **THEN** the list Search button and pull-down Quick Find gesture are absent

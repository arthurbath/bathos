## MODIFIED Requirements

### Requirement: Today Completion Complication
The Tasks watchOS companion SHALL provide one circular WidgetKit complication that visualizes completion progress for non-deleted tasks explicitly started on the owner's current planning date.

#### Scenario: Calculate Today progress
- **WHEN** the server calculates complication progress
- **THEN** the denominator contains every present task whose Start equals the owner's planning date regardless of open, completed, or canceled lifecycle, and the numerator contains only the completed subset
- **AND** deleted tasks and tasks without that explicit Start date are excluded

#### Scenario: Render nonempty progress
- **WHEN** the denominator is greater than zero
- **THEN** the complication renders the completion fraction as a circular progress ring with a simple checkmark in its center

#### Scenario: Render zero tasks
- **WHEN** no eligible task has Start equal to the planning date
- **THEN** the complication renders an empty progress ring with the same center checkmark rather than inventing progress

#### Scenario: Activate the complication
- **WHEN** the user taps the complication
- **THEN** watchOS opens the Tasks watch app and immediately presents its system task-summary input without requiring a second tap

#### Scenario: Cancel complication capture
- **WHEN** the user cancels the system task-summary input opened from the complication or submits only whitespace
- **THEN** Tasks creates no task and leaves the watch app at its plus control

#### Scenario: Open the watch app directly
- **WHEN** the user launches the Tasks watch app without activating the complication capture route
- **THEN** Tasks opens at its plus control without presenting text entry automatically

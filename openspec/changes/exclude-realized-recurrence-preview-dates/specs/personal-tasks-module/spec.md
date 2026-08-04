## ADDED Requirements

### Requirement: Existing Recurrence Preview Shows Unrealized Starts
When editing an existing calendar recurrence prototype, Tasks SHALL present its “Next” occurrence preview using only occurrences whose generated instance start date is later than the current planning date.

#### Scenario: Exclude today's realized occurrence
- **WHEN** a recurrence prototype has already spawned an instance whose generated start date is today
- **THEN** the prototype's next-occurrence preview excludes that occurrence
- **AND** begins with the first occurrence whose generated start date is later than today

#### Scenario: Apply the cutoff to a deadline-offset start
- **WHEN** an occurrence deadline is in the future but its configured start offset derives a start date of today or earlier
- **THEN** Tasks excludes that occurrence from an existing prototype's next-occurrence preview

#### Scenario: Preserve three future preview rows
- **WHEN** at least three unrealized future occurrences remain in the cadence
- **THEN** Tasks displays the first three of those future occurrences

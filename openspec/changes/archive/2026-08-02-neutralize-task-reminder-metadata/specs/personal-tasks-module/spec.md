## ADDED Requirements

### Requirement: Reminder metadata uses neutral secondary styling
Tasks SHALL present a reminder's icon and time in the second task-row metadata line using the regular muted gray metadata color, while preserving semantic blue for a task-row Primary Link that opens an external website or application.

#### Scenario: Present Reminder beside other metadata
- **WHEN** a task row displays Reminder metadata
- **THEN** both the Reminder icon and its time text use the regular muted gray metadata color
- **AND** the Reminder does not use the semantic blue reserved for an external link affordance

#### Scenario: Preserve external Primary Link styling
- **WHEN** the same task row also displays a Primary Link action
- **THEN** that Primary Link icon retains the semantic blue link treatment

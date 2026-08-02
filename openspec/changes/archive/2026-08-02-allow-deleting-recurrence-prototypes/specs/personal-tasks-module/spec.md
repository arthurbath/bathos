## ADDED Requirements

### Requirement: Recurrence prototypes can be deleted from Upcoming
Tasks SHALL expose a Delete action on each dated or waiting recurrence prototype in Upcoming, SHALL retire that prototype from future recurrence generation, and SHALL leave already generated ordinary task instances unchanged.

#### Scenario: Delete a dated recurrence prototype
- **WHEN** a user activates Delete from the ellipsis menu of a dated recurrence prototype
- **THEN** Tasks archives the recurrence definition and removes the prototype from Upcoming without changing any already generated instance

#### Scenario: Delete a waiting recurrence prototype
- **WHEN** a user activates Delete from the ellipsis menu of a waiting after-completion recurrence prototype
- **THEN** Tasks archives the recurrence definition and removes the prototype from the Repeating Tasks section without changing its outstanding ordinary instance

#### Scenario: Recurrence prototype deletion fails
- **WHEN** the authoritative recurrence status mutation rejects or fails
- **THEN** Tasks keeps or restores the prototype in Upcoming and reports that the repeating task could not be deleted

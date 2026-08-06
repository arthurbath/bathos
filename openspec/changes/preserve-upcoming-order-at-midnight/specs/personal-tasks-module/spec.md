## ADDED Requirements

### Requirement: Ordered Midnight Activation
The system SHALL preserve the user-established mixed Upcoming order when work reaches its owner-local activation date and enters Today Inbox.

#### Scenario: Preserve mixed ordinary and recurrence order
- **WHEN** ordinary tasks and recurrence prototypes share a reached Upcoming date and the user has arranged them in a mixed sequence
- **THEN** activation creates any due recurrence instances and places every newly realized task in Today Inbox in that same relative sequence

#### Scenario: Preserve ordinal order across fractional-key case boundaries
- **WHEN** a reached Upcoming sequence contains fractional order keys whose ordinal order crosses from upper-case to lower-case characters
- **THEN** activation compares those keys with the same ordinal semantics as the Upcoming list and preserves the displayed sequence

#### Scenario: Append newly realized work after retained Inbox work
- **WHEN** Today Inbox already contains work or prior-day work is rolled into Inbox before a newly reached Upcoming batch activates
- **THEN** the system retains the existing Inbox sequence and appends the newly realized batch after it without changing the batch's relative Upcoming order

#### Scenario: Retry ordered activation
- **WHEN** activation is evaluated again for the same owner-local date after the mixed batch has already been realized
- **THEN** the system creates no duplicate recurrence instance and does not reorder the activated tasks

#### Scenario: Preserve ordinary order during local activation
- **WHEN** a foreground client locally activates multiple ordinary tasks from one reached Upcoming date before authoritative recurrence synchronization completes
- **THEN** it appends those tasks to Today Inbox in their established Upcoming order and later converges with the authoritative mixed sequence

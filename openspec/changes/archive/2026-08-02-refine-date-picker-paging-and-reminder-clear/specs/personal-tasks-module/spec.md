## ADDED Requirements

### Requirement: Direct Reminder clearing
The Tasks Start picker SHALL provide an inline clear action whenever Reminder contains a value, positioned after the value and before the alarm-clock menu button.

#### Scenario: Present the Reminder clear action
- **WHEN** Reminder contains a displayed value
- **THEN** a small X action appears inside the trailing portion of the input before Alarm
- **AND** the input reserves space so neither trailing action covers the displayed value

#### Scenario: Clear Reminder immediately
- **WHEN** the user activates the Reminder X with pointer, Space, or Return
- **THEN** Tasks immediately clears the displayed Reminder and persists the cleared reminder intent
- **AND** Start remains open

#### Scenario: Hide the clear action for an empty Reminder
- **WHEN** Reminder contains no displayed value
- **THEN** the inline X is absent and Alarm retains its existing position and behavior

#### Scenario: Recover from a failed clear
- **WHEN** clearing a persisted Reminder fails
- **THEN** Tasks restores the last committed display value and retains the existing failure feedback behavior

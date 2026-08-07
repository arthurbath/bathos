## ADDED Requirements

### Requirement: Quick Find recurrence destinations
Tasks SHALL treat a recurrence-prototype result as an openable Upcoming destination with one unambiguous whole-task focus owner.

#### Scenario: Open a recurrence prototype from Quick Find
- **GIVEN** an ordinary task currently owns the whole-task keyboard-focus highlight
- **WHEN** the user activates an Upcoming recurrence-prototype result from Quick Find by pressing Return or using a pointer
- **THEN** Tasks clears the Quick Find query and navigates to the prototype in Upcoming
- **AND** removes the whole-task keyboard-focus highlight from the ordinary task
- **AND** opens the recurrence prototype's inline metadata drawer
- **AND** transfers focus into the opened recurrence prototype
- **AND** does not open the separate Edit Repeat modal

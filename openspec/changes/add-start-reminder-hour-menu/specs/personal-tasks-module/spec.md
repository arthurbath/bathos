## ADDED Requirements

### Requirement: Start Reminder Whole-Hour Menu
The Tasks unified Start picker SHALL pair its editable Reminder input with a keyboard-accessible alarm action that offers every currently legal whole-hour reminder choice without committing or closing the containing Start picker.

#### Scenario: Offer every hour for a future Start
- **WHEN** a task has a future Start Date and the user opens the Reminder hour menu
- **THEN** the menu offers each whole hour from 12:00 am through 11:00 pm in chronological order

#### Scenario: Offer only remaining whole hours for Today
- **WHEN** a task has a Today horizon, the owner-local current time is 1:54 pm, and the user opens the Reminder hour menu
- **THEN** the menu offers 2:00 pm through 11:00 pm and omits every elapsed or current-hour choice

#### Scenario: Apply Today rules before Start exists
- **WHEN** a task has no Start intent and the user opens the Reminder hour menu
- **THEN** the menu applies the same remaining-hours rule as Today because choosing a reminder will first assign Today Inbox

#### Scenario: Disable an exhausted Today menu
- **WHEN** a task is governed by Today reminder rules and no whole hour remains later than the current owner-local moment
- **THEN** the alarm action is disabled while freeform Reminder entry remains available for any later valid minute

#### Scenario: Open the nested menu without committing Start
- **WHEN** focus is on the enabled alarm action and the user presses Enter or Space
- **THEN** Tasks opens the whole-hour menu, keeps Start open, and gives the nested menu ownership of its arrow, activation, and Escape keys

#### Scenario: Select one whole-hour reminder
- **WHEN** the user activates an offered hour by pointer, Enter, or Space
- **THEN** Tasks saves that canonical reminder through the existing reminder contract, displays its normalized time, closes only the hour menu, and leaves Start open

#### Scenario: Traverse from Reminder to the alarm action
- **WHEN** keyboard focus is in Reminder with a collapsed text selection at the end and the user presses Right Arrow
- **THEN** focus moves to the enabled alarm action without committing Start

#### Scenario: Preserve native Reminder cursor movement
- **WHEN** keyboard focus is in Reminder before the end of its value and the user presses Right Arrow
- **THEN** the text cursor moves natively within Reminder and focus does not move to the alarm action

#### Scenario: Return from the alarm action to Reminder
- **WHEN** focus is on the alarm action and the user presses Left Arrow
- **THEN** focus returns to Reminder with the text cursor at the end of its value

#### Scenario: Keep the hour menu within the viewport
- **WHEN** the available whole-hour choices exceed the visible vertical space
- **THEN** the hour menu remains within the available viewport and scrolls its options without resizing the Start picker

## ADDED Requirements

### Requirement: Reminder-Initiated Today Planning
The Tasks unified Start picker SHALL allow reminder entry before a to-do has a Start Date or Today horizon and SHALL convert a successfully entered reminder into owner-local Today · Inbox planning without replacing an existing planning choice.

#### Scenario: Offer Reminder before planning
- **WHEN** connected reminder storage is available and a present open to-do has neither a future Start Date nor a Today horizon
- **THEN** its Start picker keeps Reminder editable without requiring a preliminary planning selection

#### Scenario: Default an unplanned reminder to Today Inbox
- **WHEN** a user saves a valid reminder time on a to-do with neither a future Start Date nor a Today horizon
- **THEN** Tasks first persists the to-do as Anytime with a null future Start Date and the Inbox Today horizon, then saves the reminder for the owner's current planning date

#### Scenario: Preserve an existing Today horizon
- **WHEN** a user saves a reminder on a to-do already placed in Today Inbox, Now, Next, or Later
- **THEN** Tasks preserves that horizon and changes only the reminder

#### Scenario: Preserve an existing future Start Date
- **WHEN** a user saves a reminder on a to-do with a future Start Date
- **THEN** Tasks preserves the future Start Date and its day horizon and schedules the reminder for that Start Date

#### Scenario: Reject an elapsed time before default planning
- **WHEN** a user enters a time that has already elapsed on the owner planning date for an otherwise unplanned to-do
- **THEN** Tasks reports `Not allowed.`, saves neither Today · Inbox planning nor a reminder, and restores the last committed reminder display

#### Scenario: Retain reminder planning in an untitled draft
- **WHEN** a user enters a valid reminder before a new-task draft has a persistent identifier
- **THEN** Tasks retains Today · Inbox in the draft, retains the pending reminder intent, and persists the planned to-do before saving its reminder after the first valid title

## MODIFIED Requirements

### Requirement: Unified Task Start Picker
The Tasks interface SHALL present a single autosaving Start control for Today horizon, future deferral date, and reminder intent by composing the established BathOS popover and calendar primitives with Tasks-specific controls.

#### Scenario: Add or clear a reminder inside Start
- **WHEN** connected reminder storage is available and a user enters or clears a reminder time for a present open to-do
- **THEN** Tasks immediately saves or cancels the one dependent reminder through the authoritative reminder contract, first assigning Today · Inbox when the to-do has no Start intent and never requesting an independent reminder date

#### Scenario: Keep Reminder available before planning
- **WHEN** a present open to-do has neither a future Start Date nor a Today horizon
- **THEN** the reminder time control remains visible and editable whenever connected reminder storage is available

### Requirement: Keyboard-First Daily Operation
The system SHALL provide modifier-based keyboard operation for full-editor creation, editing, Today planning, direct view navigation, list traversal, lifecycle transitions, find, and dialogs while suppressing every matching browser-level command inside the mounted Tasks module.

#### Scenario: Open reminder planning for unplanned work
- **WHEN** Command+E on Mac or Control+E on Windows targets one task with neither a future Start Date nor a Today horizon
- **THEN** the module opens Start with Reminder editable, and a valid reminder first assigns Today · Inbox before reminder persistence

### Requirement: Deferral-Anchored Reminder Time
The system SHALL allow at most one active reminder per to-do or project, SHALL derive its calendar date from the item's future Start Date or owner-local planning date for a Today horizon, and SHALL expose only its local time as user-editable reminder intent.

#### Scenario: Default reminder planning for unplanned work
- **WHEN** an open to-do has neither a future Start Date nor a Today horizon and the user saves a valid reminder time
- **THEN** the system first assigns Today · Inbox and then resolves the reminder on the owner's current planning date

## ADDED Requirements

### Requirement: Today Command Focus Synchronization
The Tasks interface SHALL synchronize an already-open unified Start picker's keyboard focus with the Today horizon assigned by Control+T, while preserving Control+T as a direct planning command when the picker is closed.

#### Scenario: Focus the assigned Today value in an open picker
- **WHEN** a to-do's unified Start picker is open and the user invokes Control+T for that to-do
- **THEN** Tasks applies the existing Control+T Today-planning transition and moves keyboard focus to the Today horizon value assigned by that transition

#### Scenario: Keep a closed picker closed
- **WHEN** a to-do's unified Start picker is closed and the user invokes Control+T for that to-do
- **THEN** Tasks applies the existing Control+T Today-planning transition without opening the Start picker

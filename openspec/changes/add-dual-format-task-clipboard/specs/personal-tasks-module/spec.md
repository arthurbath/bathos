## ADDED Requirements

### Requirement: Tasks Use Full-Fidelity and Human-Readable Clipboard Representations

The Tasks module SHALL preserve complete supported metadata when copied or cut tasks and checklist items are pasted back into Tasks, while exposing a human-readable plain-text representation to applications that do not understand BathOS clipboard data.

#### Scenario: Copy tasks into another application
- **WHEN** the user copies one or more tasks and pastes them into an application that consumes plain text
- **THEN** the pasted text contains the task Summaries in source order with one Summary per line and does not expose the BathOS JSON envelope

#### Scenario: Cut checklist items into another application
- **WHEN** the user cuts one or more checklist items and pastes them into an application that consumes plain text
- **THEN** the pasted text contains the checklist-item titles in source order with one title per line and does not expose the BathOS JSON envelope

#### Scenario: Paste copied tasks back into Tasks
- **WHEN** the user pastes tasks copied or cut by a compatible BathOS clipboard surface into an eligible Tasks list
- **THEN** Tasks reconstructs every supported task field, checklist item, completion state, reminder, and source ordering contained in the versioned BathOS payload according to the destination's existing paste rules

#### Scenario: Paste copied checklist items back into Tasks
- **WHEN** the user pastes checklist items copied or cut by a compatible BathOS clipboard surface into a checklist
- **THEN** Tasks reconstructs each item title and completion state in source order at the existing insertion position

#### Scenario: Paste a legacy BathOS clipboard payload
- **WHEN** the clipboard contains a valid legacy BathOS JSON envelope in its plain-text representation
- **THEN** Tasks continues to recognize and reconstruct that payload

#### Scenario: Paste after structured metadata is unavailable
- **WHEN** an intermediary application or browser removes the private BathOS representation but retains plain text
- **THEN** Tasks treats the remaining lines as ordinary task or checklist-item titles according to the existing multiline paste behavior

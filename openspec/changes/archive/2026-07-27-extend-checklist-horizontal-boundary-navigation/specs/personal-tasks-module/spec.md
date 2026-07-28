## ADDED Requirements

### Requirement: Checklist horizontal boundary traversal
The system SHALL treat adjacent checklist-item inputs as continuous lines for unmodified horizontal caret movement while preserving native text-input behavior away from item boundaries.

#### Scenario: Move left into the preceding checklist item
- **WHEN** a checklist-item input has a collapsed caret at the beginning of its value, an adjacent preceding checklist item exists, and the user presses unmodified Left Arrow
- **THEN** Tasks focuses the preceding checklist input and places the caret at the end of its value

#### Scenario: Move right into the following checklist item
- **WHEN** a checklist-item input has a collapsed caret at the end of its value, an adjacent following checklist item exists, and the user presses unmodified Right Arrow
- **THEN** Tasks focuses the following checklist input and places the caret at the beginning of its value

#### Scenario: Preserve horizontal input behavior away from boundaries
- **WHEN** a user presses Left Arrow or Right Arrow with a non-collapsed selection, a modifier key, or a caret away from the applicable string boundary
- **THEN** Tasks leaves the event to the checklist input's native text-editing behavior

#### Scenario: Preserve the outer checklist boundaries
- **WHEN** the caret is at the beginning of the first checklist item and the user presses Left Arrow, or at the end of the final checklist item and the user presses Right Arrow
- **THEN** Tasks keeps focus in the current checklist input and leaves the event to native boundary behavior

## MODIFIED Requirements

### Requirement: Checklist Horizontal Boundary Traversal
The system SHALL treat adjacent checklist-item inputs as continuous lines for plain horizontal caret movement and macOS Option-modified horizontal caret movement while preserving native text-input and browser behavior away from eligible item boundaries.

#### Scenario: Move left into the preceding checklist item
- **WHEN** a checklist-item input has a collapsed caret at the beginning of its value, an adjacent preceding checklist item exists, and a user on a Mac-like platform presses Left Arrow either without a modifier or with Option as the only modifier
- **THEN** Tasks focuses the preceding checklist input and places the caret at the end of its value

#### Scenario: Move right into the following checklist item
- **WHEN** a checklist-item input has a collapsed caret at the end of its value, an adjacent following checklist item exists, and a user on a Mac-like platform presses Right Arrow either without a modifier or with Option as the only modifier
- **THEN** Tasks focuses the following checklist input and places the caret at the beginning of its value

#### Scenario: Preserve native Option word navigation inside an item
- **WHEN** a user on a Mac-like platform presses Option+Left Arrow or Option+Right Arrow while the collapsed caret is away from the applicable string boundary
- **THEN** Tasks leaves the event to the checklist input's native word-navigation behavior

#### Scenario: Preserve horizontal input behavior outside eligible gestures
- **WHEN** a user presses Left Arrow or Right Arrow with a non-collapsed selection, Command, Control, Shift, a modifier combination, non-macOS Alt, or a caret away from the applicable string boundary
- **THEN** Tasks leaves the event to the native text-input or browser behavior

#### Scenario: Preserve the outer checklist boundaries
- **WHEN** the caret is at the beginning of the first checklist item and the user presses eligible Left Arrow, or at the end of the final checklist item and the user presses eligible Right Arrow
- **THEN** Tasks keeps focus in the current checklist input and leaves the event to native boundary behavior

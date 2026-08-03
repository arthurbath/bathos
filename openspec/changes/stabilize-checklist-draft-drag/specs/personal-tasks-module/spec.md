## ADDED Requirements

### Requirement: Transient Checklist Draft Integrity
Tasks SHALL treat an empty checklist draft as transient editing UI and SHALL expose at most one insertion indicator for each logical checklist drop boundary.

#### Scenario: Discard an abandoned blank draft
- **WHEN** the user leaves a new checklist-item input whose value is empty or contains only whitespace
- **THEN** Tasks immediately removes the draft row without persisting a checklist item

#### Scenario: Save an authored draft on blur
- **WHEN** the user leaves a new checklist-item input whose value contains non-whitespace content
- **THEN** Tasks preserves the existing blur-to-save behavior for that checklist item

#### Scenario: Render one indicator for a draft boundary
- **WHEN** a transient checklist draft occupies the same logical insertion boundary as the persisted item that follows it and that boundary is the active drop target
- **THEN** Tasks renders exactly one blue insertion indicator at that boundary

#### Scenario: Preserve active draft reordering
- **WHEN** the user drags a focused transient checklist draft before leaving the draft input through an ordinary blur interaction
- **THEN** Tasks continues to allow the draft row to move without persisting an empty checklist item

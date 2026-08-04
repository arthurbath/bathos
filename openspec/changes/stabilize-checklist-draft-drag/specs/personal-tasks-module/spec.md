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

#### Scenario: Retain a persisted checklist drop
- **WHEN** the user drops one or more persisted checklist items at the active insertion indicator
- **THEN** Tasks immediately displays those items at that exact insertion boundary
- **AND** the same order remains after the checklist mutation finishes saving
- **AND** a concurrent or newer authoritative checklist revision does not restore the item to its prior position

#### Scenario: Mutate a legacy ordered checklist
- **GIVEN** a checklist contains fixed-width numeric order keys created by an earlier Tasks version or recurrence spawn
- **WHEN** the user creates, completes, reopens, or reorders a checklist item
- **THEN** Tasks performs the requested mutation without rejecting the legacy order key
- **AND** preserves the checklist's deterministic visual order

#### Scenario: Commit one draft while closing its task
- **GIVEN** an authored checklist draft still has focus
- **WHEN** closing the task flushes the draft and the input subsequently blurs
- **THEN** Tasks creates exactly one checklist item for that draft
- **AND** reopening the task shows that item once

#### Scenario: Handle a failed checklist interaction
- **WHEN** a checklist create, edit, completion, deletion, or reorder cannot be saved
- **THEN** Tasks presents the established checklist error feedback
- **AND** the rejected interaction does not escape as an unhandled browser promise rejection

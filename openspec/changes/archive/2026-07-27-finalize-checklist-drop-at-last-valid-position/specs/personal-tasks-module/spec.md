## ADDED Requirements

### Requirement: Checklist Drag Finalization
Tasks SHALL retain the most recent valid checklist insertion position throughout a native checklist drag and SHALL use that position when the user drops the dragged item or selected group elsewhere inside the BathOS document.

#### Scenario: Drop a single checklist item outside the checklist
- **WHEN** a user drags one checklist item across a valid checklist insertion position and releases it elsewhere inside BathOS
- **THEN** Tasks moves the item to the last valid indicated checklist position

#### Scenario: Drop a selected checklist group outside the checklist
- **WHEN** a user drags multiple selected checklist items across a valid checklist insertion position and releases them elsewhere inside BathOS
- **THEN** Tasks moves the complete selected group to the last valid indicated checklist position as one reorder and keeps the items selected

#### Scenario: Drop an empty checklist draft outside the checklist
- **WHEN** a user drags an empty checklist draft across a valid checklist insertion position and releases it elsewhere inside BathOS
- **THEN** Tasks moves the draft editing row to the last valid indicated checklist position without persisting an empty item

#### Scenario: Preserve local drop ownership
- **WHEN** a user releases a checklist drag over a checklist-owned drop target
- **THEN** Tasks applies the reorder exactly once through the checklist-owned drop interaction

#### Scenario: Ignore an outside drop without a valid position
- **WHEN** a checklist drag has not crossed a valid insertion position and the user releases it outside the checklist
- **THEN** Tasks leaves the checklist order unchanged

#### Scenario: Cancel a drag outside the browser
- **WHEN** a native checklist drag ends without a drop inside the BathOS document
- **THEN** Tasks leaves the checklist order unchanged and clears the transient drag state

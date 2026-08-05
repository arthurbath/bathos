## ADDED Requirements

### Requirement: Responsive Modal Geometry
Shared BathOS modal primitives SHALL use square corners whenever their content is edge-to-edge with the viewport and SHALL use rounded corners whenever the modal remains inset from every viewport edge.

#### Scenario: Present an edge-to-edge mobile modal
- **WHEN** a shared Dialog or AlertDialog expands to the full viewport width at a compact viewport
- **THEN** its outer corners are square
- **AND** its outer one-pixel border is removed

#### Scenario: Present an inset modal
- **WHEN** a shared Dialog or AlertDialog retains visible viewport space around its outer boundary
- **THEN** its outer corners use the established rounded modal treatment
- **AND** its established one-pixel border remains visible

#### Scenario: Preserve non-modal overlay geometry
- **WHEN** BathOS presents a popover, sheet, or native quick-entry window
- **THEN** this responsive modal rule does not alter that surface's established geometry

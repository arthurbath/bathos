## ADDED Requirements

### Requirement: Ordinary Dropdowns Use the Shared BathOS Select
BathOS SHALL use the shared Select trigger, content, item, focus, and keyboard behavior for every new ordinary single-selection dropdown. Native `<select>` elements and locally styled substitutes SHALL NOT be introduced unless the control has a documented specialized requirement that the shared Select cannot satisfy.

#### Scenario: Add an ordinary dropdown
- **WHEN** a developer adds a new ordinary single-selection dropdown to any BathOS module or shared surface
- **THEN** the implementation uses the shared BathOS Select component and its standard trigger and popover styling

#### Scenario: Preserve a specialized documented exception
- **WHEN** a control has a documented platform, accessibility, DataGrid, or input-mode requirement that the shared Select cannot satisfy
- **THEN** the implementation records the exception and preserves the required interaction without presenting an unreviewed locally styled substitute as the default

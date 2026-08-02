## ADDED Requirements

### Requirement: Ordinary inputs use a solid muted outline
BathOS SHALL render ordinary non-DataGrid text inputs, textareas, selects, date triggers, and equivalent single-line form controls with one solid muted-gray outline whose contrast is lower than the active keyboard-focus treatment.

#### Scenario: Render an unfocused ordinary input
- **WHEN** an ordinary input is visible outside a DataGrid
- **THEN** it has the shared solid muted-gray outline and no component-specific bright white border

#### Scenario: Focus an ordinary input
- **WHEN** keyboard or pointer interaction focuses the ordinary input
- **THEN** the shared focus treatment is clearly distinguishable from the persistent muted outline

#### Scenario: Render a DataGrid editor
- **WHEN** a DataGrid cell control is neither focused nor actively edited
- **THEN** the ordinary persistent outline convention does not add a border to that grid control

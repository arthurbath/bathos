## ADDED Requirements

### Requirement: Inset Mobile Temporal Picker Chrome
Centered Start and Deadline pickers on touch-capable mobile viewports SHALL retain the normal visual boundary of an inset temporal picker and SHALL block all persistent navigation while open.

#### Scenario: Present a centered temporal picker
- **WHEN** Tasks centers a Start or Deadline picker within a touch-capable mobile viewport
- **THEN** the picker has the standard one-pixel outline and rounded inset corners
- **AND** its footer fits the Clear and Someday actions without surplus space below them

#### Scenario: Layer the centered picker above persistent controls
- **WHEN** a centered Start or Deadline picker is open
- **THEN** its modal backdrop visually and interactively covers mobile navigation and selection controls
- **AND** the picker remains above that backdrop

### Requirement: Symmetric Checklist Drawer Overflow
Checklist rows in an expanded task metadata drawer SHALL extend equally beyond the drawer's ordinary leading and trailing content insets when their permanently visible controls require the space.

#### Scenario: Render persisted checklist rows
- **WHEN** a persisted checklist item appears in an expanded task drawer
- **THEN** its checkbox edge and drag-handle edge use equal negative inline offsets

#### Scenario: Render a draft checklist row
- **WHEN** a blank checklist draft row appears in an expanded task drawer
- **THEN** it uses the same symmetric inline offsets as persisted checklist rows

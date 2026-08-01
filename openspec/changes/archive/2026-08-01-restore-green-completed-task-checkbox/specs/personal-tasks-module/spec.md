## MODIFIED Requirements

### Requirement: Task completion boxes use neutral color
Ordinary open task and checklist completion controls SHALL use the established neutral gray and SHALL NOT turn green on hover, while a checked to-do SHALL use semantic success green as visible completion confirmation. Checked checklist items SHALL remain neutral gray.

#### Scenario: Hover an ordinary completion box
- **WHEN** a user points at an open or checked task or checklist completion box
- **THEN** its icon retains its current state color rather than changing color because of hover

#### Scenario: Present a checked to-do
- **WHEN** a to-do is shown as checked after pointer activation, keyboard-command activation, optimistic completion feedback, or persisted completion
- **THEN** its contained checked-square icon uses semantic success green

#### Scenario: Present an open to-do
- **WHEN** a to-do is open and not awaiting completion
- **THEN** its open-square icon uses the established neutral gray

#### Scenario: Present a checked checklist item
- **WHEN** a checklist item is shown as checked
- **THEN** its checked-square icon uses the same neutral gray family as its unchecked-square icon

#### Scenario: Preserve selection-mode color
- **WHEN** task or checklist selection mode replaces completion boxes with selection circles
- **THEN** those selection controls retain their established information-blue selection styling

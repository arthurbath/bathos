## ADDED Requirements

### Requirement: Unified Task-Like Recurrence Prototype Editing
Tasks SHALL present ordinary task metadata in an opened recurrence prototype through the same task metadata and checklist interaction components used by an opened ordinary task, while applying only the explicit capability differences required by recurrence.

#### Scenario: Present shared prototype metadata controls
- **WHEN** a user opens a recurrence prototype in Upcoming
- **THEN** Summary, Notes, Primary Link, Area, Actionability, disclosure layout, spacing, input sizing, focus treatment, and open-row blue highlight use the same components and presentation rules as an opened ordinary task

#### Scenario: Edit a prototype checklist
- **WHEN** a user adds, edits, splits, joins, pastes, cuts, copies, completes, reopens, selects, deletes, or reorders checklist items in an opened recurrence prototype
- **THEN** Tasks uses the same checklist controls, sizes, keyboard behavior, pointer behavior, selection behavior, and ordering behavior as an ordinary task checklist
- **AND** accepted checklist state is persisted in the current recurrence prototype snapshot for later generated instances

#### Scenario: Preserve recurrence-specific exceptions
- **WHEN** a recurrence prototype is presented or opened
- **THEN** Tasks uses the recurrence symbol instead of a completion checkbox, excludes the prototype from task bulk selection and completion, omits editable Start and Deadline fields, and presents one full-width Edit Repeat control in their place

#### Scenario: Keep one inline editor open
- **WHEN** an ordinary task or recurrence prototype is open in Upcoming and the user opens a different ordinary task or recurrence prototype
- **THEN** Tasks flushes and closes the current editor before opening the requested editor
- **AND** no ordinary task and recurrence prototype are open simultaneously

#### Scenario: Carry future drawer refinements uniformly
- **WHEN** a shared metadata drawer component or shared checklist component changes
- **THEN** the changed component is used by both ordinary task and recurrence prototype editors without a prototype-only visual substitute

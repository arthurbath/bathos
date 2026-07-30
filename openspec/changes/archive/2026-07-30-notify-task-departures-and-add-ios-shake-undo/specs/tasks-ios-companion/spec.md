## ADDED Requirements

### Requirement: iOS shake invokes task undo
The iOS Tasks companion SHALL translate one completed foreground device-shake gesture into the same guarded task-and-checklist undo command used by the Tasks web interface.

#### Scenario: Shake with an undoable task change
- **WHEN** the user shakes the device while the iOS Tasks companion is in the foreground and the task history has a safely undoable change
- **THEN** the companion invokes the existing Tasks undo command exactly once and the synchronized inverse mutation follows the normal task history contract

#### Scenario: Shake with an undoable checklist change
- **WHEN** the user shakes the device while the latest safely undoable Tasks change belongs to a checklist item
- **THEN** the existing Tasks undo arbitration reverses that checklist change without creating a separate native history

#### Scenario: Shake at the undo boundary
- **WHEN** the user shakes the device and no task or checklist change can be safely undone
- **THEN** Tasks performs no mutation and shows the existing neutral Nothing to Undo toast

#### Scenario: Non-shake motion
- **WHEN** the native web view receives a completed motion event that is not a shake
- **THEN** the companion does not dispatch the Tasks undo command

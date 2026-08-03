## ADDED Requirements

### Requirement: Native quick entry supports structural checklist drafting
The Tasks module SHALL let a user add and edit the ordinary task checklist from macOS Global Quick Entry before the draft has acquired a nonempty Summary.

#### Scenario: Add a checklist before entering Summary
- **WHEN** the user activates Add Checklist in Global Quick Entry while the draft is unpersisted and Summary is empty
- **THEN** Tasks persists the temporary parent with an internal placeholder while leaving the visible Summary empty, reveals the ordinary checklist editor, creates and focuses one blank checklist item, and keeps Save unavailable until Summary is valid

#### Scenario: Cancel a checklist-bearing quick-entry draft
- **WHEN** a temporary quick-entry parent was persisted to support checklist editing and the user cancels the overlay
- **THEN** Tasks recoverably deletes the temporary parent and does not leave a committed task or orphaned checklist

#### Scenario: Present explicit quick-entry actions
- **WHEN** the native quick-entry editor is ready
- **THEN** it displays an outlined Cancel action and a filled primary Save action using the shared BathOS button components

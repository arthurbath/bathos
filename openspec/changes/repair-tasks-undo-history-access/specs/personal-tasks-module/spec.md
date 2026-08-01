## ADDED Requirements

### Requirement: Compatible task-history reconstruction
Tasks SHALL reconstruct its authoritative undo and redo cursor from every synchronized history row that uses current mutation vocabulary or retained legacy snapshot vocabulary produced by an approved Tasks migration.

#### Scenario: Read widget-originated history
- **WHEN** synchronized task history includes an accepted mutation whose channel is `widget`
- **THEN** Tasks decodes that event as valid history and keeps eligible newer task actions available to undo and redo

#### Scenario: Read retained template-era snapshots
- **WHEN** append-only history retains a task snapshot whose source kind was `template` before template removal
- **THEN** Tasks normalizes the retired provenance to the template-free task representation and reconstructs the cursor without discarding otherwise valid history

#### Scenario: Diagnose genuinely incompatible history
- **WHEN** a synchronized history row remains invalid after supported compatibility normalization
- **THEN** Tasks withholds unsafe traversal, logs a content-free diagnostic with the failing event identity and reason, and does not silently describe the condition as an empty history boundary

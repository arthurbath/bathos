## Why

Recurrence prototypes in Upcoming currently reimplement ordinary task metadata controls, which has allowed their checklist behavior, input sizing, row highlight, and open-editor lifecycle to drift from standard tasks. Prototypes should remain task-like editing surfaces with only the small set of schedule-specific exceptions required by recurrence.

## What Changes

- Reuse one shared metadata-drawer field implementation for ordinary tasks and recurrence prototypes.
- Reuse the ordinary task checklist editor UI and interaction model for recurrence prototype checklist snapshots through a recurrence-backed data adapter.
- Make Summary, Notes, Primary Link, Area, Actionability, disclosure layout, spacing, focus treatment, and blue open-row highlight identical across ordinary tasks and prototypes.
- Keep the intended prototype exceptions: recurrence leading symbol, no completion control, no task selection-mode membership, no editable Start or Deadline fields, and a full-width Edit Repeat control that opens the atomic recurrence editor.
- Enforce one open inline editor across Upcoming so opening a prototype closes any ordinary task or other prototype, and opening an ordinary task closes any prototype.
- Add regression coverage that compares shared drawer structure and interactions instead of allowing separate prototype-only presentation rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Strengthen the recurrence prototype editing contract so shared metadata uses the ordinary task components and behavior, while Upcoming permits only one ordinary task or prototype editor to be open at a time.

## Impact

- Tasks module only, primarily `TasksShell`, recurrence prototype rows, shared task metadata fields, and checklist editing.
- No database, Supabase, PowerSync, migration, native companion, dependency, or API changes.
- Existing recurrence revision persistence remains authoritative for prototype metadata.

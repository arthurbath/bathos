## 1. Shared Metadata Components

- [x] 1.1 Extract the ordinary task metadata drawer fields into a shared controlled component without changing ordinary task behavior.
- [x] 1.2 Render recurrence prototype Summary, Notes, Primary Link, Area, Actionability, spacing, and Edit Repeat placement through the shared drawer component.

## 2. Shared Checklist Behavior

- [x] 2.1 Separate the ordinary checklist interaction surface from its task-table persistence hook behind a typed controller.
- [x] 2.2 Add a recurrence snapshot checklist controller and use the shared checklist surface for prototype checklist editing.

## 3. Unified Open-Row Lifecycle

- [x] 3.1 Centralize recurrence prototype open identity and autosave flushing in TasksShell.
- [x] 3.2 Ensure opening any ordinary task or recurrence prototype closes the currently open counterpart and uses the ordinary blue row treatment.

## 4. Verification

- [x] 4.1 Add regression tests for shared drawer structure, checklist interactions, prototype exceptions, and one-open-row behavior.
- [x] 4.2 Validate OpenSpec, targeted and full tests, lint, build, and rendered desktop and mobile Upcoming interactions.
- [x] 4.3 Match the prototype's composed open-row highlight layers to the ordinary task surface and verify the rendered color.

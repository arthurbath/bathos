## Why

Tasks uses Lucide consistently but currently selects icons independently at each rendering site, so the same product concept can drift between navigation, search, planning, and creation surfaces. A durable concept-to-icon contract will preserve the user's approved visual language as the module grows.

## What Changes

- Establish one canonical Tasks icon registry for domain entities, planning views and horizons, task metadata and state, provenance, creation actions, and module utilities.
- Apply the user's explicit icon overrides for Task, Project, Area, Areas & Projects, Task Checklist, Attachment, Someday, Done, Add Task, Add Project, and Add Area.
- Replace affected navigation, search, hierarchy, checklist, and creation surfaces with the canonical icons while preserving labels and accessible names.
- Add a human-readable Tasks iconography reference and regression coverage that keeps the registry, rendered UI, and documentation aligned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Require stable, documented Lucide icons for recurring Tasks concepts and consistent reuse across module surfaces.

## Impact

- Tasks module React components and the BathOS launcher registry.
- A new module-local icon registry with no cross-module dependency.
- Personal Tasks durable specification and human-facing module documentation.
- No database, synchronization, MCP, reminder, or production infrastructure changes.

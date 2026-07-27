## Why

Projects duplicate most of the planning, lifecycle, reminder, recurrence, template, and organization capabilities already owned by tasks while adding a second plannable root to every persistence and integration layer. The owner does not use Projects, the only production Project is disposable test data, and the existing Area → Task → Checklist Item model can support the intended personal workflow with substantially less structural complexity.

## What Changes

- **BREAKING** Remove Projects as an active Tasks entity from PostgreSQL, PowerSync, the web application, MCP, templates, recurrence, reminders, search, clipboard placement, export/restore, history, recovery, and documentation.
- **BREAKING** Delete the single disposable production test Project and its Project-only history instead of converting it into a task.
- Remove `tasks_projects`, `tasks_todos.project_id`, and `tasks_reminders.project_id`; tighten current hierarchy, reminder, recurrence, and template contracts to Areas, tasks, and checklist items.
- Reduce the PowerSync Tasks topology from exactly 21 synchronized tables to exactly 20 and remove Project upload and read paths.
- Remove the Projects index, Project detail route, Project navigation, Project cards, Project metadata, Project organization choices, Project quick-find results, and Project keyboard/API terminology.
- Keep Areas optional and directly assign tasks to no Area or exactly one Area.
- Make task templates the only template kind and to-dos the only plannable reminder and recurrence root.
- Introduce export schema 13 without Projects while preserving bounded schema 3 through 12 restore compatibility by flattening legacy Project tasks into the Project's Area and discarding Project-only wrapper records.
- Redirect retired `/tasks/projects` and `/tasks/projects/:projectId` URLs to `/tasks/anytime`.
- Preserve the existing checklist-item persistence foundation for the later checklist editing change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace the Area → Project → Task hierarchy and Project-specific planning surfaces with the optional Area → Task → Checklist Item model.
- `mcp-module-actions`: Remove every Project record type, parameter, read scope, and mutation tool from the Tasks MCP contract.

## Impact

- Tasks React routes, navigation, hierarchy hooks, list derivation, drag/drop, sorting, editing, search, clipboard, templates, reminders, recurrence, portability, undo/recovery, iconography, tests, and human guidance.
- Supabase tables, constraints, triggers, functions, grants, RLS-dependent access paths, generated types, export/restore schema, permanent deletion, reminder dispatch, recurrence evaluation, and production fixtures.
- PowerSync client schema, connector, Sync Streams, publication membership, replication-role grants, topology verification, and local database upgrade behavior.
- BathOS MCP source, generated Edge Function bundle, tool registry, schemas, descriptions, tests, and deployment.
- Production rollout requires a verified private backup, a final zero-dependency Project audit, explicit deletion of disposable test data, coordinated 20-table PowerSync normalization, MCP deployment, web publication, and owner-scoped cleanup-backed acceptance.

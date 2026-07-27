## Context

BathOS Tasks currently treats Projects as independently plannable hierarchy roots with their own Area membership, content, lifecycle, planning dates, reminder, recurrence, template identity, ordering, history, recovery, routes, search results, and MCP tools. Tasks can point either directly to an Area or to a Project whose Area is inherited. This doubles many task-domain branches and complicates every synchronized mutation despite Projects having no meaningful production use.

Production contains one open disposable test Project, no Project children, no Project reminders, no Project templates, no Project recurrence occurrences, no Project lifecycle operations, and one Project history event. Existing checklist items already attach directly to tasks, so removing Projects produces the intended optional Area → Task → Checklist Item hierarchy without waiting for the later checklist editor.

The change must preserve offline-first operation, task-level undo/redo, owner isolation, current Mail capture, reminders, recurrence, templates, recovery, PowerSync convergence, and schema 3 through 12 backup readability. Historical SQL migrations remain immutable even though they retain the retired concept.

## Goals / Non-Goals

**Goals:**

- Remove Projects from every active persistence, synchronization, application, automation, and documentation contract.
- Delete the disposable production Project and Project-only history without transforming it into user work.
- Preserve every non-Project owner record and every ordinary task's identity, Area, planning, source, reminder, recurrence, history, and checklist data.
- Make direct optional Area assignment the only task organization relationship.
- Retain bounded compatibility for older exports without retaining Projects in the current runtime model.
- Normalize PowerSync from 21 to exactly 20 approved Tasks tables and keep MCP/web deployment ordered around the breaking schema.

**Non-Goals:**

- Build the checklist editing interface.
- Convert Project children into checklist items or otherwise invent lossy semantic mappings.
- Rewrite or delete historical migration files.
- Add arbitrary nesting, multiple Area membership, tags, or another container entity.
- Preserve the disposable test Project, its title, or its Project-only history.
- Change Area administration, task planning, automatic sorting, bulk drag, reminder timing, recurrence semantics, or Mail capture beyond removing Project branches.

## Decisions

### Use a hard runtime contraction

The migration drops `tasks_projects`, `tasks_todos.project_id`, and `tasks_reminders.project_id`, and removes Project variants from active checks, triggers, functions, generated types, local schemas, tools, and UI.

Alternative considered: hide Projects in React while retaining the table and API. Rejected because it preserves the complexity the change exists to remove and permits restore or automation to recreate Projects.

### Gate destructive migration on exact zero-dependency assertions

Immediately before mutation, the migration asserts that there is exactly one disposable present Project and that Project task assignments, active or historical Project reminders, Project templates, Project recurrence occurrences, and Project hierarchy operations are zero. It deletes that Project and its Project-only hierarchy history, then removes the schema.

If production drifts after the preflight, the migration fails closed rather than flattening or deleting unexpected content. The private backup remains the recovery authority.

Alternative considered: generically flatten any Project tasks into Areas. Rejected because the owner confirmed the sole Project is disposable, the dependency count is zero, and a generic flattening path would conceal unexpected production drift.

### Keep legacy compatibility at the import boundary

Export schema 13 contains Areas, tasks, checklist items, and the other current owner collections but no Projects or Project references. Schema 3 through 12 import normalizers read legacy Projects only long enough to:

- assign a Project task directly to the Project's Area when one exists;
- otherwise leave the task unassigned;
- preserve stable task identity and task-owned metadata;
- discard Project wrapper, Project history, Project reminder, Project recurrence, and Project template records.

Current replace restore accepts schema 13. Older replace restores normalize into schema 13 before application. Immutable historical JSON inside retained audit rows may contain legacy keys but no current relation or tool reads them.

Alternative considered: drop all old restore support after generating a schema-13 backup. Rejected because the current verified backup is schema 12 and emergency recovery should not depend on a one-off external converter.

### Keep only task template, recurrence, and reminder roots

Template `kind`, template revision `source_type`, template instantiation `root_type`, recurrence occurrence `root_type`, and reminder `root_type` become to-do-only contracts. Project-specific template snapshots and repository paths are removed. Checklist nodes remain part of task templates.

Project-capable historical records are deleted only where they correspond to the confirmed disposable Project. All task-owned records remain unchanged.

### Collapse organization to direct Area assignment

Every active task has either `area_id = null` or one owned Area. Effective-Area derivation becomes direct Area lookup. Cross-Area drag assigns the destination Area; moving to the unassigned region clears Area. Automatic sorting, bulk projection, clipboard placement, task creation, Quick Find, and second-row metadata use no Project branch.

The Organization field becomes an Area field with `No Area` as its null option. The control keyboard description becomes `Move to Area`.

### Retire Project routes with stable redirects

Projects navigation, index, detail, cards, creation, reminder forms, and search results are removed. `/tasks/projects` and `/tasks/projects/:projectId` remain recognized compatibility paths that replace-navigate to `/tasks/anytime`, preventing stale bookmarks or installed clients from falling into the Tasks route fallback.

### Coordinate the PowerSync break as one exact topology change

The client schema and upload connector remove `tasks_projects` and Project columns. PowerSync Cloud Sync Streams, publication membership, replication-role grants, deployment topology assertions, and fixtures move from 21 to exactly 20 tables.

Database/MCP compatibility is deployed before the project-free web client. The PowerSync configuration is normalized within the same bounded rollout so a new client never requests a removed table and an older client is not left writing Project data indefinitely.

### Regenerate rather than hand-edit the deployed MCP bundle

Source tools remove Project record schemas, reads, creation, update, transition, reorder, schedule, reminder, and task-assignment fields. The generated Supabase `mcp` Edge Function is rebuilt from the source registry and deployed with its existing custom OAuth/JWT verification boundary unchanged.

## Risks / Trade-offs

- [Unexpected Project dependency appears before deployment] → Assert exact counts inside the migration and abort without partial mutation.
- [Dropping a synchronized table strands an older local client] → Coordinate database, PowerSync, MCP, and web rollout; verify a fresh and an upgraded local projection.
- [Schema-12 restore recreates Projects] → Normalize legacy Project task membership before insert and never write a Project row.
- [Old Project URLs break bookmarks] → Retain route recognition and replace-navigate to Anytime.
- [Project terminology survives in specs or generated artifacts] → Run an active-surface Project reference audit that excludes immutable archived migrations and explicitly allow only legacy compatibility adapters.
- [Project-only root variants remain accepted by SQL or MCP] → Tighten checks and schemas, add rejection tests, and run owner-scoped production acceptance.
- [A rollback needs the dropped table] → Restore the verified private schema-12 backup and prior release as one coordinated recovery; application-only rollback after migration is unsupported.

## Migration Plan

1. Finish and archive the overlapping Area, sorting, drag, focus, search, and lifecycle changes.
2. Add failing domain, repository, portability, route, component, MCP, migration, and topology tests for the project-free model.
3. Generate a Supabase migration through the CLI and implement exact production assertions, disposable Project deletion, schema-13 normalization, SQL function rewrites, constraint tightening, and table/column removal.
4. Remove Projects from TypeScript models, repositories, hooks, UI, routes, search, templates, recurrence, reminders, clipboard, history, generated types, PowerSync, MCP, and documentation.
5. Validate focused tests, full tests, type checking, lint, build, strict OpenSpec, database tests/lint, production-topology checks, offline behavior, and rendered desktop/mobile views.
6. Refresh and verify the private production backup, re-run read-only dependency counts, and compare the pending migration against the approved destructive scope.
7. Apply the migration, normalize PowerSync to 20 tables, deploy the MCP Edge Function, publish the web release, and run cleanup-backed owner-scoped acceptance.
8. Verify zero Projects, zero Project columns/tools/routes, 20-table PowerSync parity, healthy cron/advisors, ordinary Mail capture, reminders, offline projection, and no fixture residue.
9. Sync and archive the OpenSpec change, commit, push `main`, and prove repository and production parity.

Rollback after the destructive migration requires the verified private backup because the removed disposable Project and schema cannot be reconstructed from project-free rows.

## Open Questions

None. The owner explicitly authorized deleting the sole Project and confirmed it has no user value.

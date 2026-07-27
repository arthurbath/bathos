## ADDED Requirements

### Requirement: Project-Free Tasks MCP Surface
The BathOS MCP SHALL expose owner-scoped Tasks resources and mutations for Areas, tasks, and checklist items without accepting, returning, creating, updating, moving, scheduling, reordering, reminding, transitioning, restoring, or searching a Project entity.

#### Scenario: Read the project-free hierarchy
- **WHEN** an authenticated client reads the complete Tasks hierarchy or an Area or task scope
- **THEN** the response contains Areas, tasks, and applicable checklist items with no Projects collection or Project identifier

#### Scenario: Create or move a task
- **WHEN** an authenticated client creates or moves a task
- **THEN** it may assign one owned Area or no Area and the request schema exposes no Project parameter

#### Scenario: Reject a stale Project operation
- **WHEN** a stale client submits a Project record type, root type, identifier, transition, reminder, recurrence, template, or reorder request
- **THEN** MCP schema validation rejects the request before any Supabase mutation

#### Scenario: Preserve guarded task mutations
- **WHEN** a client mutates an Area, task, or checklist item after Project removal
- **THEN** the existing owner scope, current-revision guard, idempotency identity, mutation channel, actor attribution, and recoverable lifecycle requirements remain enforced

## REMOVED Requirements

### Requirement: Project MCP Resource Actions
**Reason**: Projects are no longer part of the Tasks data model.
**Migration**: Remove Project tools and fields from the source registry and redeployed MCP Edge Function; clients use tasks with optional Area assignment and checklist items.

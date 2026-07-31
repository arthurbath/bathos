## ADDED Requirements

### Requirement: Template-Free Tasks MCP Surface
The BathOS MCP server SHALL expose owner-scoped Tasks resources and mutations for Areas, ordinary tasks, checklist items, and recurrence prototypes without exposing a reusable Template entity or Template operation.

#### Scenario: Read template-free Tasks data
- **WHEN** an authenticated MCP client requests task data or a defined task view
- **THEN** the response contains only the signed-in owner's supported Areas, ordinary tasks, checklist items, reminders, and recurrence records with no Template collection or Template identifier

#### Scenario: Reject a stale Template operation
- **WHEN** a stale MCP client submits a Template record type, identifier, creation, revision, instantiation, archive, recurrence-template, or reorder request
- **THEN** MCP schema validation rejects the unsupported request before any Supabase mutation

#### Scenario: Preserve recurrence without Templates
- **WHEN** an authenticated client reads or changes supported repeating work
- **THEN** recurrence definitions and immutable revisions carry the prototype content and schedule directly without a Template resource or Template-backed task provenance

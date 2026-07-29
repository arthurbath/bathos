## Why

BathOS Tasks is ready to replace Things as the authoritative personal task system, but the existing Things corpus and its automated capture paths must move together to avoid lost work, duplicate processing, or a split source of truth. The cutover needs a private, deterministic, reversible migration that preserves the task behavior the user relies on without carrying over unstructured Things-specific metadata.

## What Changes

- **BREAKING** Replace the owner's current BathOS Tasks corpus with the approved open Things Anytime, Someday, Upcoming, Today, template-project, checklist, reminder, deadline, area, and recurrence content while excluding Things Logbook and Trash.
- Preserve Today planning with the neutral Inbox horizon, future Starts, Someday status, deadlines, reminder intent, notes, links, title emoji, area membership, manual order where meaningful, and the approved tag-to-actionability mapping.
- Convert each Things project template into one ordinary BathOS task whose open child tasks become ordered checklist items, without importing Things headings or relationship/provenance metadata.
- Decode legacy Things recurrence rules into native BathOS recurrence definitions, revisions, templates, and occurrences without duplicating visible current work.
- Build a deterministic private extractor, validator, replacement-envelope generator, and reconciliation report that never commits personal Things content or identifiers to the repository.
- Preserve owner settings and approved Areas while atomically replacing task-owned production data from a verified private backup.
- Retire Things output from Inbox Manager and the Raycast webpage capture workflow so each existing OpenAI refinement runs once and creates only a BathOS Task.
- Reconcile or safely drain accepted and pending Inbox Manager handoffs at the cutover boundary so no pre-cutover task is lost or reintroduced.

## Capabilities

### New Capabilities

- `things-cutover-migration`: Private Things discovery, deterministic semantic mapping, atomic Tasks replacement, capture-path cutover, and cross-system reconciliation.

### Modified Capabilities

- `personal-tasks-module`: Imported Tasks content becomes the authoritative corpus and must preserve supported planning, actionability, checklist, reminder, template, area, and recurrence behavior.

## Impact

- BathOS Tasks migration tooling, Supabase replacement/restore surfaces, recurrence records, acceptance fixtures, and readiness documentation.
- The production Tasks corpus for the approved owner, with a mandatory verified predeployment backup and rollback path.
- Inbox Manager's installed runtime and repository, including permanent Tasks-only delivery after one existing AI refinement.
- Raycast webpage-to-task commands and documentation, with legacy Things-writing commands retired or redirected.
- PowerSync remains limited to the existing approved Tasks table set; no Things identifiers or private source content enter version control.

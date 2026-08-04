## MODIFIED Requirements

### Requirement: Deterministic Task Reconciliation
The system SHALL use stable task identifiers, mutation identifiers, optimistic integer revisions, and explicit actor provenance so stale user-authored task mutations are recovered without overwriting unrelated concurrent fields, stale system-authored maintenance yields to newer authoritative state, and unresolved user intent is never silently discarded.

#### Scenario: Upload a current task revision
- **WHEN** a queued task mutation increments the server's current revision by one
- **THEN** the server accepts the mutation and the client removes it from the durable queue

#### Scenario: Rebase a stale field-level task mutation
- **WHEN** another client or server automation has advanced a user-authored task beyond a queued task PATCH's base revision
- **THEN** the client preserves the queued PATCH fields, rebases them onto the current authoritative revision, preserves unrelated authoritative fields, and retries with the original mutation identity and a contiguous revision

#### Scenario: Recover a planning edit racing due-task activation
- **WHEN** a user changes a task's start date or deadline while due-task activation advances the same task from the earlier revision
- **THEN** the user's queued planning fields are replayed onto the activated task, unrelated activation or task fields are preserved, and refresh does not restore the pre-edit planning values

#### Scenario: Recognize a rebased retry that already succeeded
- **WHEN** a rebased task write reaches the authoritative service but its success response is lost
- **THEN** a retry with the same mutation identity is classified as already applied and does not duplicate history or advance the revision again

#### Scenario: Retain a user task mutation after bounded conflicts
- **WHEN** concurrent writers prevent a queued user-authored task PATCH from succeeding within the immediate retry bound or the authoritative task is unavailable
- **THEN** the client records a content-free pending-retry receipt, leaves the mutation in PowerSync's durable queue, and retries later instead of completing and discarding it

#### Scenario: Supersede stale system maintenance after a revision change
- **WHEN** a queued task PATCH explicitly marked as system-authored maintenance conflicts with a newer authoritative task revision
- **THEN** the client keeps the authoritative task unchanged, records one content-free supersession receipt, completes that queued maintenance entry, and continues uploading later entries

#### Scenario: Supersede stale system maintenance for a missing task
- **WHEN** a queued task PATCH explicitly marked as system-authored maintenance targets a task that is absent from the authoritative owner scope
- **THEN** the client does not recreate the task, records one content-free supersession receipt, completes that queued maintenance entry, and continues uploading later entries

#### Scenario: Apply current system maintenance
- **WHEN** a queued task PATCH explicitly marked as system-authored maintenance is based on the authoritative task's current revision
- **THEN** the server accepts the maintenance mutation normally and the client removes it from the durable queue

#### Scenario: Record automatic conflict recovery
- **WHEN** a stale queued user-authored task PATCH succeeds after one or more rebases
- **THEN** the client records or updates one content-free recovery receipt for that queued operation and removes the mutation from the durable queue

#### Scenario: Reconcile completion against a stale unrelated edit
- **WHEN** one client completes a task and another client uploads a user-authored field-level edit based on the same earlier revision
- **THEN** the completion remains authoritative while the unrelated edited fields are replayed onto the completed task

#### Scenario: Resolve competing writes to the same field
- **WHEN** two clients change the same scalar task field from the same earlier revision
- **THEN** the first accepted value advances the revision and the later queued user-authored field-level mutation is replayed as the next authoritative revision without losing unrelated fields

#### Scenario: Preserve immutable entry provenance
- **WHEN** web, native, MCP, or server automation mutations race on one task
- **THEN** reconciliation preserves immutable entry provenance while applying each accepted mutation's mutable actor and operation metadata

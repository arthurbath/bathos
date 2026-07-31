## Context

Tasks currently stores recurrence content indirectly through `tasks_templates` and `tasks_template_revisions`. Calendar evaluation also materializes one future task occurrence and the web client infers that any open occurrence whose logical scheduled date is after the owner planning date is the recurrence prototype. This creates an identity collision: a reached ordinary instance that a user defers into Upcoming remains recurrence-linked, while a future materialized task is treated as the editable prototype. The Templates view then exposes recurrence backing records as though they were reusable user templates.

The two local migrations that further separate projection styling and prototype editing have not been applied remotely. They can be replaced before production rather than compensated for later. The production database remains on the original template-backed recurrence schema and PowerSync currently projects 20 approved Tasks tables.

## Goals / Non-Goals

**Goals:**

- Make a recurrence definition plus its current revision the first-class prototype and the only source for future instance content.
- Render that prototype in Upcoming without creating a future task row.
- Preserve every reached spawned instance as an ordinary, independently editable task even when its Start is moved into the future.
- Preserve calendar and after-completion timing, idempotency, terminal restoration, recurrence editing, reminders, deadlines, areas, Primary Links, Notes, and checklist content/state.
- Remove all template storage and product surfaces and intentionally discard standalone template data.
- Convert production atomically and fail closed if legacy recurrence relationships are malformed.

**Non-Goals:**

- Design or preserve a reusable task-template product.
- Let instance edits flow back into a prototype or later instances.
- Make recurrence prototypes draggable, completable, bulk-editable, or ordinary task rows.
- Apply the destructive production migration without a fresh backup, exact preflight, and explicit rollout approval.

## Decisions

### Store the prototype snapshot on each recurrence revision

`tasks_recurrence_revisions` will receive a validated `prototype_snapshot` JSON object containing the task fields and checklist nodes required to spawn an instance. Each recurrence edit or prototype-content edit creates a new immutable recurrence revision carrying both schedule and content.

This is preferred to a new prototype table because schedule and content must advance atomically, immutable revisions already provide history and conflict control, and it avoids replacing three removed sync tables with another synchronized table. Keeping template tables was rejected because they expose a second product concept and make recurrence integrity depend on a generic instantiation subsystem.

### Render prototypes as virtual Upcoming rows

The current recurrence definition and revision will expose the next logical spawn date and waiting state. The web client will build a recurrence-prototype view model from recurrence data and render it in the correct Upcoming date bucket or the Repeating Tasks waiting section. Prototype rows use recurrence definition identifiers, not task identifiers.

Materializing a future task row was rejected because it makes the prototype indistinguishable from a reached instance and allows task list operations to mutate schedule authority accidentally.

### Keep occurrence rows only for spawned ordinary instances

`tasks_recurrence_occurrences` will continue to provide deterministic logical keys, source revision, scheduled date, and root task identity, but it will no longer reference template instantiations. Every occurrence row denotes a task that has actually been spawned or adopted as the first ordinary instance.

Whether an instance has been reached is determined from the occurrence's immutable logical `scheduled_date`, not the task's editable `start_date`. Therefore a reached instance deferred to a future Start remains ordinary and visible, while no future occurrence row exists to be mistaken for a prototype.

### Separate prototype content from instance state

Instance generation copies Summary, Notes, Primary Link, Area, Actionability, destination/horizon planning defaults, and checklist titles, order, and completion state from the recurrence revision snapshot. Later task or checklist edits affect only that instance. Prototype editing operates directly on the recurrence revision snapshot and never reads content back from the latest instance.

### Advance calendar prototypes without pre-generating work

Calendar evaluation spawns every due logical event permitted by the missed-event policy through the owner planning date, then computes and persists the next future logical date on the recurrence definition. It does not create that future task. Upcoming displays the persisted next date.

Persisting the next date is preferred to recomputing it only in the client because native clients, server evaluation, search, and future automation need one authoritative projection and because recurrence calculations must not diverge across runtimes.

### Preserve after-completion restoration semantics

An after-completion prototype references its outstanding spawned occurrence through recurrence lineage. While that instance is open, the prototype is waiting. Completion or trash supplies the terminal owner-local date from which the next date is computed. Restoration before that successor is reached cancels the unspawned successor projection and returns the prototype to waiting. If a successor has already spawned, restoration does not delete or merge either ordinary task.

### Replace the two unshipped recurrence migrations

The local-only `20260731043000_separate_recurrence_prototypes_and_instances.sql` and `20260731060715_refine_recurrence_prototype_authority.sql` will be removed and replaced by one migration created with the Supabase CLI after `20260731011500`. This keeps the remote migration history linear and avoids briefly installing the rejected materialized-prototype model.

### Migrate legacy recurrence data before dropping templates

For each current recurrence revision, the migration copies and validates the referenced template revision snapshot into `prototype_snapshot`. If a legacy materialized future projection exists, its current task content and checklist state are used as the latest prototype content before that projection task and its occurrence are removed. A row is a removable legacy projection only when its occurrence `scheduled_date` is later than the owner's current planning date. A reached occurrence whose task Start was deferred remains intact because its immutable scheduled date is current or past.

After recurrence conversion succeeds, the migration removes template foreign keys and provenance, drops template RPCs/triggers/private context, removes the three template tables from PowerSync publication, and drops the tables. Unexpected missing snapshots, duplicate future projections, cross-owner links, or invalid occurrence graphs abort the transaction before deletion.

### Remove Templates from current portability and accept legacy data narrowly

The current Tasks export schema will advance to version 14 and omit template collections and template provenance. Supported legacy exports may contain standalone templates, which are ignored with a deterministic normalization report. A legacy recurrence may be restored only when its referenced template revision can be converted into a recurrence prototype snapshot; otherwise preview fails closed rather than silently creating incomplete repeating work.

## Risks / Trade-offs

- **Prototype snapshot migration could choose the wrong legacy row** -> Classify by immutable occurrence `scheduled_date`, assert at most one future projection per active recurrence, and cover the deferred-instance case in database tests.
- **Dropping templates destroys data** -> This removal is intentional, but production rollout requires a fresh private backup and exact counts for templates, revisions, instantiations, recurrence dependencies, and rows to delete before approval.
- **Calendar prototypes could drift from server evaluation** -> Persist the next logical date authoritatively and test preview/server parity at month/year boundaries and owner-local midnight.
- **After-completion restoration can race successor generation** -> Use the existing recurrence transaction lock and deterministic logical key. Only cancel an unspawned successor projection.
- **Virtual rows require separate UI behavior** -> Give prototypes a dedicated view model and renderer rather than manufacturing partial `TaskTodo` objects or passing them through task drag, selection, completion, or editing code.
- **Older clients still expect template tables** -> Publish the database contraction and matching backward-compatible web/native release together. Do not remove the tables before the new client is available.

## Migration Plan

1. Replace the two unapplied local recurrence migrations with one new Supabase migration.
2. Add fail-closed preflight assertions and copy current template snapshots into recurrence revisions.
3. Convert and delete only genuine future projection task rows, preserving reached and deferred ordinary instances.
4. Replace recurrence RPCs and triggers, then remove template dependencies, tables, publication entries, and client schema entries.
5. Update generated types, portability schema, web UI, tests, and native/shared projections.
6. Validate from a clean local database with database tests, advisors, application tests, TypeScript, lint, build, and strict OpenSpec validation.
7. Before production, refresh and verify the private backup, report exact destructive counts, and obtain explicit rollout approval.
8. Apply migrations in order, publish the matching client, run owner-scoped calendar/deferred/after-completion fixtures, clean them up, and verify PowerSync contains exactly 17 approved Tasks tables.

Rollback after production application requires restoring the verified pre-migration backup and redeploying the prior client. The removed template data cannot be reconstructed from the contracted schema alone.

## Open Questions

None. Reusable templates are intentionally deferred until they can be specified as an independent product capability.

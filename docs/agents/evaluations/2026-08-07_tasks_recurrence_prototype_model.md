# Tasks Recurrence Prototype Model Evaluation - 2026 Aug 7

## Question

Should an Upcoming recurrence prototype become an ordinary `tasks_todos` row so that it automatically inherits every ordinary task interaction and presentation behavior?

## Recommendation

Keep recurrence definitions, revisions, and occurrence records distinct from ordinary generated to-dos. Continue converging recurrence prototypes and ordinary to-dos at the presentation and interaction layers by giving both a shared task-row identity, keyboard contract, metadata drawer components, checklist editor, link handling, selection behavior, and drag behavior.

This is a shared-behavior recommendation, not a recommendation to preserve separate user experiences. A prototype should feel like an ordinary to-do with only the recurrence-specific exceptions visible to the user.

## Current Evidence

- An ordinary task is a mutable `tasks_todos` record with lifecycle, disposition, destination, planning dates, completion state, and optional recurrence occurrence identity.
- A prototype is immutable revision content stored in `tasks_recurrence_revisions.prototype_snapshot`. Its editable task-like fields include Summary, Notes, Link, Actionability, destination, horizon, ordering, offsets, and checklist content.
- A recurrence definition owns status, current revision, cadence position, and the next occurrence cursor.
- An occurrence record owns a stable logical key and connects one recurrence revision to one generated ordinary task instance.
- Generated ordinary tasks already carry `recurrence_definition_id`, `recurrence_revision`, `recurrence_occurrence_id`, and `recurrence_logical_key`. That lets ordinary task lifecycle events advance an after-completion schedule without making the definition itself completable.
- Start-based schedules use a versioned logical-key namespace. This protects idempotent generation independently from the mutable identity and lifecycle of an ordinary task row.
- Recurrence history, export and restore, reminder generation, PowerSync queries, and permanent deletion all depend on the definition-revision-occurrence separation.

## Why Literal Model Unification Is Unsafe

Turning a prototype into a `tasks_todos` row would overload one row with incompatible meanings:

- An ordinary task can be completed, deleted, reopened, moved between lists, and permanently retired. A definition instead becomes active, paused, or archived and must continue projecting future dates.
- An ordinary task has one realized Start and Deadline. A definition owns a cadence, a date basis, offsets, and multiple future projections.
- An ordinary checklist records work performed on one instance. A prototype checklist is source material copied into future instances and must not inherit completion mutations from any generated instance.
- Ordinary-task ordering is the order of a realized item. Prototype ordering is the order of a future projection and must survive occurrence generation.
- Idempotent generation needs a definition, revision, and logical occurrence key that remain stable even when the generated task is edited or retired.

A literal merge would therefore require conditional lifecycle rules throughout the database, synchronization layer, history system, portability format, and every task mutation path. It would increase the chance that an ordinary action accidentally changes recurrence state or that prototype edits rewrite an existing occurrence.

## Safe Convergence Path

The current work establishes the right boundary:

1. Use a namespaced shared row ID, such as `recurrence:<definition-id>`, so ordinary tasks and prototypes participate in one rendered focus and selection sequence.
2. Reuse the ordinary metadata drawer fields and checklist editor against a recurrence-snapshot adapter.
3. Route shared actions through a task-like command interface, then dispatch persistence to either the ordinary task repository or recurrence revision service.
4. Keep only true recurrence differences conditional: completion control, Start and Deadline editing, repeat-cadence editing, and legal cross-bucket movement.
5. Add parity regressions whenever an ordinary row or metadata component changes.

## Conclusion

The user-facing model should be unified. The persistence model should remain separated. The durable architectural rule is: recurrence prototypes are task-like projections backed by immutable recurrence revisions, while generated occurrences are ordinary tasks. Shared UI behavior belongs in common components and adapters rather than in duplicated prototype-only implementations.

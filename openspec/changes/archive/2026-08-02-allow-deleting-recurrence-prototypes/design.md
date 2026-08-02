## Context

Upcoming renders recurrence prototypes from active recurrence definitions. The client already supports an owner-scoped, revision-guarded status mutation whose archived state removes a definition from synchronized active recurrence queries, but prototype rows do not expose that operation.

## Goals / Non-Goals

**Goals:**

- Expose Delete on both dated and waiting recurrence prototype menus.
- Reuse the existing archived recurrence status as the prototype deletion state.
- Remove the prototype optimistically while retaining failure recovery and user feedback.
- Leave every already generated ordinary task instance unchanged.

**Non-Goals:**

- Physically purge recurrence records or add archived-recurrence recovery UI.
- Delete, complete, or otherwise mutate generated instances.
- Add bulk prototype deletion or change ordinary task deletion.

## Decisions

- Pass a prototype deletion callback from the recurrence model through Upcoming composition to each recurrence row. This keeps the row presentational and keeps persistence in the existing recurrence hook.
- Implement Delete by setting the recurrence definition status to `archived`. The existing RPC is owner-scoped, revision-guarded, idempotent, and records a recurrence status event.
- Apply the action to dated and waiting rows. Both are presentations of the same durable prototype and should expose the same lifecycle control.
- Await pending prototype metadata saves before deletion. This prevents an in-flight metadata edit from racing the status mutation.
- Show a destructive toast and retain or restore the row if the mutation fails.

## Risks / Trade-offs

- [A metadata save and Delete are invoked nearly together] -> Flush and await the row save queue before archiving the latest definition revision.
- [A concurrent client changes the definition first] -> Preserve the existing record-revision conflict response and show an actionable failure toast.
- [Users expect prior instances to vanish] -> Keep generated instances independent by limiting the mutation to recurrence status.

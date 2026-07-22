## Why

The current Tasks model conflates a to-do's Today membership with its Now, Next, or Later placement, so assigning a future start date erases the user's intended placement. Tasks needs an independent day horizon that can be chosen in advance and can also provide an Inbox bucket for newly due or newly captured work.

## What Changes

- Add Inbox as the first Today subsection before Now, Next, and Later.
- Persist `none`, `inbox`, `now`, `next`, or `later` independently from a to-do's start date so future work retains its intended day horizon while it remains in Upcoming.
- Include a due Anytime to-do in Today on its owner-local start date, using Inbox when no explicit horizon has been selected.
- Keep undated Anytime work out of Today unless the user explicitly assigns Inbox, Now, Next, or Later.
- Surface the day horizon with the start-date controls in the task editor and task planning surface.
- Route newly captured work to Today Inbox for triage while retaining explicit caller-supplied horizons.
- Apply the same planning semantics to projects so the shared Today and Upcoming views remain internally consistent.
- Update MCP, templates, recurrence, export and restore, PowerSync, tests, and documentation to preserve the independent field end to end.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change Today derivation, temporal planning, capture defaults, ordering, presentation, templates, recurrence, and portability to use an independent four-value day horizon.
- `mcp-module-actions`: Accept, preserve, validate, and return the independent day horizon through Tasks service operations.

## Impact

The change affects the Tasks React module, shared Tasks TypeScript domain types, local PowerSync queries and schema, Supabase constraints and service functions, the MCP Edge Function, template and recurrence snapshots, export and replacement restore normalization, production PowerSync projection, Raycast and Mail capture defaults, and the durable Tasks and MCP specifications. It adds no dependency and does not affect other BathOS modules or Mail classification policy.

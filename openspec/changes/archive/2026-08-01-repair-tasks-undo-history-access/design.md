## Context

Task undo is reconstructed client-side from the newest 500 accepted `tasks_history_events` rows. The decoder currently fails the complete batch on the first incompatible row. Production contains valid `widget` channel events introduced by the widget-completion authority and retained `template` source snapshots preserved by append-only history during template removal. The TypeScript vocabulary does not recognize either historical shape, so parsing returns an empty cursor and both history controls remain disabled.

## Goals / Non-Goals

**Goals:**

- Restore undo and redo without rewriting or deleting append-only production history.
- Keep current database mutation-channel vocabulary aligned with the client domain vocabulary.
- Normalize the retired template provenance only while decoding history.
- Preserve fail-closed safety for genuinely malformed or unsafe history.
- Produce content-free diagnostics for reconstruction failures.

**Non-Goals:**

- Change the task or history schema.
- Make system migrations user-undoable.
- Skip an unknown newest action and expose an older action that may no longer be chronologically or structurally safe.
- Rewrite historical rows in production.

## Decisions

1. Add `widget` to the shared task entry-channel vocabulary. This matches the already deployed database constraints and avoids a second client-only channel list. Treating widget history as invalid is incorrect because widget completion is an approved task mutation surface.

2. Normalize `source_kind = 'template'` snapshots to the current template-free representation at the history decoding boundary. The migration already converted live template-derived tasks by clearing source kind and related source fields. Applying the same deterministic normalization to retained snapshots preserves append-only history while letting later compatible events reconstruct.

3. Continue to fail closed for unknown or malformed history rather than skipping it. Skipping an unknown event could expose an older action as the apparent latest action. Instead, report a content-free reconstruction diagnostic and keep traversal unavailable until compatibility is restored.

4. Test the complete failure mode at both the parser and hook levels. Coverage must include a mixed 500-row-compatible stream containing widget events and legacy template snapshots, followed by a current user mutation whose task projection matches the history tip.

## Risks / Trade-offs

- [Risk] Normalizing retired template provenance loses the ability to restore template-only source fields through undo. -> Template provenance is no longer legal task state, so normalization intentionally preserves the current template-free invariant instead of resurrecting retired infrastructure.
- [Risk] Another future database vocabulary change could repeat this failure. -> Align shared vocabulary in tests and emit diagnostics that identify the incompatible field without task content.
- [Risk] Fail-closed handling still disables history for genuinely unknown data. -> This is required to avoid traversing past an action whose effect cannot be proven safe.

## Migration Plan

No database migration is required. Ship the backward-compatible web client, verify the production history vocabulary through read-only queries, and confirm a new user action enables Undo and can be undone and redone. Rollback is the prior web client, although rollback reintroduces the disabled cursor.

## Open Questions

None.

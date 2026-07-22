## Context

Tasks already records accepted mutations in append-only history and exposes a guarded inverse operation, but the current client projects only the latest safe event and presents it as a header button. Selection likewise starts from a header button, and manual ordering is limited to one-position keyboard or menu commands. The requested interaction model makes these operations direct, cross-platform, and discoverable without adding persistent header chrome.

The implementation spans React interaction state, PowerSync-backed repository behavior, and the PostgreSQL history trigger. Owner checks, exact snapshot matching, optimistic local display, offline writes, and deterministic fractional ordering remain mandatory constraints.

## Goals / Non-Goals

**Goals:**

- Provide up to 100 guarded task undo steps and the corresponding redo path through platform-standard keyboard commands.
- Reconstruct the undo and redo cursor from authoritative append-only history so refreshes do not silently discard recoverability.
- Enter multi-selection through task-row modifier interactions and preserve an original range anchor until selection ends.
- Reorder tasks by direct drag within the same ordering scope while retaining keyboard and menu alternatives.
- Document both Mac and Windows interactions in the development command reference and identify the current platform when it can be detected.
- Preserve ordinary single-click task expansion when selection mode is inactive.

**Non-Goals:**

- Undoing task creation, restoring purged data, or replacing the existing Done recovery workflow.
- Undoing arbitrary browser, text-editor, authentication, configuration, or non-Tasks operations.
- Dragging tasks across Today sections, planning placements, views, hierarchy containers, or lifecycle states.
- Adding touch-based long-press selection or touch drag reordering in this change.
- Adding another drag-and-drop dependency or changing shared BathOS components.

## Decisions

### Reconstruct a bounded cursor from append-only history

The history hook will read a bounded recent chronological window, replay forward, undo, and redo events into undo and redo stacks, and cap each user-facing stack at 100 source mutation identifiers. New projected events update the cursor idempotently. Successful local inverse operations advance the client cursor immediately so repeated keyboard commands cannot resubmit the same source while synchronization catches up.

This is preferred over a localStorage-only command stack because authoritative history survives reloads and follows synchronized task state. It is preferred over storing mutable cursor columns in PostgreSQL because replay is deterministic, keeps the append-only audit model intact, and avoids new per-client server state.

Creation, baseline, undo, and redo events are never presented as new forward steps. A new forward mutation clears redo, matching conventional editor history behavior.

### Guard inverse direction with exact snapshots, not historical revision equality

The original accepted history event remains the source for both directions. Undo is valid only when the current task snapshot exactly matches the source event's `after_state` and the requested replacement exactly matches `before_state`. Redo is valid only for the reverse pairing. Owner and task identifiers must also match.

Revision equality cannot support a multi-step cursor because every accepted inverse increments the task revision. Exact complete-state matching provides the relevant stale-write protection while allowing a valid chain to walk backward and forward. The history trigger will classify each accepted inverse as `undo` or `redo` from its old/new snapshot orientation and retain the original source event identifier.

### Keep client history entries mutation-granular

Each accepted task history event is one undo step. Existing bulk planning can emit one accepted event per affected task, so its members are undone individually in reverse history order. Grouping UI actions would require a durable transaction-group identifier across clients and is outside this change. This keeps the audit model honest and avoids inferring groups from timestamps.

### Model selection with a stable anchor and a replaceable range

The first modifier-selected task becomes the selection anchor. Command-click on Mac or Control-click on Windows toggles a row and enters selection when needed. Shift-click selects the contiguous visible range between the unchanged anchor and the clicked row, replacing the prior range. Once selection is active, an ordinary task-title click toggles that row, matching the current explicit selection behavior. Exiting selection, changing views, or completing a bulk operation clears both the selection and anchor.

The completion control remains a completion control and does not become a selection gesture target. Assistive-technology users retain checkbox semantics, selected-count reporting, Select All, Clear, and bulk actions after selection begins.

### Use native desktop drag events with the existing ordering domain

Active rows in Today, Anytime, and Someday will use native HTML drag events and compute before/after placement from the pointer's vertical position over a target. The hook will translate the drop into the same fractional order-key domain used by keyboard reordering. Today drops are constrained to the current Inbox, Now, Next, or Later section, and Anytime/Someday drops stay in the current planning pool. Selection mode, pending rows, and unsupported views do not expose drag behavior.

Native drag events avoid a new dependency and fit the requested Mac/Windows mouse workflow. Existing Option/Alt+Arrow and menu actions remain the accessible non-pointer alternatives. A short click following a completed drag will be suppressed so dragging does not open the editor.

### Present one interaction matrix with both platforms

The Keyboard Commands dialog will become an interaction reference with Action, Mac, and Windows columns. It will include undo, redo, modifier selection, anchored range selection, drag ordering, and existing keyboard commands. The detected current platform column will receive a semantic Current indicator, but both columns remain visible during development.

## Risks / Trade-offs

- **A required source event falls outside the replay query window** -> Query more raw history than the 100-step exposed bound, validate every source before mutation, and withhold commands that cannot be proven safe.
- **Projected history arrives after a local inverse write** -> Advance the in-memory cursor after repository success and process later history events idempotently by event identifier.
- **A concurrent client changes the task targeted by undo or redo** -> Exact current/source snapshot checks reject the inverse without overwriting the concurrent state.
- **Native drag behavior varies across desktop browsers** -> Cover ordering logic with unit tests, perform rendered Chrome/Safari verification, retain keyboard and menu ordering, and avoid relying on custom drag images.
- **Modifier keys differ by operating system** -> Detect Mac-like platforms for Command-click, use Control-click elsewhere, and show both mappings in the reference.
- **A drag gesture opens the task editor on release** -> Track completed drags and suppress the immediately following click.

## Migration Plan

1. Add the `redo` transition to client and database history contracts.
2. Replace the Tasks history trigger with direction-aware exact snapshot validation while preserving owner, task, lifecycle, and append-only protections.
3. Deploy the client only after the production migration is applied so generated redo events are accepted and classified consistently.
4. Verify forward mutation, multi-step undo, multi-step redo, redo invalidation, stale conflict rejection, and synchronized history projection.

Rollback is client-first: restore the previous web bundle, then restore the prior trigger only after confirming that no client can submit redo. Existing `redo` history rows remain append-only audit records and do not require deletion. No user task content is rewritten by the migration.

## Open Questions

None. Bulk-action grouping and touch drag interactions are explicit future candidates rather than unresolved requirements for this change.

## Context

Tasks already retains an open task's projected placement and persists field edits into durable task history. The remaining problems are command ownership, focus continuity, visual continuity, and one narrow local-storage recovery case: global shortcuts currently intercept undo/redo before an editor can consume them, Area mutation can rerender the active editor, plain Escape lacks a final task-close layer, the floating creation action competes with an already-open task editor, the open task uses a separate neutral background instead of the established blue task-highlight surface, and an intermittent OPFS access-handle conflict can reject a task-planning transaction before it begins.

## Goals / Non-Goals

**Goals:**

- Keep the active field and selection stable during Area cycling.
- Defer all open-task rebucketing and reordering until close.
- Give focused editors exclusive ownership of undo/redo.
- Close nested surfaces before closing the task.
- Fade and disable the floating creation action while adding or editing a task.
- Use one continuous, subdued blue highlight behind open, keyboard-focused, and selected task rows.
- Recover task-planning commands from the recognized transient OPFS access-handle conflict without hiding unrelated or persistent failures.

**Non-Goals:**

- Introduce a second manual ordering system.
- Change task-history persistence or database history schemas.
- Make plain Escape submit or discard field edits.
- Retry arbitrary repository mutations or upgrade the PowerSync major version as part of this focused repair.

## Decisions

1. Area cycling captures the active element and text selection, applies the mutation, then restores them if the same editor remains mounted.
2. Open-task list derivation continues to use the retained projection for Area and invisible sort attributes until close.
3. Global task undo/redo ignores editable targets. Notes uses its explicit editor history; ordinary controlled inputs use native browser field history and continue persisting resulting values to task history.
4. Escape first delegates to any open picker, popover, menu, dialog, or checklist selection surface. Only when no deeper surface owns Escape does the shell close the task and restore whole-row focus.
5. The floating creation button remains mounted so opacity can transition smoothly, but an open new-task or existing-task drawer disables it, removes it from assistive and keyboard interaction, and applies the hidden opacity state. Closing the drawer reverses those states.
6. The existing `info` highlight hue supplies open, keyboard-focused, and selected task rows at the same subdued opacity so muted controls remain legible in every highlighted state. The summary row and metadata drawer inherit that container background so the open task reads as one continuous surface and remains distinct beneath the floating mobile navigation.
7. Single-task and bulk task-planning transactions use a shared bounded retry wrapper. The wrapper retries only an error chain containing both the browser `createSyncAccessHandle` operation and its conflicting open-handle message, waits briefly between attempts, and reruns the entire transaction callback so no partial mutation is reused. Any other error, or the recognized error after the retry schedule is exhausted, is rethrown unchanged.

## Risks / Trade-offs

- **Risk: Restoring focus after mutation can fight an intentional focus move.** Only restore when the captured element is still connected and focus has not intentionally moved to another interactive element.
- **Risk: Native input history and persisted task history can diverge in timing.** Editable-target commands never invoke global history, preventing a double undo; subsequent global undo operates on persisted changes only.
- **Risk: Escape ordering can close two layers at once.** Nested ownership is checked before the task-close branch and covered by regression tests.
- **Risk: A visually hidden creation button can remain interactive.** The open-editor state also disables the button and removes it from the accessibility tree.
- **Risk: The blue surface can reduce contrast around nested fields.** Retain the existing field backgrounds, borders, and focus rings while changing only the shared task container surface.
- **Risk: Retrying a write can duplicate work.** PowerSync rejects this OPFS conflict before the transaction callback begins; each attempt nevertheless reruns the complete atomic callback rather than retrying individual SQL statements.
- **Risk: Broad retry matching can conceal a real storage failure.** Match the specific browser operation and conflict phrase, limit attempts, and immediately rethrow all other failures.

## Migration Plan

No migration is required. Rollback restores the previous shortcut interception and Escape behavior.

## Open Questions

None.

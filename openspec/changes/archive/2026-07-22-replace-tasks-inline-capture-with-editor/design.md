## Context

Tasks currently exposes a persistent one-line capture form on Today, Anytime, and Someday. It creates a persisted task only after a nonblank title is submitted, then leaves creation and full editing as separate interactions. The task table and repository correctly require a nonblank title, while the requested interaction begins with a visually blank task.

The existing shell already owns expanded-editor disclosure, ordered autosave, retained projections while editing, deferred completion, view derivation, command capture, and task-reminder operations. The change should reuse those paths rather than introduce a second form component or relax the database invariant.

## Goals / Non-Goals

**Goals:**

- Use the complete existing task editor for new work.
- Show a blank draft at the top of the active planning list without persisting an invalid blank title.
- Preserve draft metadata set before the title and persist it atomically with the first valid title.
- Keep an accepted new task at its temporary top position until close, then derive its normal view membership and ordering.
- Make closing and completion keyboard commands work from focused editor controls.

**Non-Goals:**

- Allow blank task titles in the database or repository.
- Change Supabase schema, RLS, PowerSync, reminders, MCP, Raycast, or capture integrations.
- Replace inline hierarchy capture within Areas, Projects, or checklist editors.
- Add a visible Save or Cancel action.

## Decisions

1. **Represent an untitled new task as a shell-owned local draft.**
   - The draft has a temporary client identifier and the same editable fields as `TaskTodo`.
   - It is rendered through the existing `TaskRow` and `TaskEditor`, so presentation, focus, keyboard field commands, and autosave behavior remain shared.
   - Alternative considered: persist a placeholder title. Rejected because it would leak synthetic tasks into synchronization, history, automation, and search.

2. **Persist on the first autosave batch containing a nonblank title.**
   - Metadata accepted before the title remains in the draft.
   - The first valid title creates one ordinary task with the complete current draft state and a top-of-scope order key.
   - Later editor writes use the ordinary update path and history.
   - Closing an untitled draft discards it because no valid task exists to save.

3. **Freeze the newly created row until the editor closes.**
   - While the draft editor remains open, the persisted row is suppressed from the derived list to avoid a duplicate and the draft stays first.
   - On close, the draft projection is removed and the persisted task reappears through normal view derivation and sorting.
   - If the accepted task no longer belongs to the active view, Tasks shows one neutral toast explaining that it was saved outside the current list.

4. **Derive defaults from the active planning view.**
   - Today creates canonical Anytime + Today Now with no literal same-day Start Date because Start Date remains future-only.
   - Someday creates Someday with no date or horizon.
   - Anytime creates undated Anytime work without a Today horizon.
   - Upcoming begins as undated Anytime work, stays visible only through the draft projection, and must receive a qualifying future Start Date or deadline to remain in Upcoming after close.
   - Non-list routes navigate to Today before opening a Today Now draft.

5. **Give editor-closing commands explicit capture-phase precedence.**
   - Command+Return and Escape close the open editor even when an input, select, or notes surface is focused, except when a nested dialog or popover owns Escape.
   - Control+X retains its existing close-and-blur behavior.
   - Command+K uses the same deferred completion toggle as Control+D for an open task. When a nonempty bulk selection owns the command, it completes those closed selected tasks through the existing bulk lifecycle behavior.

## Risks / Trade-offs

- **A draft can exist locally without synchronization until it has a title** → Closing an untitled draft discards it explicitly, and no placeholder record enters shared state.
- **Creation and immediate metadata changes can race** → Route every draft mutation through the editor's existing serialized operation queue and create from the accumulated draft snapshot.
- **The persisted task may momentarily exist both in the hook and draft projection** → Suppress its real identifier from rendered list tasks until draft closure.
- **Escape is also used by nested controls and bulk selection** → Let open dialogs and portaled controls consume Escape first, then close an editor, then fall back to canceling bulk selection.
- **Upcoming has no valid blank default** → Keep the draft visible while open and explain invisibility with a toast if the user closes it without qualifying scheduling metadata.

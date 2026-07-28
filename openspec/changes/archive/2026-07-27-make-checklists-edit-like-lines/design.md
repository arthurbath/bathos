## Context

Checklist items are persisted as nonblank child records with independent order keys, while the expanded task drawer already permits a local empty draft row and removes empty persisted rows when it closes. The interaction must therefore expose textarea-like editing without weakening the database's nonblank-title invariant.

## Goals / Non-Goals

**Goals:**

- Make adjacent checklist inputs behave like adjacent lines for Return, boundary Backspace, and boundary forward Delete.
- Preserve expected focus and caret positions after every split or join.
- Let an empty local row carry the same drag handle and insertion position as a persisted row.
- Keep pointer-only drag handles outside sequential keyboard navigation.
- Reuse the existing shared input with local compact classes.

**Non-Goals:**

- Selecting text across multiple checklist inputs.
- Adding keyboard-based checklist reordering.
- Persisting blank checklist records or changing the Supabase schema.
- Introducing a new shared input size variant.

## Decisions

### Represent the empty row as a positioned local draft

The editor will retain a single local blank draft with an explicit insertion index. This keeps blank data out of the database while allowing the row to render at, and be dragged to, any checklist position. Once the row receives nonblank text, it is persisted and assigned the order corresponding to that insertion index.

Creating multiple simultaneous blank rows is intentionally avoided because the database rejects blank titles and a single active insertion line matches the immediate keyboard-entry workflow.

### Perform row splits and joins through parent-owned operations

The parent editor owns item order, input references, draft placement, and repository mutations. Row components report Return plus caret-aware Backspace and Delete intents upward. Return saves the current row and positions one blank draft immediately below it. The parent can then update, create, reorder, or delete the affected records and restore focus after the optimistic item collection changes.

### Keep Command+A and normal in-field editing native

The editor handles only unmodified Return and deletion keys at line boundaries. It does not intercept Command+A or ordinary Backspace/Delete within a string, so selection remains scoped to the active input and text editing remains browser-native.

### Reuse the shared Input component with local dimensions

Checklist inputs will apply existing Tailwind height and padding utilities directly. This avoids creating a global size API for a single specialized editor.

## Risks / Trade-offs

- [Asynchronous mutations could briefly race focus restoration] → Store the requested item and caret target and focus only after the matching optimistic row is rendered.
- [A stale debounced save could overwrite a joined value] → Cancel the active row's save timer before emitting a split or join and rely on unmount cleanup for a deleted neighbor.
- [A local blank row cannot participate in repository history until it has content] → Treat its movement as ephemeral and record history only when it becomes a persisted item, consistent with close-time empty-row cleanup.
- [Native drag behavior for a local draft differs from persisted items] → Use the same drag handle and drop targets, but update only the local insertion index until persistence.

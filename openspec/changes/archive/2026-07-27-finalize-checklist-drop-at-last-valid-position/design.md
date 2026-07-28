## Context

`TaskChecklistEditor` uses native HTML drag events and stores the active item identifiers plus the most recently hovered checklist insertion index. Checklist-owned drop targets call the reorder operation directly, but a drop elsewhere in the document has no accepting target and therefore only reaches drag-end cleanup. Tasks already solves the analogous problem with a broad native drop surface that commits its retained drop indicator.

## Goals / Non-Goals

**Goals:**

- Let a valid checklist insertion indicator remain authoritative while the pointer is elsewhere in BathOS.
- Finalize single-item, grouped, and empty-draft checklist movement when the native drop occurs outside the checklist but inside the document.
- Keep local drops and document-wide drops idempotent.

**Non-Goals:**

- Do not build a custom pointer, scrolling, or drag-preview system.
- Do not make drops outside the browser window commit.
- Do not change checklist persistence, ordering keys, selection, or undo semantics.

## Decisions

- Register document-level native `dragover` and `drop` listeners only while checklist dragging has both active item identifiers and a valid retained insertion index. This parallels the Tasks module-wide surface while covering headers, navigation, and other BathOS content outside the checklist subtree.
- Ignore document-level finalization when the event target is inside the checklist. Existing checklist-owned drop handlers remain responsible there, preventing duplicate reorder writes.
- Extract one checklist-drop commit function shared by local and document-wide handlers. A synchronous commit guard prevents native event propagation or delayed state updates from applying the same drop twice.
- Keep drag-end as cleanup only. If no accepted document drop occurs, including a release outside the browser, the drag cancels as it does today.

## Risks / Trade-offs

- [Risk] A document listener could accept unrelated drags while the checklist state is stale. → Mitigation: install it only during an active checklist drag with a valid retained position, verify the event is outside the checklist, and clear all drag state after commit or drag-end.
- [Risk] A local drop could bubble and trigger a second reorder. → Mitigation: exclude checklist-contained targets and guard commits synchronously.
- [Trade-off] Dropping elsewhere in BathOS prevents the browser’s default handling for that drop. This is intentional only during an active checklist reorder with a visible valid destination.

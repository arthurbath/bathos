## Context

The line-aware Notes editor rebuilds its decorated DOM whenever the caret or selection crosses into different lines. Selection capture currently stores only the normalized start and end of the browser range, so restoration always creates a forward selection. A pointer drag that began at a later source offset and moves upward loses its original anchor when that rebuild occurs.

## Goals / Non-Goals

**Goals:**

- Preserve exact source offsets and selection direction through Markdown redecoration.
- Keep both forward and backward pointer selection native and continuous.
- Retain the existing caret-line source and inactive-line semantic presentations.

**Non-Goals:**

- Replacing the contenteditable Notes control.
- Adding custom pointer selection behavior.
- Changing supported Markdown syntax, persistence, or link behavior.

## Decisions

- Extend the captured selection state with its direction, derived from the source offsets of the browser selection's anchor and focus.
- Keep normalized start and end offsets for text mutation operations, which already require ascending boundaries.
- Restore a backward selection with the browser Selection API's anchor and focus semantics rather than rebuilding only a normalized Range.
- Add a component regression test that starts with a later anchor and earlier focus, triggers line-aware redecoration, and proves both endpoints remain in their original roles.

## Risks / Trade-offs

- **Risk:** Browser Selection APIs differ slightly across engines.
  **Mitigation:** Use `setBaseAndExtent` where available and retain a Range fallback for forward selections.

- **Risk:** Selection restoration could affect collapsed carets or editing mutations.
  **Mitigation:** Treat collapsed selections as forward and retain normalized offsets used by every existing mutation path.

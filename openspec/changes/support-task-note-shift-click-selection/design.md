## Context

`TaskMarkdownNotes` renders a `contenteditable` surface whose DOM alternates per line between semantic Markdown presentation and exact source presentation. It already converts DOM selection endpoints into plain-text source offsets, defers redecoration during pointer drags, and restores range direction after redecoration. Ordinary drag selection therefore works, but the current implementation delegates Shift-click range extension to the embedded browser. In the rendered app that default behavior collapses the caret at the clicked point.

## Goals / Non-Goals

**Goals:**

- Make Shift-click extend the existing task-note selection anchor to the clicked source position.
- Preserve forward and backward direction through Markdown line redecoration.
- Prevent a Shift-click used for selection from also activating a rendered link.
- Keep ordinary click, drag selection, keyboard selection, and link activation unchanged.

**Non-Goals:**

- Replacing the contenteditable editor or its Markdown tokenization.
- Adding new Markdown syntax.
- Changing task-row bulk-selection gestures outside the Notes editor.

## Decisions

### Resolve the clicked caret position explicitly

On a primary-button Shift-mousedown, the editor will capture the current logical selection anchor and resolve the pointer coordinates to a DOM caret endpoint using the browser caret-position API with the WebKit caret-range API as fallback. It will convert both endpoints through the existing source-offset mapping and restore a source range with the existing direction-aware selection helper.

This keeps the selection contract independent of inconsistent native Shift-click handling while reusing the editor's established mapping. Depending only on the browser default was rejected because it reproduces the current failure. Replacing the editor with a textarea was rejected because it would remove the line-aware Markdown presentation.

### Redecorate only after the pointer gesture finishes

The existing pointer-selection guard will remain active through mouseup. The explicit range is established during mousedown, then the existing mouseup synchronization reveals every crossed source line and restores the exact range. This avoids replacing nodes while the pointer event is still resolving.

### Treat Shift-click as selection, never link activation

When a Shift-click targets a decorated link, the editor will consume link activation after using the click position as the moving selection edge. An ordinary click will continue to open the safe destination according to the existing link rules.

## Risks / Trade-offs

- **Risk: Browser caret APIs differ between Chromium and WebKit.** -> Use the standardized caret-position API when available and WebKit's caret-range API as a focused fallback; otherwise leave the browser's native behavior untouched.
- **Risk: Hidden Markdown delimiters affect visual-to-source mapping.** -> Resolve a DOM endpoint first, then pass it through the editor's existing exact source-offset conversion, which already accounts for hidden delimiters.
- **Risk: Pointer selection could accidentally open a link.** -> Explicitly suppress link activation for Shift-click while preserving ordinary click behavior.

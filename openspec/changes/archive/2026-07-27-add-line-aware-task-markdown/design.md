## Context

The task Notes control is a single `contenteditable` surface whose DOM is regenerated from exact plain-text Markdown after each supported edit. Source-offset capture and restoration currently work because the DOM's text content exactly matches the stored source. The requested semantic presentation collapses some visible syntax, so a naive replacement with rendered HTML would break caret mapping and risk saving presentation text instead of source.

## Goals / Non-Goals

**Goals:**

- Reveal complete live-styled Markdown source on the caret line and on every line crossed by an active selection.
- Semantically present inactive lines without changing the persisted plain-text source or introducing a separate preview surface.
- Preserve editing, selection, composition, paste, undo, redo, autosave, and safe link activation.
- Keep the implementation within the Tasks module and the existing supported Markdown subset.

**Non-Goals:**

- Adding Markdown constructs beyond headings, asterisk emphasis and bullets, double-asterisk strong text, Markdown links, safe bare destinations, and single-backtick inline code.
- Introducing a third-party Markdown editor, syntax tree dependency, or separate edit/preview mode.
- Changing task persistence, database schemas, or note-source normalization.

## Decisions

### Preserve source text in the DOM while changing only its visual presentation

Inactive-line delimiters and Markdown-link destinations will remain as text nodes but collapse visually. Asterisk bullet source will likewise remain in the DOM while a visual bullet is supplied by the delimiter span. This keeps DOM text offsets identical to persisted source offsets and lets the existing reader, history, and caret-restoration mechanics remain authoritative.

Replacing the editor with a textarea-plus-overlay or a full editor framework was rejected because it would duplicate controls, introduce synchronization and accessibility work, and add disproportionate complexity for the supported subset.

### Derive source-visible lines from the DOM selection

The editor will track which source lines contain the current selection endpoints. A collapsed caret reveals one line. A selection spanning lines reveals the complete contiguous range so every selected source character remains visible. Blur leaves no source-visible line. Selection changes will redecorate only when the active line set changes and will preserve absolute source offsets across that redecoration.

### Give inactive and active links distinct pointer behavior

A safe link on an inactive semantic line will keep its destination and ordinary browser-context behavior, while a source-visible line will treat the same markup as editable content and suppress navigation. Pointer-down on an inactive link will not move the caret first, preventing the line from switching to source presentation before its link action is resolved.

### Keep preview output semantic

The non-editable preview helper will use the same inactive-line rendering so its output matches the readable state of the live editor, even though the current Tasks UI only mounts the live editor.

## Risks / Trade-offs

- [Browser selection events vary around `contenteditable`] -> Observe document selection changes while focus remains in the editor, preserve source offsets before each redecoration, and cover click, keyboard, selection-range, and blur transitions with focused tests.
- [Visually collapsed source may still be announced by assistive technology] -> Keep the editor's accessible value as the exact editable source; links retain meaningful accessible names in semantic presentation. This favors source fidelity in an editing control.
- [Clicking a semantic link and clicking its line imply different intentions] -> Link-label clicks follow the link, while clicks elsewhere on the line activate raw source editing.
- [A malformed or unsupported construct could be partially styled] -> Retain the existing tokenizer and safe-scheme policy unchanged.

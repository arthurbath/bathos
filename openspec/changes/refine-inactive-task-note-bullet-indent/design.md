## Context

`TaskMarkdownNotes` uses one contenteditable surface whose lines switch independently between raw-source and semantic presentations. Bullet lines currently share one `2ch` hanging-indent class in both presentations. That value correctly matches the fixed-width `* ` source marker but is wider than the proportional `• ` marker rendered on inactive lines.

## Goals / Non-Goals

**Goals:**

- Align wrapped source-line continuations after the visible fixed-width `* ` marker.
- Align wrapped semantic-line continuations after the narrower proportional `• ` marker.
- Apply the same presentation-specific layout to the editable surface and the semantic preview renderer.
- Preserve note source, caret behavior, line activation, and supported Markdown syntax.

**Non-Goals:**

- Change the rendered bullet glyph, font, note line height, editor width, or Markdown recognition.
- Change persisted notes or introduce list nesting.
- Alter indentation for headings, plain lines, or checklist items.

## Decisions

### Select the hanging indent from the line presentation

The line-class helper will accept the existing `source` or `semantic` presentation. Source bullets retain the established `2ch` padding and negative text indent. Semantic bullets use a `0.75em` padding and negative text indent. At the editor's current typography this follows the measured natural bullet-plus-space footprint rather than the two-character monospace source.

Using presentation-specific classes keeps the editable source string and marker rendering unchanged. Replacing the line with a list element was rejected because the component must retain exact source offsets and line-aware selection inside one contenteditable surface.

### Keep preview and live-editor layout on one helper

Both the React preview renderer and the imperative live-editor decorator will call the same presentation-aware line-class helper. This prevents preview-only and editor-inactive bullet geometry from drifting.

## Risks / Trade-offs

- [Font metrics vary slightly across platforms] → Use the font-relative `em` unit that follows the proportional semantic marker rather than a fixed pixel value.
- [Changing classes during line activation could shift wrapping] → Limit the shift to the marker-width difference the user explicitly expects and preserve source offsets through the existing decoration and selection-restoration path.
- [The regression could return in only one renderer] → Assert the semantic and source classes in both preview and live-editor focused tests.

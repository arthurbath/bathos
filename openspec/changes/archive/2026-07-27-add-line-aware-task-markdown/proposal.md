## Why

Task notes currently keep all supported Markdown source visible at all times, which makes labeled links and other formatted content harder to scan than necessary. The live editor should preserve direct source editing while presenting every line outside the caret as readable, interactive Markdown.

## What Changes

- Keep the caret's current line, and every line crossed by an active text selection, in the existing fully visible live-styled source presentation.
- Present all other note lines semantically by hiding supported Markdown delimiters, replacing asterisk list markers with visible bullets, and reducing labeled links to their linked labels.
- Make semantically presented labeled links and bare destinations actionable while keeping links on source-visible lines editable instead of navigating.
- Preserve exact plain-text Markdown source, caret placement, selection, autosave, paste, local undo and redo, IME composition, and the existing supported Markdown subset as lines move between source-visible and semantic presentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Change task notes from always-visible Markdown source to a line-aware live editor that reveals source on the active line and semantically presents inactive lines.

## Impact

- Tasks module only.
- Updates `TaskMarkdownNotes`, its focused tests, and the durable personal Tasks specification.
- No database, Supabase, PowerSync, MCP, API, dependency, or persisted-data changes.

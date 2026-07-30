## Why

Task Notes currently recognize only `* ` as a Markdown bullet marker. Supporting the equally conventional `- ` marker lets imported and directly authored notes use either form while preserving the established source-aware editing and semantic preview behavior.

## What Changes

- Recognize a hyphen followed by a space at the beginning of a task-note line as a bullet marker.
- Present `- ` as two muted fixed-width Markdown indicator characters while its line exposes source.
- Present inactive hyphen and asterisk bullets with the same proportional bullet glyph and hanging indentation.
- Continue a hyphen bullet with `- ` when the user presses Return on that line.
- Preserve the exact authored marker in stored Notes source.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Expand readable Markdown Task Notes to treat both `* ` and `- ` as equivalent bullet markers.

## Impact

- Tasks module only.
- Updates the task Markdown notes parser, live editor behavior, semantic preview, focused tests, and personal Tasks behavior contract.
- No database, persisted-data rewrite, API, dependency, native companion, or other BathOS module changes.

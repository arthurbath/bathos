## Why

Task Notes currently retain the raw Markdown bullet's two-fixed-character hanging indent even when an inactive line replaces `* ` with a compact proportional bullet. Wrapped preview text therefore starts too far to the right and no longer aligns with the visible content.

## What Changes

- Preserve the existing two-character hanging indent while a bullet line exposes its raw Markdown source for editing.
- Use a narrower hanging indent when the same bullet line is presented as rich text outside the active caret or selection line.
- Cover both presentations with focused component and rendered wrapping checks.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Make inactive rich-text bullets align wrapped continuations to the visible proportional bullet marker while retaining raw-source alignment on active lines.

## Impact

The change is limited to the Tasks Markdown notes component, its focused tests, and the corresponding personal Tasks behavior contract. It changes no persisted note content, supported Markdown syntax, shared input behavior, database object, dependency, or other BathOS module.

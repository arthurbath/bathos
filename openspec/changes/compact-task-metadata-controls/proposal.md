## Why

The Tasks metadata editor reserves more vertical space than its ordinary content requires. A two-line Notes minimum and context-aware disclosure actions will keep new and edit views compact without making Notes look like a single-line field or weakening access to Primary Link and Checklist.

## What Changes

- Reduce the minimum visible Notes height from four text lines to two while retaining multiline growth and rich Markdown editing.
- When both Primary Link and Checklist are absent, present their disclosure actions as equal half-width controls on one row with centered text and a subtle divider.
- When only one disclosure action remains, present it at automatic width on its own line with left-aligned text and no divider.
- Apply the same subtle divider between the existing Clear and Someday actions in the Start picker.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Compact the open task editor's Notes minimum height and adapt the absent Primary Link and Checklist disclosure layout while preserving control order and behavior.

## Impact

- Tasks module metadata editor layout and shared new/edit task form rendering.
- Tasks Start picker footer presentation.
- Focused Tasks component tests and rendered desktop/mobile validation.
- No database, Supabase, PowerSync, native companion, or public API changes.

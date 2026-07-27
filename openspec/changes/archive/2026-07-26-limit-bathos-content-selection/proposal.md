## Why

BathOS currently inherits the browser convention that most rendered text and page elements can be highlighted or dragged even when they are application chrome rather than documents. A deliberate selection policy will make the interface feel more like a native application while preserving familiar editing, copying, accessibility, and intentional drag-and-drop behavior.

## What Changes

- Make ordinary BathOS interface structure, labels, headings, controls, static values, and read-only user content nonselectable by default.
- Preserve text selection inside inputs, textareas, contenteditable editors, and DataGrid cells while those cells are actively being edited.
- Keep legal documents deliberately selectable.
- Disable browser-native dragging of links, images, and other non-draggable presentation elements while preserving BathOS features that explicitly implement drag-and-drop.
- Document the opt-in convention for future selectable documents and intentional draggable surfaces.

## Capabilities

### New Capabilities

- `content-selection`: Defines BathOS-wide text-selection, native element-dragging, editing, legal-document, and intentional drag-and-drop behavior.

### Modified Capabilities

None.

## Impact

- Shared global styling in `src/index.css`
- Shared DataGrid editing and display surfaces
- Legal-document presentation
- Explicit BathOS drag-and-drop surfaces, including Tasks and DataGrid resizing
- Shared human-facing design guidance and focused interaction tests
- No database, Supabase, PowerSync, API, or dependency changes

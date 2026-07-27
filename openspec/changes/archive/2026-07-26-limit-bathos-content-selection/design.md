## Context

BathOS currently relies on browser defaults for selecting rendered content. Some individual controls already use `select-none`, but most headings, labels, static values, cards, rows, and user-authored display content can still be highlighted by dragging or Select All. Native browser dragging also remains available for links and images even when BathOS does not treat those elements as draggable.

The policy crosses every module and must therefore live in shared styling rather than being reimplemented module by module. It must preserve native form editing, the Tasks notes editor, DataGrid edit mode, legal-document selection, accessibility, link activation, and BathOS-owned drag interactions.

## Goals / Non-Goals

**Goals:**

- Make ordinary BathOS application content nonselectable by default.
- Preserve familiar selection within active text-editing controls.
- Keep legal documents selectable.
- Keep static DataGrid cells nonselectable and editable cell contents selectable while editing.
- Suppress native browser link and image dragging without affecting explicitly draggable BathOS surfaces.
- Establish a small opt-in convention for future selectable documents.

**Non-Goals:**

- Prevent users from accessing content for security or anti-copy purposes.
- Intercept browser Find, clipboard commands, accessibility navigation, keyboard focus, link activation, or modified-click behavior.
- Build custom copy controls for every static value.
- Redesign DataGrid editing, Tasks selection, or any module-specific drag-and-drop workflow.

## Decisions

### Apply nonselection from the BathOS application root

The application root will use `user-select: none`, including the WebKit-prefixed form required by Safari. This creates one predictable default for every current and future module. Applying scattered `select-none` classes was rejected because it would be incomplete and would drift as new UI is added.

### Restore selection only on intentional text surfaces

Inputs, textareas, and active contenteditable elements will explicitly use text selection. A shared `data-bathos-text-selection="allow"` attribute will opt document-like read-only surfaces back into selection. The legal-document renderer will use that attribute.

Static DataGrid cells will inherit the nonselectable default. Their editor controls already render as inputs, textareas, or equivalent editable surfaces, so selection returns naturally only during editing.

### Suppress only native presentation dragging

Links and images will use `-webkit-user-drag: none` unless a future surface explicitly opts into native dragging with `data-bathos-native-drag="allow"`. BathOS-owned draggable containers, Tasks task rows, file drop targets, and DataGrid resizing are not link/image native dragging and remain unaffected.

### Keep behavior presentational

The policy will be expressed in shared CSS and semantic opt-in attributes. BathOS will not add global keyboard or clipboard interception for this change. Screen readers, keyboard focus, browser Find, form selection, and custom application commands therefore retain their existing behavior.

## Risks / Trade-offs

- [Users cannot drag-select a static value they want to copy] → Editing surfaces remain selectable, legal documents opt in, and future product requirements can add a deliberate selectable surface or copy affordance.
- [A future document-like view unintentionally inherits nonselection] → Document the shared opt-in attribute in the human style guide and cover the legal renderer with a focused test.
- [Browser-native drag suppression differs outside WebKit/Blink] → Treat this as a lightweight presentational policy, as requested, while preserving all BathOS-owned drag implementations.
- [Global CSS could accidentally suppress editor selection] → Explicitly restore standard and WebKit text selection on inputs, textareas, and active contenteditable elements and verify representative editors in tests and the browser.

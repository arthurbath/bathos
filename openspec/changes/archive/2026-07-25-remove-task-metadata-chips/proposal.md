## Why

Chip backgrounds and padding make the dense second metadata line feel busier and more segmented than the task summary requires. The metadata is already understandable through order, icons, color, and spacing, so it can remain visually flat.

## What Changes

- Remove background fills, borders, corner radii, and chip-specific padding from every item in the task summary metadata line.
- Preserve metadata order, labels, icons, semantic colors, responsive abbreviations, spacing between items, and assistive names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Replace mobile metadata chip presentation with flat inline metadata.

## Impact

- Tasks module task-row presentation and integrated tests.
- Durable Tasks list-density specification.
- No data, API, routing, dependency, or persistence changes.

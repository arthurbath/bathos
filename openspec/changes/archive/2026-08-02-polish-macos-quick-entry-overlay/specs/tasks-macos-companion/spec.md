## ADDED Requirements

### Requirement: Global Quick Entry retains drafts for interior clicks
The macOS Global Quick Entry panel SHALL treat its complete visible content area as an interior surface and SHALL cancel a draft only through an explicit cancellation command or an actual panel-dismissal action.

#### Scenario: Click unused space inside Quick Entry
- **WHEN** the user clicks the background inside the visible Quick Entry panel outside an editor control
- **THEN** the panel remains open, the draft remains intact, and the click may only remove focus from the previously focused control

#### Scenario: Dismiss a nested Quick Entry popover
- **WHEN** the user clicks elsewhere inside Quick Entry while an editor-owned picker or menu is open
- **THEN** the nested surface may close while the Quick Entry panel and draft remain open

## MODIFIED Requirements

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL present Global Quick Entry in a balanced, rounded panel large enough for the compact Start picker and control focus outlines, SHALL visually distinguish its boundary with a one-pixel lighter dark-gray border and restrained native shadow, SHALL show one uninterrupted native progress presentation until meaningful web content is ready, and SHALL not flash intermediate web loading states.

#### Scenario: Open global quick entry from a cold state
- **WHEN** the global quick-entry shortcut is invoked before the hosted Tasks document is ready
- **THEN** a compact centered rounded panel appears immediately with one centered native spinner and replaces that loading presentation once with the ready editor without clipping internal focus outlines

#### Scenario: Open global quick entry from a warm state
- **WHEN** the global quick-entry shortcut is invoked after a healthy Quick Entry web document has already loaded
- **THEN** Tasks reuses that document, begins a fresh draft through same-document routing, and does not repeat the cold-load spinner sequence

#### Scenario: Preserve balanced panel padding
- **WHEN** the ready Quick Entry editor is visible
- **THEN** the established vertical padding remains intact and the left and right padding provide enough space that editor and focus outlines do not feel crowded or touch the panel boundary

#### Scenario: Open the Start picker
- **WHEN** the user opens the compact Start picker inside Quick Entry
- **THEN** the picker fits within the panel's balanced content padding without forcing the panel to grow or clipping the picker

#### Scenario: Load an older web client without readiness signaling
- **WHEN** native Quick Entry finishes navigation but the hosted deployed web client cannot send the current readiness message
- **THEN** the companion reveals the web surface after a bounded compatibility delay instead of remaining on an indefinite spinner

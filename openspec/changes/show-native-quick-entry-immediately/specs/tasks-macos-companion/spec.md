## MODIFIED Requirements

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL synchronously present Global Quick Entry after every shortcut invocation in a balanced, rounded, movable panel large enough for the compact Start picker and control focus outlines, SHALL visually distinguish its boundary with a one-pixel lighter dark-gray border and restrained native shadow, SHALL show one uninterrupted native progress presentation until the current quick-entry editor is ready, and SHALL not flash intermediate or stale web states.

#### Scenario: Open global quick entry from a cold state
- **WHEN** the global quick-entry shortcut is invoked before the hosted Tasks document is ready
- **THEN** a compact centered rounded panel appears during the shortcut handler's main-thread turn with one centered native spinner and replaces that loading presentation once with the ready editor without exposing the web loader or clipping internal focus outlines

#### Scenario: Open global quick entry from a warm state
- **WHEN** the global quick-entry shortcut is invoked after a healthy Quick Entry web document has already loaded
- **THEN** the native panel appears during the shortcut handler's main-thread turn, Tasks reuses the healthy document, begins a fresh draft through same-document routing, keeps the prior document state hidden behind the native loading presentation, and reveals the complete fresh editor without content flicker

#### Scenario: Preserve balanced panel padding
- **WHEN** the ready Quick Entry editor is visible
- **THEN** the established vertical padding remains intact and the wider left and right padding provide enough space that editor and focus outlines do not feel crowded or touch the panel boundary

#### Scenario: Move the panel
- **WHEN** the user presses and drags the dedicated noninteractive top region of Quick Entry
- **THEN** the drag begins with that pointer event and the complete native panel tracks the pointer while web controls retain their ordinary click and drag behavior

#### Scenario: Open the Start picker
- **WHEN** the user opens the compact Start picker inside Quick Entry
- **THEN** the picker fits within the panel's balanced content padding without forcing the panel to grow or clipping the picker

#### Scenario: Load an older web client without readiness signaling
- **WHEN** native Quick Entry finishes navigation but the hosted deployed web client cannot send the current quick-entry readiness message
- **THEN** the companion keeps the already-visible native loading panel onscreen and reveals the web surface after a bounded compatibility delay instead of remaining on an indefinite spinner

## MODIFIED Requirements

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL present Global Quick Entry in a balanced, rounded, movable panel large enough for the compact Start picker and control focus outlines, SHALL visually distinguish its boundary with a one-pixel lighter dark-gray border and restrained native shadow, SHALL show one uninterrupted native progress presentation until the current quick-entry editor is ready, and SHALL not flash intermediate or stale web states.

#### Scenario: Open global quick entry from a cold state
- **WHEN** the global quick-entry shortcut is invoked before the hosted Tasks document is ready
- **THEN** a compact centered rounded panel appears immediately with one centered native spinner and replaces that loading presentation once with the ready editor without exposing the web loader or clipping internal focus outlines

#### Scenario: Open global quick entry from a warm state
- **WHEN** the global quick-entry shortcut is invoked after a healthy Quick Entry web document has already loaded
- **THEN** Tasks reuses that document, begins a fresh draft through same-document routing, keeps the prior document state hidden, and reveals the complete fresh editor without content flicker

#### Scenario: Preserve balanced panel padding
- **WHEN** the ready Quick Entry editor is visible
- **THEN** the established vertical padding remains intact and the wider left and right padding provide enough space that editor and focus outlines do not feel crowded or touch the panel boundary

#### Scenario: Move the panel
- **WHEN** the user drags the noninteractive background or top region of Quick Entry
- **THEN** the complete native panel moves with the pointer while web controls retain their ordinary click and drag behavior

#### Scenario: Open the Start picker
- **WHEN** the user opens the compact Start picker inside Quick Entry
- **THEN** the picker fits within the panel's balanced content padding without forcing the panel to grow or clipping the picker

#### Scenario: Load an older web client without readiness signaling
- **WHEN** native Quick Entry finishes navigation but the hosted deployed web client cannot send the current quick-entry readiness message
- **THEN** the companion reveals the web surface after a bounded compatibility delay instead of remaining on an indefinite spinner

### Requirement: Global quick entry commits explicitly and cancels cleanly
The macOS Tasks companion SHALL provide a filled primary Save action and an always-available outlined Cancel action, SHALL treat Save, Return, and Command+Return as positive quick-entry submission, and SHALL treat Escape, Cancel, panel dismissal, or a second global-shortcut invocation as cancellation in every loading, ready, failed, and closing state.

#### Scenario: Save quick entry
- **WHEN** the user activates Save or a supported submit key with a valid Summary
- **THEN** Tasks commits the task, reports committed completion to the native shell, and closes the complete panel without fading its inner content separately

#### Scenario: Toggle quick entry closed
- **WHEN** the global quick-entry shortcut is invoked while its panel is open or preparing to open
- **THEN** Tasks immediately hides the complete panel, cancels the draft, and discards or recoverably deletes any task created for that draft

#### Scenario: Cancel ready quick entry
- **WHEN** the user activates Cancel or presses Escape while the ready editor is visible
- **THEN** Tasks immediately hides the complete panel, performs draft cancellation, and does not retain a committed task

#### Scenario: Cancel loading or failed quick entry
- **WHEN** the user presses Escape while the overlay is loading or showing a load failure
- **THEN** the native companion closes the complete panel without depending on a responsive web document

#### Scenario: Keep Cancel available
- **WHEN** the ready editor is visible with an empty, valid, invalid, pending, or partially completed draft
- **THEN** Cancel remains enabled while Save reflects the ordinary task validity and pending-operation rules

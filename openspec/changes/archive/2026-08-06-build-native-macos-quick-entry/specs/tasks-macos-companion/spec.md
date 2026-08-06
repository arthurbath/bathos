## MODIFIED Requirements

### Requirement: Configurable Global macOS Quick Entry
The macOS companion SHALL let the user record one global keyboard shortcut and SHALL use it to present the authoritative native Tasks new-task editor from any active macOS application.

#### Scenario: Configure the shortcut
- **WHEN** Tasks runs in the native macOS companion and the user activates the Global Quick Entry shortcut recorder in Settings
- **THEN** the next supported modified keystroke becomes the persisted shortcut, replaces any prior registration, and is displayed using macOS shortcut notation

#### Scenario: Withhold the setting outside native macOS
- **WHEN** Tasks runs in an ordinary browser, a PWA, or the iOS companion
- **THEN** the Global Quick Entry Settings card is absent

#### Scenario: Invoke the shortcut globally
- **WHEN** the configured shortcut is pressed while any macOS application is active
- **THEN** Tasks synchronously presents a compact centered native overlay above the current Space without first requiring the main Tasks window to be active or waiting for a web document

#### Scenario: Reuse the authoritative task form contract
- **WHEN** the quick-entry overlay opens
- **THEN** it renders native Summary, Notes, Link, checklist, Start, Deadline, Area, Actionability, reminder, picker, validation, traversal, and Control-command behavior from the same versioned contract as the web new-task workflow

#### Scenario: Preserve overlay geometry during native hosting
- **WHEN** AppKit installs or reuses the SwiftUI editor
- **THEN** the quick-entry panel retains its declared content size instead of collapsing to the hosted view's initial intrinsic size

#### Scenario: Present only the quick-entry editor
- **WHEN** the global quick-entry overlay displays a new-task draft
- **THEN** Tasks shows the native metadata editor without the list summary row, completion control, ellipsis menu, or blue open-task background

#### Scenario: Keep temporal pickers inside the overlay
- **WHEN** the user opens Start or Deadline from global quick entry
- **THEN** Tasks presents a native picker within the overlay's usable bounds, preserves documented keyboard navigation and focus handoff, and does not clip it against the editor field position

#### Scenario: Edit content that exceeds the overlay
- **WHEN** Notes or checklist content becomes taller than the quick-entry overlay
- **THEN** the editor remains vertically scrollable and the user can create, edit, and reorder checklist items through the same semantic controls as the ordinary new-task form

#### Scenario: Submit quick entry
- **WHEN** the user commits a valid nonempty quick-entry draft
- **THEN** Tasks atomically creates exactly one complete task through the bounded authenticated native authority, closes the overlay, and refreshes the main Tasks surface and native widgets

#### Scenario: Cancel quick entry
- **WHEN** the user cancels the overlay or dismisses an empty or partial draft
- **THEN** the overlay closes without creating, changing, or recoverably deleting a task

#### Scenario: Preserve shortcut safety
- **WHEN** a shortcut is unsupported, reserved, incomplete, or cannot be registered
- **THEN** Tasks keeps the prior working registration, explains the failure without exposing raw native diagnostics, and logs bounded diagnostic detail

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL present Global Quick Entry in a balanced, rounded, movable panel large enough for its native controls and focus outlines, SHALL visually distinguish its boundary with a one-pixel lighter dark-gray border and restrained native shadow, and SHALL never expose web loading, stale web content, or a blank web failure state.

#### Scenario: Open global quick entry from a cold state
- **WHEN** the global quick-entry shortcut is invoked before any bootstrap refresh or main Tasks document is ready
- **THEN** a complete native editor appears immediately with an empty local draft and cached or default reference data while background authority refresh remains nonblocking

#### Scenario: Open global quick entry from a warm state
- **WHEN** the global quick-entry shortcut is invoked after a prior native capture
- **THEN** Tasks resets the local draft and presents the complete fresh editor without WebKit navigation, a loading spinner, stale content, or content flicker

#### Scenario: Preserve balanced panel padding
- **WHEN** the native Quick Entry editor is visible
- **THEN** balanced padding provides enough space that editor and focus outlines do not feel crowded or touch the panel boundary

#### Scenario: Move the panel
- **WHEN** the user drags the noninteractive background or top region of Quick Entry
- **THEN** the complete native panel moves with the pointer while form controls retain their ordinary click and drag behavior

#### Scenario: Open the Start picker
- **WHEN** the user opens the Start picker inside Quick Entry
- **THEN** the native picker remains usable within the panel's content bounds without forcing the panel to grow or clipping the picker

#### Scenario: Lack current native authority
- **WHEN** the native editor is open but no valid Quick Entry credential or compatible bootstrap is available
- **THEN** the draft remains fully editable and intact while Save offers a bounded retry or explains that Tasks must be signed in or refreshed

### Requirement: Global quick entry commits explicitly and cancels cleanly
The macOS Tasks companion SHALL provide a filled primary Save action and an always-available outlined Cancel action, SHALL treat Save and Command+Return as positive quick-entry submission, and SHALL treat Escape, Cancel, panel dismissal, or a second global-shortcut invocation as cancellation whenever no nested control owns Escape.

#### Scenario: Save quick entry
- **WHEN** the user activates Save or Command+Return with a valid Summary and valid field values
- **THEN** Tasks submits one idempotent native creation request, closes the complete panel after acceptance, and does not fade its inner content separately

#### Scenario: Preserve draft during an ambiguous save
- **WHEN** the native creation request fails or has an ambiguous outcome
- **THEN** Tasks keeps the complete draft visible, reuses its mutation identity on retry, and does not create a second task

#### Scenario: Toggle quick entry closed
- **WHEN** the global quick-entry shortcut is invoked while its panel is open
- **THEN** Tasks immediately hides the complete panel and discards the local draft without a server mutation

#### Scenario: Cancel ready quick entry
- **WHEN** the user activates Cancel or presses Escape while no nested picker owns Escape
- **THEN** Tasks immediately hides the complete panel, discards the local draft, and does not retain a committed task

#### Scenario: Dismiss a nested editor surface
- **WHEN** the user presses Escape while a native date picker, selection menu, or reminder menu is open
- **THEN** Tasks closes only that nested surface and preserves the panel and draft

#### Scenario: Keep Cancel available
- **WHEN** the editor is visible with an empty, valid, invalid, pending, or partially completed draft
- **THEN** Cancel remains enabled while Save reflects the shared task validity and pending-operation rules

## ADDED Requirements

### Requirement: Native Quick Entry uses bounded owner authority
The macOS companion SHALL use an expiring credential limited to Quick Entry bootstrap and creation, bound to the authenticated owner and native installation, and stored outside widget-shared files.

#### Scenario: Rotate owner authority
- **WHEN** the authenticated owner changes, signs out, or the installation identity changes
- **THEN** Tasks revokes or clears the prior Quick Entry credential and cached owner reference data before accepting another native draft

#### Scenario: Reject an incompatible contract
- **WHEN** the server requires a newer Quick Entry contract than the installed native client supports
- **THEN** the editor remains cancellable and preserves its local draft but refuses submission with a refresh-required explanation

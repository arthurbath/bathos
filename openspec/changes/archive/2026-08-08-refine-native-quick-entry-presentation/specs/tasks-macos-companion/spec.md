## MODIFIED Requirements

### Requirement: Global quick entry presents a compact stable editor
The macOS Tasks companion SHALL present Global Quick Entry in a balanced, rounded, movable panel centered in the visible frame of the display containing the pointer, large enough for its native controls and focus outlines, SHALL visually distinguish its boundary with a one-pixel lighter dark-gray border and restrained native shadow, and SHALL never expose web loading, stale web content, or a blank web failure state.

#### Scenario: Open global quick entry on a multi-display Mac
- **WHEN** the user invokes Global Quick Entry while the pointer is on any attached display
- **THEN** the complete native editor appears immediately and is centered within that display's visible frame

#### Scenario: Finish global quick entry
- **WHEN** the user saves or cancels Global Quick Entry after invoking it from another application
- **THEN** the overlay closes and macOS restores the application that was active before the overlay opened

### Requirement: Native Quick Entry uses bounded owner authority
The macOS companion SHALL use an expiring credential limited to Quick Entry bootstrap and creation, bound to the authenticated owner and native installation, and stored in the sandbox-aware macOS data-protection Keychain outside widget-shared files.

#### Scenario: Persist native Quick Entry authority across a compatible rebuild
- **WHEN** a consistently identified and signed Tasks build replaces an earlier build
- **THEN** the replacement reads its bounded credential through the application-scoped data-protection Keychain without presenting a legacy per-item access prompt

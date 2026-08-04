## ADDED Requirements

### Requirement: Global Quick Entry preserves Tasks metadata Control shortcuts

The macOS companion SHALL intercept supported Tasks metadata Control shortcuts in the Global Quick Entry panel before AppKit text editing can consume them and SHALL deliver each accepted shortcut exactly once to the hosted Tasks editor.

#### Scenario: Forward a metadata shortcut while editing text

- **WHEN** Global Quick Entry is visible, a title, notes, primary-link, reminder, or checklist text control has focus, and the user presses a supported Control-only metadata shortcut
- **THEN** the native panel SHALL prevent AppKit from treating the chord only as a text-editing command
- **AND** SHALL dispatch the corresponding keyboard command once to the hosted Tasks editor

#### Scenario: Consume an excluded Tasks shortcut

- **WHEN** Global Quick Entry is visible and the user presses an excluded Tasks Control-only shortcut
- **THEN** the native panel SHALL consume the event without forwarding it to the hosted editor or applying its native text-editing behavior

#### Scenario: Preserve unowned keyboard behavior

- **WHEN** Global Quick Entry receives a Control chord that is not owned by the Tasks shortcut map, or a shortcut with another command modifier
- **THEN** the native panel SHALL allow the existing macOS or WebKit keyboard behavior to continue unchanged

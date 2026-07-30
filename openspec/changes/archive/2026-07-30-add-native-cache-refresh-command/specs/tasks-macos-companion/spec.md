## ADDED Requirements

### Requirement: Native Cache-Clearing Web-View Refresh
The Tasks native desktop companion SHALL provide a deep hard-refresh command that clears reload-safe web caches before reloading the current Tasks route while preserving authentication and durable local application data.

#### Scenario: Refresh the active Mac web view
- **WHEN** the Tasks window is active on macOS and the user presses Command+Option+R
- **THEN** the companion consumes the shortcut, clears its response and Fetch Cache data, and reloads the current route from its origin

#### Scenario: Preserve signed-in and offline state
- **WHEN** the cache-clearing refresh runs
- **THEN** it preserves cookies, credentials, local storage, IndexedDB, OPFS task data, service-worker registrations, and App Group widget data

#### Scenario: Preserve unrelated keyboard input
- **WHEN** the chord uses different modifiers or the Tasks window is not active
- **THEN** the macOS companion does not consume it as the cache-clearing refresh command

#### Scenario: Keep Windows shortcut parity
- **WHEN** the same command is implemented by a native Windows Tasks host
- **THEN** its chord is Control+Alt+R and its cache-preservation boundary matches the macOS command

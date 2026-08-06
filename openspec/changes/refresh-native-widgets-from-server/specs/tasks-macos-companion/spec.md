## ADDED Requirements

### Requirement: macOS widget accepts server-triggered refresh opportunities
The native Tasks widget extension SHALL require macOS 26 or later and share the iOS widget's bounded token registration and server-triggered timeline behavior while preserving the existing macOS cache, signing, and scheduled refresh contracts. The host app MAY retain an earlier deployment target independently of the widget extension.

#### Scenario: Register the Mac widget
- **WHEN** WidgetKit supplies a Mac widget token and the shared App Group contains valid widget authority
- **THEN** the extension persists and registers the token for the Mac widget topic and retains no general user session

#### Scenario: Reconcile a token whose callback was delayed
- **WHEN** WidgetKit exposes current Mac widget push information during a later timeline request but did not deliver or persist the original token callback
- **THEN** the extension reconciles that current token with its configured widgets and registers it through the same bounded widget authority

#### Scenario: Mac push support is unavailable
- **WHEN** the system withholds or delays delivery
- **THEN** the widget continues using its existing budgeted timeline and last-valid cache behavior

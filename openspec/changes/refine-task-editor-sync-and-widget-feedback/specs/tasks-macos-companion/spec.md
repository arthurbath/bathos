## ADDED Requirements

### Requirement: Native macOS Tasks observes externally originated changes
The macOS Tasks companion SHALL keep its authenticated task synchronization and local query observation active while the host is running so authoritative changes created outside that WebView appear without manual refresh.

#### Scenario: Receive an Inbox Manager task
- **WHEN** Inbox Manager creates a task for the signed-in owner while the native macOS Tasks host is running and connected
- **THEN** the task appears in the appropriate native Tasks list through ordinary synchronization without reloading the WebView

#### Scenario: Receive a webpage-capture task
- **WHEN** an external authenticated Tasks capture creates a task for the signed-in owner while the native macOS Tasks host is running and connected
- **THEN** the native list converges through the same live subscription path used for other remote mutations

#### Scenario: Resume observation after native lifecycle suspension
- **WHEN** macOS returns the Tasks host to an active or visible state after its WebView or synchronization transport was suspended
- **THEN** the companion resumes or re-establishes one owner-bound synchronization listener and reconciles authoritative changes without requiring a user refresh

#### Scenario: Preserve offline behavior
- **WHEN** the native host is offline
- **THEN** it preserves the last valid local projection and resumes convergence when connectivity returns without discarding local queued changes

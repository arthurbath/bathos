## MODIFIED Requirements

### Requirement: Thin Native macOS Tasks Host
The system SHALL provide a native macOS SwiftUI application that hosts the authoritative production Tasks web application in a persistent app-bound `WKWebView`.

#### Scenario: Launch the Mac companion
- **WHEN** the user launches the installed Mac app
- **THEN** it opens the production Today view in a dark native window and preserves web authentication, offline storage, and synchronized task behavior

#### Scenario: Follow an internal Tasks route
- **WHEN** the user navigates among Tasks lists, Settings, task links, or required account and authentication routes
- **THEN** the destination remains inside the existing native web view

#### Scenario: Follow another module or external destination
- **WHEN** the user follows another BathOS module, an ordinary web URL, or an approved external protocol
- **THEN** macOS opens it in the user's default browser or protocol application rather than replacing Tasks inside the native window

#### Scenario: Recover a failed initial load
- **WHEN** the production route cannot initially load and no cached web content can render
- **THEN** the app shows an explicit retryable unavailable state instead of a blank window or permanent spinner

#### Scenario: Combine Tasks with another full-screen application
- **WHEN** the user invokes macOS Split View or a compatible two-up full-screen tiling action from the Tasks window
- **THEN** the Tasks window explicitly remains eligible for placement beside another eligible application and can resize to a narrow mobile-class content width

#### Scenario: Preserve tiling eligibility across window transitions
- **WHEN** SwiftUI reconciles the main window or the window enters or exits full screen
- **THEN** Tasks retains its resizable style, explicit full-screen tiling eligibility, and narrow mobile-class minimum without acquiring a behavior that disallows tiling

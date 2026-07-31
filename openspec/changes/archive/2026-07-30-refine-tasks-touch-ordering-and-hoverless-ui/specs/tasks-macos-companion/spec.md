## ADDED Requirements

### Requirement: Discoverable Embedded macOS Tasks Widget
The verified macOS Tasks installation SHALL embed and register its native WidgetKit extension so macOS offers the On This Mac widget alongside the paired iPhone widget under the unified Tasks identity.

#### Scenario: Build the Mac widget extension
- **WHEN** the macOS Tasks scheme builds the companion application
- **THEN** the build produces the Tasks Mac widget extension for the current macOS deployment target and embeds it in the application plug-ins directory

#### Scenario: Verify widget signing and entitlements
- **WHEN** a signed Tasks application is prepared for installation
- **THEN** the app and nested widget share the configured Apple team and App Group, each passes strict signature verification, and the nested extension retains its WidgetKit extension point

#### Scenario: Discover the installed Mac widget
- **WHEN** the verified Tasks application is installed in `/Applications` and macOS enumerates available widgets
- **THEN** Tasks offers an On This Mac list widget and continues to offer the paired From iPhone widget as its platform counterpart

#### Scenario: Preserve widget data while refreshing registration
- **WHEN** installation refreshes LaunchServices or WidgetKit registration to recover a missing Mac widget
- **THEN** the process preserves App Group task projections, widget configuration, authentication material, and the installed iOS companion

#### Scenario: Fail before replacing a working app
- **WHEN** the built application lacks its extension, compatible signing, required entitlements, or strict verification
- **THEN** the installation stops before replacing the last verified Tasks application

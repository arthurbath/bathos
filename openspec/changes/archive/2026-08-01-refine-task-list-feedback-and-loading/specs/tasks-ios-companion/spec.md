## ADDED Requirements

### Requirement: iOS distribution category is Productivity
The Tasks iOS app's primary category in App Store Connect SHALL be Productivity. The project SHALL NOT claim that the macOS-only `LSApplicationCategoryType` plist key controls App Library placement for a development-installed iOS build.

#### Scenario: Distributed iOS metadata is configured
- **WHEN** the Tasks iOS app is prepared for TestFlight or App Store distribution
- **THEN** its App Store Connect primary category SHALL be set to Productivity

#### Scenario: Local development build is inspected
- **WHEN** a development-installed iOS build is grouped under the developer identity in App Library
- **THEN** the repository SHALL treat that label as platform-controlled development metadata rather than adding an unsupported iOS plist override

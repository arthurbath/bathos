## MODIFIED Requirements

### Requirement: Thin Native Tasks Host
The iOS companion SHALL house the authoritative BathOS Tasks web application without recreating task editing, synchronization, recurrence, reminder, or offline-mutation behavior natively, and SHALL prevent unrelated BathOS modules from replacing Tasks inside its WebKit container.

#### Scenario: Launch the companion
- **WHEN** the user launches the iOS companion without a pending deep link
- **THEN** it opens the production Today route in a native WebKit container and uses the ordinary BathOS authentication and Tasks experience

#### Scenario: Follow an internal Tasks route
- **WHEN** the web application navigates among trusted BathOS Tasks routes
- **THEN** the companion keeps that navigation inside the WebKit container

#### Scenario: Follow a required platform route
- **WHEN** Tasks navigates to Account, sign-in, sign-up, password recovery, terms, or help
- **THEN** the companion may keep that required platform route inside the WebKit container

#### Scenario: Follow another BathOS module
- **WHEN** the user activates a trusted-origin link to the platform launcher, Administration, or a BathOS module other than Tasks
- **THEN** the companion opens that URL through the operating system and leaves its Tasks WebKit route unchanged

#### Scenario: Follow an unrelated external link
- **WHEN** the user activates a link outside the trusted Tasks and required platform routes
- **THEN** the companion opens that URL through the operating system rather than granting it access to the Tasks bridge

#### Scenario: Continue without native data services
- **WHEN** the companion edits, synchronizes, schedules, or reminds
- **THEN** it delegates that behavior to the existing web module and does not create a second native task database, generic mutation API, or reminder scheduler

#### Scenario: Prepare the existing offline web shell
- **WHEN** the companion loads the trusted production Tasks origin while online
- **THEN** its persistent WebKit container treats that origin as app-bound so the existing Tasks service worker can stage the authenticated offline shell in the same browsing partition

#### Scenario: Fail visibly instead of presenting a blank web view
- **WHEN** a top-level Tasks navigation or restarted WebKit content process cannot recover cached or network content
- **THEN** the companion performs one bounded automatic recovery navigation and presents its native unavailable state and retry action only if that recovery also fails, rather than leaving an empty web surface

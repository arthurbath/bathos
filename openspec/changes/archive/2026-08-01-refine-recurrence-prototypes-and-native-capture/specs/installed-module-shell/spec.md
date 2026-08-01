## ADDED Requirements

### Requirement: Distinct Floating Mobile Navigation Border
The installed-module mobile navigation SHALL preserve its existing geometry and glass surface while using a slightly brighter border than the card borders it can overlap.

#### Scenario: Float above a card
- **WHEN** the mobile navigation overlaps a full-width card edge
- **THEN** its complete pill outline remains subtly distinguishable from the card border without becoming a high-contrast decorative stroke

### Requirement: Best-Effort Portrait Installed Tasks Web App
The Tasks web-app manifest SHALL request upright portrait presentation while recognizing that browser and operating-system support is not guaranteed.

#### Scenario: Install Tasks as a supporting PWA
- **WHEN** a browser honors the web-app manifest `orientation` member for the installed Tasks PWA
- **THEN** the standalone Tasks surface requests `portrait-primary`

#### Scenario: Run in a browser that ignores orientation
- **WHEN** a browser does not honor installed-web-app orientation declarations
- **THEN** Tasks remains usable and does not attempt a fragile scripted rotation or viewport transform

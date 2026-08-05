## ADDED Requirements

### Requirement: Today widget horizon markers share one apparent stroke weight
The shared Apple Tasks widget renderer SHALL draw Inbox, Now, Next, and Later markers at one consistent apparent stroke weight while preserving their canonical symbols, colors, and dimensions.

#### Scenario: Render the four Today markers on iOS
- **WHEN** the iOS Today widget displays tasks across all four horizons
- **THEN** the Inbox tray and three clock markers use matching rounded stroke weight without changing their horizon colors or row layout

## ADDED Requirements

### Requirement: Mac Today widget shares horizon marker weight
The macOS Tasks widget SHALL consume the shared Apple horizon-marker rendering so its Inbox, Now, Next, and Later markers have the same apparent stroke weight as the iOS widget.

#### Scenario: Render the four Today markers on macOS
- **WHEN** the macOS Today widget displays tasks across all four horizons
- **THEN** every horizon marker uses the shared symbol geometry and rounded stroke weight without platform-specific divergence

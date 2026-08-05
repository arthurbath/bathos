## ADDED Requirements

### Requirement: Mac Control-click task selection parity
On a Mac-like platform, the Tasks module SHALL treat Control-click on an eligible to-do activation surface as the same selection gesture as Command-click. The handled Control-click SHALL begin or modify selection mode using the clicked to-do, SHALL preserve the same open-editor and selection-anchor rules as Command-click, and SHALL not open the native context menu. Context-menu behavior outside eligible to-do activation surfaces MUST remain unchanged.

#### Scenario: Control-click begins selection on Mac
- **WHEN** selection mode is inactive and a Mac user Control-clicks an eligible to-do
- **THEN** selection mode begins with only the clicked to-do selected using the same behavior as Command-click
- **AND** the native context menu does not open

#### Scenario: Control-click modifies active selection on Mac
- **WHEN** selection mode is active and a Mac user Control-clicks an eligible selected or unselected to-do
- **THEN** the clicked to-do is toggled using the same selection-anchor and focus behavior as Command-click
- **AND** the gesture is applied exactly once

#### Scenario: Eligible task kinds share Control-click parity
- **WHEN** a Mac user Control-clicks an eligible ordinary to-do, Done-list to-do, or repeating prototype in the Upcoming list
- **THEN** that row uses the same selection behavior available through Command-click for that task kind

#### Scenario: Other context menus remain native
- **WHEN** a Mac user Control-clicks outside an eligible to-do activation surface
- **THEN** Tasks does not convert the gesture into task selection or suppress the surface's native context-menu behavior

#### Scenario: Windows behavior is unchanged
- **WHEN** a Windows user Control-clicks an eligible to-do
- **THEN** Tasks continues to use the existing Windows Control-click selection behavior

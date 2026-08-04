## ADDED Requirements

### Requirement: Task Notes Support Shift-click Range Selection
The Tasks module SHALL let a user extend the active selection in the directly editable Markdown Notes surface from its existing source anchor to a Shift-clicked source position without invoking task selection or link activation.

#### Scenario: Extend a note selection forward
- **WHEN** the Notes editor owns a caret or selection anchor and the user Shift-clicks a later source position in the same or a later line
- **THEN** Tasks selects the exact source span from the existing anchor through the clicked position and reveals source presentation for every crossed Markdown line

#### Scenario: Extend a note selection backward
- **WHEN** the Notes editor owns a caret or selection anchor and the user Shift-clicks an earlier source position in the same or an earlier line
- **THEN** Tasks preserves the later anchor, moves the selection focus to the clicked source position, and retains the backward selection direction through line-aware redecoration

#### Scenario: Shift-click a note link
- **WHEN** the user Shift-clicks semantic or source-presented link text while extending a Notes selection
- **THEN** Tasks uses the clicked source position as the selection focus without opening the link destination

#### Scenario: Preserve other note pointer interactions
- **WHEN** the user ordinarily clicks, drags to select, or ordinarily activates an actionable note link without Shift
- **THEN** the existing caret placement, drag selection, Markdown presentation, and safe link activation behavior remain unchanged

## ADDED Requirements

### Requirement: Expanded Task Editor State Coherence
The Tasks expanded editor SHALL reflect accepted changes to its current task while preserving nested editor-owned controls as independent interaction layers.

#### Scenario: Reflect a keyboard actionability mutation
- **WHEN** Control+G on Mac or Control+Shift+G on Windows changes the actionability of the currently open task
- **THEN** the open task remains expanded and its Actionability dropdown shows the newly accepted status

#### Scenario: Reflect an external organization mutation
- **WHEN** the accepted area or project placement of the currently open task changes outside the Organization dropdown
- **THEN** the open task remains expanded and its Organization dropdown shows the current accepted placement

#### Scenario: Dismiss an editor-owned select
- **WHEN** a pointer interaction dismisses the open Actionability or Organization popover, including activation of its label or trigger
- **THEN** only that nested popover closes and the containing task editor remains open

#### Scenario: Close after the nested select is gone
- **WHEN** no editor-owned select is open and a later pointer interaction begins outside the task and its editor-owned surfaces
- **THEN** Tasks follows the ordinary outside-close path for the expanded editor

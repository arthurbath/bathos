## ADDED Requirements

### Requirement: Mobile Touch Temporal Picker Presentation
The Tasks module SHALL present its ordinary Start and Deadline pickers as modal popovers centered within the visible viewport when the current device is touch-capable and the viewport is below the BathOS mobile breakpoint. The same picker content SHALL remain anchored to its initiating task control on non-touch devices and at larger viewport widths.

#### Scenario: Center Start on a touch-capable mobile viewport
- **WHEN** a user opens the complete Start picker on a touch-capable device below the BathOS mobile breakpoint
- **THEN** Tasks centers the existing Start picker within the current visual viewport
- **AND** a standard modal backdrop blocks interaction with the task list behind it

#### Scenario: Center Deadline on a touch-capable mobile viewport
- **WHEN** a user opens the ordinary Deadline picker on a touch-capable device below the BathOS mobile breakpoint
- **THEN** Tasks centers the existing Deadline picker within the current visual viewport
- **AND** a standard modal backdrop blocks interaction with the task list behind it

#### Scenario: Preserve anchored temporal pickers elsewhere
- **WHEN** a Start or Deadline picker opens on a non-touch device or at a viewport width at or above the BathOS mobile breakpoint
- **THEN** Tasks retains the established trigger-relative anchored placement without adding a modal backdrop

#### Scenario: Follow the visible viewport while the software keyboard is open
- **WHEN** the software keyboard changes the visual viewport while a centered Task temporal picker is open
- **THEN** the picker remains centered and bounded within the visible viewport and safe areas
- **AND** content that cannot fit scrolls inside the picker rather than moving or scrolling the task list behind it

#### Scenario: Keep the focused Reminder input visible
- **WHEN** the Reminder input in a centered Start picker receives focus and the software keyboard reduces the visible viewport
- **THEN** Tasks scrolls the picker as needed to keep the Reminder input and its text cursor visible above the keyboard
- **AND** Reminder text entry, parsing, saving, clearing, and nested hour-menu behavior remain unchanged

#### Scenario: Dismiss the centered picker safely
- **WHEN** a user dismisses a centered Task temporal picker through its backdrop or established keyboard command
- **THEN** Tasks closes only that picker through its controlled dismissal path
- **AND** pending Reminder input follows its existing commit rules, the task remains open, and focus restoration follows the initiating temporal control's existing contract

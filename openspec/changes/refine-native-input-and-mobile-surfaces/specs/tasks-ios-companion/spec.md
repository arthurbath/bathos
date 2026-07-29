## ADDED Requirements

### Requirement: Native Tasks text editing presents the software keyboard
The Tasks iOS companion SHALL allow ordinary editable web text controls to become the active WebKit editor and present the iOS software keyboard when the user begins editing, including after a native deep-link or widget capture handoff.

#### Scenario: Tap an ordinary text control
- **WHEN** the user taps an editable text field or text area in the native Tasks companion without a connected hardware keyboard
- **THEN** the control receives the insertion point and the iOS software keyboard becomes available for entry

#### Scenario: Launch a new task from a native surface
- **WHEN** a widget or Control Center action opens the existing new-task workflow
- **THEN** Summary receives editing focus and the same native keyboard-presentation behavior as a directly tapped web field

#### Scenario: Preserve hardware-keyboard behavior
- **WHEN** iOS reports a connected hardware keyboard or the user dismisses the software keyboard
- **THEN** the companion does not continuously steal first responder or force the software keyboard back onscreen

### Requirement: Native Tasks launch surfaces remain dark
The Tasks companion SHALL use the BathOS application background color behind and within its persistent WebView throughout cold launch, navigation, recovery, and offline loading.

#### Scenario: Cold-launch the companion
- **WHEN** the native app creates its WebView before web content has painted
- **THEN** no white or contrasting launch surface is visible behind the loading content

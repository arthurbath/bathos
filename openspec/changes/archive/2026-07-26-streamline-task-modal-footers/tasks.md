## 1. Regression Coverage

- [x] 1.1 Cover compact Keyboard Commands notation with no plus signs
- [x] 1.2 Cover removal of redundant Escape guidance
- [x] 1.3 Cover the shared footerless dialog layout and preservation of action-bearing footers

## 2. Implementation

- [x] 2.1 Add explicit footerless layout support to the shared dialog primitive
- [x] 2.2 Apply footerless layout to every Tasks dialog without footer actions
- [x] 2.3 Remove all “Escape Closes” content from Tasks
- [x] 2.4 Remove plus signs from every Keyboard Commands display chord
- [x] 2.5 Update durable Tasks documentation and specifications

## 3. Validation

- [x] 3.1 Run focused tests, type-checking, lint, and strict OpenSpec validation
- [x] 3.2 Run the complete test suite and production build
- [x] 3.3 Verify the Keyboard Commands panel and footerless modal geometry in the rendered Tasks app

## 4. Keyboard Help Follow-up Coverage

- [x] 4.1 Cover Command+/ on Mac and Control+/ on Windows without restoring obsolete aliases
- [x] 4.2 Cover shortcut capture from an editable task field
- [x] 4.3 Cover removal of the persistent header trigger and the platform-aware Config cue

## 5. Keyboard Help Follow-up Implementation

- [x] 5.1 Add the platform keyboard-help command and open the modal through the global Tasks command handler
- [x] 5.2 Remove the header question-mark button and add the Config cue
- [x] 5.3 Add the shortcut to Keyboard Commands and update durable Tasks documentation

## 6. Keyboard Help Follow-up Validation

- [x] 6.1 Run focused tests, type-checking, lint, and strict OpenSpec validation
- [x] 6.2 Run the complete test suite and production build
- [x] 6.3 Verify the shortcut, Config cue, removed header trigger, and modal reference in the rendered Tasks app

## 7. Keyboard Commands Visual Refinement Coverage

- [x] 7.1 Cover the neutral focused dialog container
- [x] 7.2 Cover regular interface typography for every shortcut value

## 8. Keyboard Commands Visual Refinement Implementation

- [x] 8.1 Remove the Keyboard Commands container focus outline and ring without changing descendant focus
- [x] 8.2 Replace monospace extra-small shortcut styling with regular interface typography
- [x] 8.3 Update the durable Tasks specification

## 9. Keyboard Commands Visual Refinement Validation

- [x] 9.1 Run focused tests, type-checking, lint, and strict OpenSpec validation
- [x] 9.2 Run the complete test suite and production build
- [x] 9.3 Verify the focused Keyboard Commands presentation in the rendered Tasks app

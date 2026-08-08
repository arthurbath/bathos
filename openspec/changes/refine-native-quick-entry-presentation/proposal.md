# Change: Refine Native Quick Entry Presentation

## Why

Global Quick Entry is now a responsive native editor, but its presentation still follows the active Tasks window instead of the user's pointer, may leave Tasks as the active application after dismissal, and stores its bounded credential through the legacy macOS Keychain path that can display opaque access prompts after a rebuild.

## What Changes

- Center Global Quick Entry on the visible frame of the display containing the pointer.
- Restore the previously active application after Save or Cancel.
- Store the bounded Quick Entry credential in the sandbox-aware data-protection Keychain.
- Preserve the existing native editor, BathOS styling, keyboard behavior, local draft, and explicit Save/Cancel transaction.

## Impact

- Affected spec: `tasks-macos-companion`
- Affected code: macOS Quick Entry panel placement, application activation lifecycle, credential storage, and focused Swift tests
- No database, API, or web deployment change

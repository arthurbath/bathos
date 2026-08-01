## Why

Date-picker paging needs a compact laptop-friendly shortcut without overriding native text selection inside Reminder. A populated Reminder also needs a direct, discoverable clear action that does not require selecting and deleting its text.

## What Changes

- Page the visible month or year with Shift+Left and Shift+Right only while focus is on a calendar value or calendar paging control.
- Preserve native Shift+Left and Shift+Right text selection inside Reminder and other text-entry subcontrols.
- Show an inline X between a populated Reminder value and its alarm-clock menu button, and clear the Reminder immediately when it is activated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `form-control-interactions`: Scope Shift+horizontal-arrow calendar paging to calendar values and paging controls.
- `personal-tasks-module`: Add the populated Reminder input's inline clear action and keyboard-safe layout.

## Impact

- Shared calendar keyboard handling and keyboard regression coverage.
- Tasks Start picker Reminder input, its composed input-group controls, and Tasks interaction tests.
- No database, Supabase, synchronization, or dependency changes.

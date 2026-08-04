## Why

Tasks currently places its versioned full-fidelity task or checklist payload directly in the system clipboard's plain-text representation. This preserves BathOS-to-BathOS paste fidelity, but exposes dense JSON when the user pastes into another application instead of producing useful readable text.

## What Changes

- Copy and Cut will continue carrying the complete versioned BathOS task or checklist payload for lossless paste back into Tasks.
- The same clipboard item will expose a human-readable plain-text representation containing one task or checklist-item summary per line.
- Tasks will prefer the BathOS representation when pasting internally and fall back to compatible HTML metadata, legacy JSON-only plain text, or ordinary multiline text.
- Clipboard format support will degrade safely when a browser cannot write web custom formats.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-tasks-module`: Define dual-format cross-application Copy, Cut, and Paste behavior for tasks and checklist items.

## Impact

- Tasks clipboard domain serializers and parsers.
- Task-list and checklist copy, cut, and paste event handling.
- Clipboard compatibility tests across async ClipboardItem and event-data fallbacks.
- No database, Supabase, native-app, or external API changes.

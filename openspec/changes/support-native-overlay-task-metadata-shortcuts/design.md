## Context

Global Quick Entry hosts the shared Tasks new-task editor inside a second `WKWebView`. The web editor already knows how to apply the ordinary task metadata commands to its active draft, but macOS text editing can consume Control-based chords such as Control+E before WebKit emits a DOM keyboard event. The overlay therefore needs a native event bridge without granting access to task, list, or history commands whose meaning is ambiguous outside a list.

## Goals / Non-Goals

**Goals:**

- Preserve the ordinary task metadata shortcut behavior inside Global Quick Entry.
- Intercept supported shortcuts before AppKit text editing consumes them.
- Explicitly suppress Tasks-owned Control chords that must not act in the overlay.
- Keep unowned Control chords and ordinary text editing behavior unchanged.

**Non-Goals:**

- Add list navigation, task capture, completion, bulk selection, or undo history to Global Quick Entry.
- Change the shortcut mapping used by ordinary task lists.
- Add a new native-to-web command protocol or persistence API.

## Decisions

### Use a native quick-entry shortcut policy

The quick-entry panel classifies exact Control-only key events into three outcomes: forward a supported metadata key, consume an excluded Tasks key without action, or pass through an unowned key. The panel handles this before AppKit's field editor, then dispatches supported keys once as synthetic DOM `keydown` events to the hosted editor.

This avoids relying on WebKit to receive keys that macOS treats as native text-editing commands and prevents duplicate handling by consuming the original native event after forwarding it.

### Keep the web editor authoritative

The native bridge forwards the original key rather than reproducing metadata behavior in Swift. The shared Tasks keyboard handler remains responsible for opening fields, cycling values, and mutating the new-task draft. A domain-level allowlist identifies the commands that are valid in native quick entry, and the web handler suppresses other Tasks Control commands as a defensive second layer.

Supported commands are Start, clear Start, cycle Today horizon, Reminder, Deadline, actionability, Someday, checklist, and Area. Excluded commands include task open/close and navigation, new-task capture, undo history, completion, bulk selection, and view navigation.

### Scope interception to exact Control-only chords

The native policy applies only when Control is the sole command modifier. Command, Option, Shift, and mixed-modifier gestures retain their existing native or web behavior. Unmapped Control keys also pass through unchanged.

## Risks / Trade-offs

- Synthetic keyboard events are not trusted browser events. The shared Tasks handler already accepts document keyboard events and does not require `isTrusted`, so this is compatible with the current editor. Tests protect this assumption.
- A future task shortcut will not automatically become available in Global Quick Entry. It must be deliberately added to the allowlist, which is desirable because overlay behavior should remain narrow and unambiguous.
- Consuming excluded Tasks chords means their native field-editor meanings do not apply in the overlay. This is intentional for the specified keys so Control+A, Control+Q, and Control+X truly do nothing there.

## Migration Plan

No data migration is required. Ship the web allowlist and native event bridge together. Reverting both restores the previous behavior without changing stored tasks.

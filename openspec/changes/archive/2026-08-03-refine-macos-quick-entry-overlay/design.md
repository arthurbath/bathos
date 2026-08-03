## Context

Global Quick Entry is an AppKit `NSPanel` whose content is a SwiftUI-hosted `WKWebView`. The native view currently displays an `NSProgressView` until the web document declares itself ready, but the Tasks route declares readiness as soon as the shell mounts. The Tasks runtime can still be loading at that point, exposing its separate circular spinner and producing a two-stage loading sequence. Warm presentation also reveals the reused document before its fresh draft is mounted, while editor close animation can remain visible after the panel begins dismissal.

Checklist creation requires a persisted task parent. The ordinary draft intentionally defers persistence while Summary is empty, so the Quick Entry Add Checklist action currently returns focus to Summary instead of creating the requested checklist when the draft has not yet persisted.

## Goals / Non-Goals

**Goals:**

- Give native Quick Entry one owner for loading and one atomic editor-ready signal.
- Make dismissal immediate and native-controlled in loading, ready, and failure states.
- Preserve cancellation cleanup as a best-effort asynchronous web operation after native dismissal.
- Reuse the healthy WebKit document while covering its old state until the new draft is ready.
- Allow structural checklist editing before a title has caused ordinary autosave persistence.
- Balance the panel visually with wider horizontal padding and explicit standard actions.
- Allow native background dragging without interfering with web controls.

**Non-Goals:**

- Change the main Tasks window loading behavior.
- Replace the authoritative web task editor with a native form.
- Add a new persistence model or database object for temporary quick-entry drafts.
- Dismiss Quick Entry from an outside click.

## Decisions

### The web editor sends a quick-entry-specific readiness message

The existing generic `content-ready` message remains the document bootstrap contract. A new `quick-entry-ready` bridge message is sent only after the native route has mounted its draft editor and the Summary input is present. The native model tracks this presentation readiness separately from document readiness.

This is preferable to timers because it prevents both cold and warm exposure of intermediate content. A bounded fallback remains for compatibility with an older deployed web client.

### The native panel owns the loading cover

The SwiftUI host keeps the WebKit view hidden behind one native progress presentation until the presentation-ready message arrives. The web route may continue using its normal loader internally, but it is never visible inside Quick Entry. On warm invocation the panel reuses the WebKit document and holds presentation until the fresh draft is ready.

This avoids maintaining a second Tasks-specific loading implementation in Swift while guaranteeing a single visible spinner.

### Native dismissal precedes web cleanup

Escape, the global shortcut toggle, and Cancel immediately order the panel out. If the web document is available, the controller then dispatches the existing cancellation event so a persisted draft is recoverably deleted. A bounded timeout clears native cancellation state if the document cannot acknowledge the request.

This prioritizes a reliable escape route over waiting for network-backed cleanup. It also avoids child-content close animation because the entire panel disappears as one native surface.

### The panel moves from its native background

The `NSPanel` remains movable by its background. The native hosting hierarchy exposes a noninteractive top/background region to AppKit while ordinary WebKit controls continue receiving their pointer events. No custom JavaScript drag protocol is introduced.

### Structural checklist creation may force draft persistence

When Add Checklist is activated for an unpersisted quick-entry draft, Tasks creates the draft parent with the internal `New Task` placeholder required by the existing task-title constraint while keeping the visible Summary field empty, then opens and focuses the ordinary checklist editor. The user's first valid Summary replaces that internal placeholder. Cancel recoverably deletes the parent, while Save remains unavailable until Summary is valid. This reuses the established repository and cancellation path instead of creating a parallel local-only checklist model.

### Quick Entry uses standard form actions and native-specific spacing

The form displays an outlined Cancel button followed by the normal filled primary Save button. Cancel is always enabled; Save retains title and pending-operation validity rules. Horizontal padding is increased only for the declared native quick-entry surface so other Tasks layouts remain unchanged.

## Risks / Trade-offs

- **Risk:** An older web client cannot send `quick-entry-ready`. **Mitigation:** Retain a bounded native compatibility fallback after successful navigation.
- **Risk:** Immediate native dismissal can hide a cleanup failure. **Mitigation:** Keep the recoverable delete request and existing error telemetry path, and reset the retained document before its next presentation.
- **Risk:** Persisting an untitled draft for a checklist creates a temporary server row with an internal placeholder title. **Mitigation:** The placeholder is never shown in the editor, cannot be positively saved without a user-authored Summary, is replaced by the first valid Summary, and is recoverably deleted on every negative dismissal path.
- **Risk:** AppKit background dragging could absorb a web click. **Mitigation:** Limit movement to native background/top padding and preserve WebKit as a first-mouse receiver for its own controls.

## Migration Plan

No schema migration is required. Deploy the web readiness and checklist behavior before or with the native companion. The native compatibility fallback permits either side to be rolled back independently.

## Open Questions

None.

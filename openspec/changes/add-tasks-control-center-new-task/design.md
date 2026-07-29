## Context

The Tasks companion already ships one WidgetKit extension, an App Group, App Intents for widget configuration, an allowlisted native URL router, and a persistent WebKit host for the authoritative Tasks module. The web module already owns the complete new-task draft workflow, including Today placement, autosave, offline local data, keyboard focus, and synchronization.

iOS 18 and later expose Control Center controls through WidgetKit. Apple requires a control that opens an app to use an App Intent available to both the containing app and widget extension. The native target still supports iOS 17, so the new control must be availability-gated without changing the app's minimum deployment target.

## Goals / Non-Goals

**Goals:**

- Offer one obvious, nonconfigurable “New Task” system control on supported iOS versions.
- Open the native companion directly into the existing new-task editor on Today Inbox.
- Reuse the web module's draft, autosave, offline, authentication, and synchronization behavior.
- Make every activation single-use and safe across cold starts, warm starts, and WebKit recovery.
- Preserve the current widgets and native deep-link security boundary.

**Non-Goals:**

- Create or save a task directly inside the widget extension.
- Add native task fields, native synchronization, a generic native mutation service, or a configurable destination.
- Backport Control Center controls to iOS 17.
- Change the existing in-app add-task iconography.

## Decisions

### Use one static ControlWidget button

The widget extension will add a `ControlWidget` backed by `StaticControlConfiguration` and `ControlWidgetButton`. Its display name and action label will be “New Task.”

A configurable control was rejected because the user requested one precise capture destination. A toggle was rejected because task creation is a momentary action, not persistent binary state.

### Use an OpenIntent with a private single-use handoff

The button action will be an `OpenIntent` with one static Today Inbox target. The intent source will belong to both the app and widget extension, as required by ControlWidget app-launch actions.

Before iOS opens the containing app, the intent will atomically write one opaque UUID marker into the existing private App Group. The app will consume and remove that marker on appearance or foreground activation and invoke the same fixed new-task route used by `bathostasks://new`. The marker carries no task content, owner, identifiers, placement choice, or arbitrary URL.

An App Intents URL representation was rejected after physical acceptance because Apple requires a universal HTTP(S) link and the user's Apple Personal Team cannot provision Associated Domains. A generic foreground AppIntent was rejected because the OpenIntent contract is the supported ControlWidget mechanism for launching a containing app on iOS 18. The bounded App Group marker uses a capability already provisioned for both native targets and still leaves the web editor authoritative.

### Map the Lucide concept to the native system symbol

The system control will use the SF Symbol `plus.square`, the native equivalent of Lucide `square-plus`. Apple system controls require symbol imagery so the operating system can apply the correct weight, scale, tint, and appearance across Control Center, Lock Screen controls, and the Action button.

Shipping a custom raster or vector icon was rejected because it would fight the system control rendering contract without materially improving recognition.

### Extend the native route with one fixed creation target

`TaskNativeRoute` will add one new-task case. Its web URL will be the production Today route with a bounded `native_new_task=1` query item, while its deep link will be `bathostasks://new`.

Unknown routes will continue falling back to Today. The route carries no owner, task identifier, title, or arbitrary placement input and therefore grants no additional data authority.

### Consume the web creation signal once

The Tasks shell will recognize only the exact `native_new_task=1` signal. After the authenticated Today shell is ready, it will remove the parameter with a replace navigation and invoke the existing creation workflow with explicit Inbox placement.

Removing the signal before invoking creation prevents a render, reload, back navigation, or WebKit recovery from opening duplicate drafts. If one unsaved draft is already open, the existing no-data-loss behavior remains authoritative and focuses that draft rather than replacing it.

Warm native launches will reuse the loaded Tasks document through the existing in-page navigator. That navigator will encode the relative destination with Swift's JSON encoder before interpolating it into JavaScript. Foundation's JSON serialization API rejects a top-level string unless fragment handling is explicitly enabled and can terminate the app with an Objective-C exception, so it is not a safe string-literal encoder for this boundary.

### Complete capture focus through a bounded native handshake

The existing Summary input remains the authoritative editor. A new Today Inbox draft first applies ordinary DOM focus and cursor-at-end behavior. Once that exact input exists, the web module sends a fixed `focus-new-task-summary` message through the existing trusted native bridge. The companion evaluates one constant script that focuses only `task-title-task-draft:new` and confirms that the input became the active DOM element.

Physical acceptance proved that an asynchronous DOM focus plus `WKWebView.becomeFirstResponder()` can still leave a visible cursor without granting WebKit permission to present the software keyboard. After the fixed DOM focus succeeds, the companion therefore waits for its window to become key within a bounded one-second interval and primes the standard software keyboard with a one-pixel transparent native `UITextField` in the active WebKit hierarchy. Once UIKit reports that keyboard onscreen, the companion repeats the fixed DOM-focus check and transfers the active responder session to WebKit. The primer never accepts, stores, mirrors, or persists task text.

This bounded native handoff uses only public WebKit and UIKit responder APIs. Private WebKit keyboard flags, private responder classes, method swizzling, and native duplicate task editors were rejected.

While Summary edits are waiting inside the existing autosave debounce, the task row mirrors the editor's local display value. An empty value renders `New Task` in subdued italic text, and the first typed character replaces it immediately without introducing another persistence path or changing autosave cadence.

### Bootstrap a checklist through the ordinary task editor

A creation draft exposes the same Add Checklist control used by an existing task. Because the database requires a nonblank Summary before a task and its checklist rows can exist, invoking the control flushes the existing autosave queue. If Summary is valid, the normal task-creation path supplies the persisted identifier and the existing checklist editor opens. If Summary is still empty, focus remains on Summary and no placeholder task is written.

A separate client-only checklist draft model was rejected because it would duplicate checklist editing, ordering, undo, and persistence logic and could diverge from the existing editor.

## Risks / Trade-offs

- **A system control is unavailable on iOS 17** -> Availability-gate the control and retain the current iOS 17 app and widgets unchanged.
- **The intent and app run in separate processes** -> Persist one opaque request atomically in their already-shared App Group and consume it on both cold appearance and foreground activation.
- **A malformed or stale request marker could trigger creation** -> Accept only a bounded UUID marker, clear malformed content, and delete a valid marker before opening the editor.
- **A Personal Team cannot provision Associated Domains** -> Keep the launch handoff inside the existing App Group and avoid universal-link entitlements or hosting dependencies.
- **A URL signal could replay after navigation recovery** -> Remove it through replace navigation before beginning the draft workflow and cover idempotence in tests.
- **A warm control launch could crash while encoding the in-page destination** -> Use a top-level-string-safe JSON encoder and exercise the real new-task route through the production navigator in native tests.
- **The web shell may require authentication or network recovery before it can create** -> Preserve the query through existing authentication redirects and let the installed offline shell handle creation when available.
- **The native app and public web bundle could implement different halves of the handoff** -> Publish the matching web release before physical acceptance so the production web shell recognizes the native signal.
- **WebKit may reject an asynchronous web focus as keyboard authority** -> Confirm the fixed Summary focus, prime the keyboard through an empty native text responder, then transfer that active session to the reconfirmed WebKit Summary input.
- **A blank draft has no identifier for checklist rows** -> Show the ordinary Add Checklist control, persist only after Summary is valid, and then reuse the existing checklist editor.
- **A custom Lucide asset may render inconsistently in Control Center** -> Use Apple's adaptive `plus.square` symbol as the native expression of the requested icon concept.
- **An existing unsaved draft may already be open** -> Focus it instead of silently destroying its pending metadata or creating a second draft.

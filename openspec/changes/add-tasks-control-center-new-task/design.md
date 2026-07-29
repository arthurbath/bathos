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

### Use an OpenIntent with a URL-representable target

The button action will be an `OpenIntent` whose single target maps to `bathostasks://new`. The target will conform to the App Intents URL representation contract so iOS opens the containing app through its existing URL scene path. The intent source will belong to both the app and widget extension.

This is preferred to storing pending navigation in the App Group because the URL is explicit, testable, and delivered by the system as part of opening the app. It is preferred to executing a task mutation in the extension because the existing web editor remains authoritative.

### Map the Lucide concept to the native system symbol

The system control will use the SF Symbol `plus.square`, the native equivalent of Lucide `square-plus`. Apple system controls require symbol imagery so the operating system can apply the correct weight, scale, tint, and appearance across Control Center, Lock Screen controls, and the Action button.

Shipping a custom raster or vector icon was rejected because it would fight the system control rendering contract without materially improving recognition.

### Extend the native route with one fixed creation target

`TaskNativeRoute` will add one new-task case. Its web URL will be the production Today route with a bounded `native_new_task=1` query item, while its deep link will be `bathostasks://new`.

Unknown routes will continue falling back to Today. The route carries no owner, task identifier, title, or arbitrary placement input and therefore grants no additional data authority.

### Consume the web creation signal once

The Tasks shell will recognize only the exact `native_new_task=1` signal. After the authenticated Today shell is ready, it will remove the parameter with a replace navigation and invoke the existing creation workflow with explicit Inbox placement.

Removing the signal before invoking creation prevents a render, reload, back navigation, or WebKit recovery from opening duplicate drafts. If one unsaved draft is already open, the existing no-data-loss behavior remains authoritative and focuses that draft rather than replacing it.

## Risks / Trade-offs

- **A system control is unavailable on iOS 17** -> Availability-gate the control and retain the current iOS 17 app and widgets unchanged.
- **A URL signal could replay after navigation recovery** -> Remove it through replace navigation before beginning the draft workflow and cover idempotence in tests.
- **The web shell may require authentication or network recovery before it can create** -> Preserve the query through existing authentication redirects and let the installed offline shell handle creation when available.
- **A custom Lucide asset may render inconsistently in Control Center** -> Use Apple's adaptive `plus.square` symbol as the native expression of the requested icon concept.
- **An existing unsaved draft may already be open** -> Focus it instead of silently destroying its pending metadata or creating a second draft.

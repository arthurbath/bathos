# Tasks Native Apple Companion Decision Gate

**Date:** 2026-07-20
**Category:** Product / Architecture
**Status:** Decision Complete - Native Implementation Not Currently Justified

## Decision

Do not build a native Apple companion yet. The current web/PWA and Raycast surfaces cover the workflows justified by the available evidence: Cross-platform task operation, offline task data, global and contextual macOS capture, browser reminder delivery while the app is closed, and notification deep links back to the relevant task view.

This closes OpenSpec task 8.1 with a decision to defer implementation, not a permanent rejection. Production synchronization, explicit Safari registration, provider acceptance, notification opening, route rendering, and user acknowledgement now work. The first notification incident was an application parser defect, not a browser-delivery limitation, and the web fix resolved it without a native target. A future native change should begin with evidence from normal use, not with a speculative Swift client.

## Existing Coverage

### Web/PWA

- Standalone install metadata and a Tasks-specific start route
- Offline reads, writes, reload recovery, and synchronization through the selected PowerSync foundation
- Server-owned reminders with in-app delivery and standards-based Web Push
- Notification clicks that focus an existing client or open the relevant Tasks route
- One task-domain contract shared with MCP, Raycast, and later clients

On iOS and iPadOS 16.4 or later, Home Screen web apps support Web Push after a direct user interaction grants permission. Those notifications appear on the Lock Screen, in Notification Center, and on a paired Apple Watch. They use the same standards-based Web Push path backed by APNs and do not require Apple Developer Program membership.

### Raycast

The sibling Raycast project already supplies four narrow capture surfaces:

- Quick task entry
- Current webpage capture
- One Finder item capture
- AI-enriched reading-list capture

These commands provide the global macOS invocation layer that would otherwise motivate an early native overlay. They share OAuth, Keychain-backed pending-capture recovery, structured provenance, and stable request identities.

## Native-Only or Practically Native Gaps

| Surface | Incremental value | Current substitute | Approval evidence |
| --- | --- | --- | --- |
| WidgetKit widgets | Glanceable Today state and selected task actions on Home Screen, Lock Screen, Mac, or Apple Watch | Open the installed PWA or use a reminder notification | A specific widget is repeatedly missed during daily use and its exact content and action are known |
| WidgetKit controls | Capture or perform a narrow action from Control Center, Lock Screen, Action button, Mac menu bar, or Apple Watch | Raycast on Mac and the installed PWA on iPhone | A named control would remove recurring friction that existing capture cannot address |
| App Intents | Structured actions and entities for Siri, Spotlight, Shortcuts, widgets, and supported hardware actions | MCP for AI systems, Raycast for Mac capture, and web deep links | One approved system workflow has clear parameters, authentication, failure behavior, and frequent value |
| Native push target | A separate APNs delivery target and native notification handling | Standards-based Web Push plus in-app fallback | Production Web Push shows repeatable failures after permission, configuration, provider acceptance, and device state are diagnosed |
| TestFlight distribution | Stable beta installation and updates beyond direct Xcode device installation | Home Screen PWA or free-account Xcode installation on owned devices | Repeated native installation or device management makes direct development deployment burdensome |

Basic reminder appearance on a paired Apple Watch does not justify a watchOS app. A watchOS surface should be evaluated separately only when the desired interaction exceeds notification delivery.

## Activation Criteria

Reopen native implementation when at least one of these conditions has concrete parallel-use evidence:

1. A production reminder is missed, duplicated, or materially late after the system has confirmed correct schedule computation, active permission, target registration, provider acceptance, and relevant device state. One incident prompts diagnosis. A native push target is justified only when the remaining failure is a browser delivery limitation.
2. The user identifies a specific widget or control that would be used repeatedly and cannot be served adequately by the PWA, a notification action, or Raycast.
3. A PWA lifecycle or system-integration limitation creates recurring friction during normal use and a bounded native surface directly removes it.
4. A concrete App Intent or Shortcuts workflow is approved with an explicit action contract and enough expected use to justify maintenance.
5. Direct device installation becomes materially burdensome enough to justify Apple Developer Program enrollment and TestFlight.

Evidence should name the workflow, frequency, failure mode, current workaround, proposed surface, and success criterion. General preference for a native app is not enough to choose an architecture.

## Recommended Native Shape If Activated

Build the smallest system-surface companion that resolves the observed gap:

- Use a thin SwiftUI shell and deep links only where an app host is required
- Add only the approved WidgetKit, control, App Intent, or notification extension
- Reuse the existing task-domain operations, ownership rules, revisions, mutation UUIDs, and reminder occurrence identities
- Treat APNs as another registered delivery target rather than a second reminder scheduler
- Keep authentication material in Apple platform secure storage and preserve owner-scoped server authorization
- Do not create an independent task database or a second generic CRUD contract
- Add PowerSync's Swift client and full native offline editing only if later evidence justifies a complete native client
- Choose stable `garden.bath.*` identifiers only after the user-facing product identity is selected

This shape preserves one product while allowing Apple-only surfaces to remain narrow and replaceable.

## Distribution Boundary

A free Apple developer account can install and test an app directly on personally owned devices through Xcode. Apple Developer Program membership is currently $99 per year and is required for TestFlight and broader distribution. The project should enroll only when a selected native capability or ongoing installation workflow makes membership useful.

Public App Store eligibility remains a design constraint, not a current launch requirement. A future public release would require a fresh product-identity review, distribution configuration, privacy review, and App Store readiness work.

## Consequence for the Roadmap

- Close OpenSpec task 8.1 with native implementation deferred
- Do not scaffold an Xcode project, reserve permanent bundle identifiers, or create Apple extensions now
- Keep tasks 8.2-8.7 dormant until one activation criterion is met
- Record concrete widget, control, intent, or notification gaps during parallel use
- If a trigger appears, choose the smallest companion architecture before beginning tasks 8.2-8.7

## Sources

- [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WidgetKit](https://developer.apple.com/documentation/widgetkit/)
- [Creating a Widget Extension](https://developer.apple.com/documentation/WidgetKit/Creating-a-Widget-Extension)
- [WidgetKit Controls](https://developer.apple.com/documentation/widgetkit/controls-collection)
- [Creating Controls to Perform Actions Across the System](https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system)
- [App Intents](https://developer.apple.com/documentation/appintents)
- [TestFlight](https://developer.apple.com/testflight/)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [Distributing an App for Beta Testing and Releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

## Changes Made

- Narrowed the native decision from a general app question to four evidence-driven system-integration gaps
- Recorded the existing PWA, Web Push, paired Apple Watch, and Raycast coverage
- Verified production Safari registration, provider acceptance, notification opening, and acknowledgement without a native delivery target
- Classified and fixed the first notification-opening failure as a synchronized-time parser defect rather than a Web Push limitation
- Defined activation criteria and the minimum companion architecture
- Left every native implementation task open pending lived parallel-use evidence

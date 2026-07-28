# Tasks iOS Companion Evaluation

## Decision

Use a thin SwiftUI `WKWebView` host plus a read-only WidgetKit extension. Keep the production BathOS Tasks web module authoritative for authentication, synchronization, task editing, projection logic, and access control.

This is the smallest native architecture that supplies configurable Home Screen widgets without duplicating the Tasks domain in Swift.

## Delivered Boundary

- One iOS application target at `garden.bath.tasks`
- One WidgetKit extension at `garden.bath.tasks.widgets`
- One configurable `systemLarge` widget for Today, Upcoming, Anytime, Someday, or Done
- One versioned, bounded web-to-native projection bridge
- One App Group cache at `group.garden.bath.tasks`
- Allowlisted list and task deep links
- Native unit coverage for cache validation and route parsing

Apple Watch complications, native task editing, independent background synchronization, and App Store distribution are outside this slice.

## Data And Privacy

The web application derives widget rows from owner-scoped local task data. Native code accepts bridge messages only from the production Tasks main frame and validates the complete payload before writing it atomically.

Each supported list is limited to 50 rows. The projection includes task identifier, Summary, Deadline, Today horizon, actionability, and terminal state only where relevant. It omits credentials, cookies, tokens, notes, checklist text, Primary Link, Mail provenance, and raw synchronization failures. A different owner replaces the whole cache, and sign-out clears it.

WidgetKit never receives Supabase credentials and does not independently query production. It renders the most recent accepted cache and marks stale data. The companion requests timeline reloads only when the snapshot content changes.

## Deep-Link Boundary

The custom scheme accepts only known Tasks list identifiers or a canonical UUID task identifier. Native code translates accepted routes to HTTPS production Tasks routes. The web application opens a task only after confirming it appears in the current authenticated owner's selected-list projection, then removes the one-time native query parameter.

## Validation

The web projection and deep-link integration are covered by Vitest. The native app, widget, and XCTest bundle compile through the shared Xcode scheme with signing disabled when the asset catalog is excluded.

The checked-in app icon is valid. The complete ordinary Simulator build cannot run on the current Mac because Xcode contains the iOS 26.5 Simulator SDK while the installed runtimes are iOS 26.3 and 26.4. Asset compilation rejects that mismatch before launch. No valid code-signing identity is currently configured.

These are environment gates rather than source-code substitutions. The source build excludes the asset catalog only to prove Swift compilation, target dependency wiring, App Intents metadata generation, extension embedding, and XCTest bundle compilation. The committed project retains the real asset catalog and signing configuration.

## Remaining Acceptance

1. Install the Simulator runtime matching the active Xcode SDK, or update Xcode and its runtimes as one compatible set.
2. Select an eligible Apple Developer team.
3. Enable `group.garden.bath.tasks` for `garden.bath.tasks` and `garden.bath.tasks.widgets`.
4. Build and run on the intended iPhone.
5. Prove sign-in, offline web launch, all five configurable widget choices, stale and signed-out states, cache clearing, list links, and owner-gated task links.

The OpenSpec change should remain active until this physical-device acceptance is complete.

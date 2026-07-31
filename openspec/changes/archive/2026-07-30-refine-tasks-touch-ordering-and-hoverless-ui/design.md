## Context

This change crosses the Tasks React surface, shared BathOS interaction styling, the Tasks recurrence activation function, and the native macOS widget extension. The current implementation opens pull-down Quick Find after the touch gesture has ended, which means iOS does not consistently treat the later input focus as user initiated. Upcoming recurrence projections are backed by ordinary future task rows but are intentionally excluded from current drag participation. Reached future starts retain planning order when they become Today Inbox tasks, so they can interleave with unfinished work rolled over at midnight. BathOS also contains both Tailwind hover variants and pointer-move selection behaviors that create hover-only feedback or disclosure.

The macOS and iOS companions deliberately share the same product, widget, App Group, and WidgetKit kind identifiers so Apple can recognize them as counterparts. Restoring the Mac widget therefore needs to preserve that identity contract and correct build, embed, install, and registration behavior rather than inventing a second public widget identity.

## Goals / Non-Goals

**Goals:**

- Make pull-down Quick Find immediately editable on touch devices and make its exhaustive-search action accurate.
- Preserve browser-native touch scrolling while providing bounded top and bottom elasticity and the existing pull-down Quick Find affordance.
- Let scheduled recurrence projections share Upcoming date-section order with ordinary tasks and preserve that order when occurrences reach Today.
- Make Notes links actionable wherever link-blue text is presented.
- Remove hover visual states and hover-only disclosure across BathOS without removing focus, active, disabled, or selected feedback.
- Restore a discoverable, signed, embedded macOS widget under the unified Tasks identity.
- Preserve visible contrast for the current-day Star when that date is selected.

**Non-Goals:**

- Custom pointer scrolling, inertial physics, or replacement of browser-native touch scrolling.
- Cross-date drag of recurrence projections, which would alter recurrence cadence rather than ordering.
- Editing a recurrence cadence by dragging its Upcoming projection.
- A second macOS-only widget product identity.
- Removing pointer click, keyboard focus, pressed, selected, validation, or disabled states.

## Decisions

### Focus Quick Find inside the releasing touch event

The touch-end handler will synchronously commit the Quick Find surface and focus its query input before returning from the user gesture. Existing deferred focus remains as a fallback for keyboard and non-touch openings. This keeps the software-keyboard request inside Safari and WKWebView's trusted activation window.

Alternative considered: asking the native shell to summon the keyboard. Rejected because pull-down Quick Find also applies to Safari and installed PWAs, and the web interaction can remain self-contained.

### Derive See All Results from the complete ranked result set

Quick Find will rank the complete matching set, render only the first three, and expose `See All Results` only when at least one full-search result exists. Arrow-key indexing will include that action only while it is present. Pointer movement will no longer create a hover selection.

Alternative considered: show the action only when there are more than three matches. Rejected because the requested contract is that the action appears when the Search page has a result, including when the compact palette already shows all available matches.

### Use bounded visual elasticity around native scrolling

The list shell will observe touch overscroll only at the top or bottom boundary and apply a damped, capped visual translation to the scroll content. It will not synthesize scrolling, capture ordinary in-range movement, or translate fixed navigation and floating actions. The top displacement drives the existing Quick Find progress indicator. Releasing below the threshold springs back, while releasing above it opens Quick Find.

Alternative considered: CSS `overscroll-behavior` alone. Rejected because installed iOS web surfaces do not provide a consistent visible bounce and the top gesture also needs deterministic Quick Find progress.

### Reuse occurrence task order for Upcoming recurrence projections

Scheduled recurrence projections already have task identity and planning order. They will participate in same-date Upcoming drag targeting and persist through the existing atomic reorder path. Cross-date drops remain unavailable for recurrence projections because their dates are cadence-controlled.

At owner-local midnight, the activation function will first roll unfinished Today work into Inbox, then assign reached-start tasks a fresh contiguous order after the current Inbox tail. Reached tasks are processed by their preactivation Upcoming section order, preserving the user's planned recurrence and ordinary-task sequence.

Alternative considered: a separate recurrence-definition order column. Rejected because the scheduled projection task already supplies the correct occurrence-specific ordering identity and a second order system would need reconciliation.

### Treat link-blue Notes text as the activation target

Inactive semantic links and active-line blue destinations will both open their validated destination. Clicking ordinary active-line source continues to place the caret, but clicking a blue destination does not enter it. Users edit a destination by moving the caret into it with the keyboard.

Alternative considered: modifier-click to follow active-line links. Rejected because it would make touch activation impossible and contradict the direct-click requirement.

### Remove hover as a visual and disclosure state

Tailwind `hover:` variants, CSS `:hover` rules, and pointer-move-only highlighting will be removed. Controls retain focus-visible, active/pressed, checked, selected, disabled, validation, and open-state feedback. Hover-only controls that are actionable remain persistently visible. Redundant decorative hover feedback is removed rather than replaced.

Tooltips that convey essential information will remain available through keyboard focus and deliberate tap/click activation. Native browser title behavior is not used as the only source of essential information.

### Preserve unified widget identity and repair registration

The Mac widget stays embedded in the signed `Tasks.app`, uses the established shared identifiers and App Group, and is validated as a built plug-in before installation. Installation and verification will re-register the current app bundle and refresh WidgetKit/LaunchServices discovery without deleting user widget data. A distinct Mac widget identifier is not introduced because it would break counterpart recognition.

## Risks / Trade-offs

- [iOS may still decline a keyboard request during unusual WebKit lifecycle transitions] -> Keep synchronous focus plus the existing deferred fallback and validate in the native app and touch browser.
- [Visual elasticity can fight native scrolling] -> Activate only at a confirmed boundary, cap displacement, avoid synthetic scroll position changes, and cancel on multi-touch or horizontal gestures.
- [Midnight ordering can collide with concurrent task edits] -> Perform rollover, tail selection, and reached-start ordering inside the existing owner-scoped database function and preserve idempotent owner cursor behavior.
- [Removing hover reveals formerly hidden controls more often] -> Keep only useful actions persistent and remove redundant flourishes; document judgment calls in the completion report.
- [Widget discovery can remain cached by macOS] -> Prove extension embedding and signatures first, then use bounded system registration refresh and verify actual discovery.
- [Active-line link clicks reduce direct pointer placement inside URL text] -> Preserve keyboard arrow navigation as the explicit editing path.

## Migration Plan

1. Ship the web and native-compatible UI changes.
2. If required by the activation implementation, apply one forward-only migration replacing the owner-scoped activation function without rewriting task rows or adding a PowerSync table.
3. Build and test the macOS app and widget with signing disabled, then build with the configured Apple team.
4. Verify the nested extension, App Group, identifiers, and signatures before replacing `/Applications/Tasks.app`.
5. Re-register the verified bundle and confirm the native Mac widget appears alongside the paired iPhone choice.
6. Roll back web behavior by reverting the release. Roll back database behavior by deploying the prior activation function body. Preserve the last verified installed native app if build, signing, or registration validation fails.

## Open Questions

- None. The requested behavior and existing data model provide enough information to implement without additional product decisions.

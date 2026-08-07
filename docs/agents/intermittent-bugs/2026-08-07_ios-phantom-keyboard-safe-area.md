# IB-001 - iOS Phantom Keyboard Safe-area Gap After Task Drag

- **Status**: Monitoring
- **First observed**: 2026 Aug 7
- **Last observed**: 2026 Aug 7
- **Surface**: iOS native Tasks app
- **Frequency**: One known occurrence
- **Current owner**: Unassigned

## User Report

### 2026 Aug 7

> I got this weird effect on iOS native after picking up a task to move it within the order of the today list. It looks like the app was attempting to launch the keyboard and got halfway there. It's a pretty weird effect I've never seen in any other application. Are you aware of anything that might have caused this half-keyboard trigger effect, built into the way we built the native app or the web app? Or perhaps this is an iOS 27 beta problem.
>
> If there are no obvious culprits, I haven't been able to trigger the issue since I first saw it, and it was dismissable by playing around in the UI. So I'm not terribly concerned, but I am a little concerned. Let me know what you think.

## Observed Evidence

- The supplied screenshot was named `Screenshot 2026-08-07 at 6.54.00 AM.png`. The image is referenced by name only and is not copied into this repository.
- The Today list remained visible in the upper portion of the portrait display after a task was picked up for reordering.
- The app's bottom navigation appeared above a large empty black region occupying approximately the lower third of the screen.
- No keyboard keys or keyboard surface were visible in the empty region.
- The visual result is consistent with the layout reserving keyboard-sized space after the keyboard itself was absent.
- The user was able to dismiss the condition by interacting with the UI and could not reproduce it afterward.

## Environment

- **Device**: iPhone model unknown
- **Operating system**: iOS 27 beta, exact build unknown
- **App version/commit**: Unknown
- **Orientation**: Portrait
- **Route**: Today list
- **Relevant accessibility settings**: Unknown

## Investigation

### Verified implementation facts

- [`TasksCompanionApp.swift`](../../../ios/TasksCompanion/TasksCompanion/TasksCompanionApp.swift) applies `.ignoresSafeArea(.container, edges: .bottom)` to the native `TasksWebView`. This ignores the bottom container safe area but continues to observe SwiftUI's separate keyboard safe-area region.
- [`TasksWebView.swift`](../../../ios/TasksCompanion/TasksCompanion/TasksWebView.swift) contains `TasksSummaryKeyboardPresenter`, a native keyboard bridge introduced for reliable New Task Summary focus. It attaches a nearly invisible 1px `UITextField` to the web view and calls `becomeFirstResponder()` when native keyboard activation is requested.
- The native bridge dismisses that capture field when an ordinary web text input is engaged. Its injected `pointerdown` listener posts `web-text-input-engaged` only for `input`, `textarea`, or editable content targets.
- [`TaskImmediateDragHandle.tsx`](../../../src/modules/tasks/components/TaskImmediateDragHandle.tsx) captures the pointer, prevents the default pointer behavior, and stops propagation while dragging. It does not focus a field, request the keyboard, or send a native keyboard-dismiss message.
- Git history places the native Summary keyboard bridge in commit `ed9c828e` from 2026 Jul 28 and the immediate task drag handle in commit `4f8eb7c9` from 2026 Aug 5. The behavior was therefore not introduced by work performed on the day of the report.

### External research

- Apple's [`SafeAreaRegions.keyboard`](https://developer.apple.com/documentation/swiftui/safearearegions/keyboard) documentation identifies the keyboard as its own safe-area region. Apple's [`ignoresSafeArea(_:edges:)`](https://developer.apple.com/documentation/swiftui/view/ignoressafearea%28_%3Aedges%3A%29) documentation explains that SwiftUI normally sizes content to avoid system regions such as the software keyboard.
- An [Apple Developer Forums report](https://developer.apple.com/forums/thread/838726) describes a SwiftUI tab-bar layout remaining above a keyboard safe area even though the target app is not displaying a keyboard. The reporter reproduced the defect in a minimal project and filed Feedback `FB23901879`. This is not proof of the same cause, but it establishes a closely matching platform-level failure mode.
- The iOS 27 beta release notes reviewed on 2026 Aug 7 did not identify this exact stale keyboard safe-area condition. Apple directs developers to Feedback Assistant for beta issues not covered by the release notes.

### Reproduction attempts

- The user continued interacting with the app until the layout recovered.
- The user could not trigger a second occurrence after the initial incident.
- No controlled reproduction or diagnostic logging was available for the first occurrence.

## Assessment

- **Leading hypothesis**: A native or web text input had recently engaged the keyboard, and iOS/SwiftUI retained a stale keyboard safe-area inset during or after the task drag even though the keyboard surface was no longer present.
- **Confidence**: Medium that the empty region was a stale keyboard safe-area inset; low that BathOS's hidden Summary capture field was the specific first responder responsible for it.
- **Plausible BathOS contribution**: Dragging from a handle does not explicitly resign the hidden native capture field because the handle is not a web text-entry target. This could expose a stale responder or keyboard transition if the capture field was already active.
- **Plausible platform contribution**: A closely matching SwiftUI keyboard-safe-area defect has been reproduced independently and reported to Apple. The use of an iOS 27 beta makes a platform regression credible.
- **Not established**: The drag handler itself does not contain a keyboard activation path, so the available source does not support a claim that grabbing a task directly summoned the keyboard.

## Current Disposition

No product code, schema, configuration, or production data was changed. A global `.ignoresSafeArea(.keyboard)` workaround would risk allowing a real keyboard to cover task editors and is not justified by a single non-reproducible occurrence. The case remains in `Monitoring` until another occurrence supplies a reproducible sequence or diagnostic evidence.

## Evidence to Capture on Recurrence

- Exact iPhone model, iOS 27 beta build, app build, and orientation
- Whether New Task, task Summary, Notes, Link, checklist, search, or another text field had been opened immediately beforehand
- Whether the app had just returned from the background or from another app with its keyboard open
- Whether Reduce Motion or Prefer Cross-Fade Transitions is enabled
- The exact drag sequence, including whether the handle or task body was used and whether the drag completed or was canceled
- Whether any keyboard surface appeared before the black region
- Whether rotating the device, opening and dismissing a text field, backgrounding the app, or relaunching clears the condition
- Native Console diagnostics containing `Summary focus completed`, `Accepted: focus-new-task-summary`, or `web-text-input-engaged`
- Keyboard show/hide frame notifications and whether the hidden Summary capture field is the first responder, if temporary diagnostics have been enabled

## Resume Criteria

Resume active investigation if any of the following occurs:

- A second occurrence supplies a repeatable or strongly similar action sequence
- The condition persists across ordinary UI interaction or blocks task use
- Logs show the hidden Summary capture field remains first responder after its editor closes or when a task drag begins
- An iOS update or Apple response identifies a matching safe-area defect and a supported workaround

If the issue recurs, the first bounded diagnostic change should record keyboard frame transitions and the capture field's responder state. If that evidence implicates BathOS, explicitly resign the capture field when New Task closes, when a task drag begins, and when the app becomes active without an editable field. Do not disable keyboard-safe-area handling globally.

## Occurrences

### 2026 Aug 7 - Initial occurrence

- A task drag on the Today list was followed by a keyboard-sized empty region below the app content.
- The user supplied one screenshot and a detailed prompt.
- The layout recovered through further UI interaction and did not recur during immediate follow-up.
- Source review and Apple research found a plausible responder/safe-area interaction, but no confirmed cause.

## Resolution

Not resolved. The case is awaiting recurrence evidence.

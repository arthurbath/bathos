# Tasks Start Picker Design QA

**Date**: 2026 Jul 23

**Status**: Passed after one responsive correction
**Scope**: Unified to-do Start picker in the open editor and to-do action menu

## Visual Truth and Evidence

**Source visual truth**: `/Users/Art/.codex/attachments/19b64303-4535-432d-a94c-d484c3ab3cdc/image-1.png`

The Things screenshot is the structural interaction reference. BathOS intentionally retains its own dark-only visual language, Inter typography, semantic tokens, shared controls, and Lucide icons.

**Desktop implementation**:

- Full view: `/private/tmp/bathos-tasks-start-picker-desktop-final-full.png`
- Picker region: `/private/tmp/bathos-tasks-start-picker-desktop-final.png`
- Combined comparison: `/private/tmp/bathos-tasks-start-picker-comparison-desktop-final.png`
- Browser viewport: 1,280 by 900 CSS px
- Implementation screenshot: 1,280 by 900 px
- Picker region: 320 by 575 CSS px and 320 by 575 screenshot px

**Mobile implementation**:

- Full view after correction: `/private/tmp/bathos-tasks-start-picker-mobile-dialog-revised.png`
- Picker region after correction: `/private/tmp/bathos-tasks-start-picker-mobile-panel-revised.png`
- Combined comparison: `/private/tmp/bathos-tasks-start-picker-comparison-mobile-revised.png`
- Browser viewport: 390 by 844 CSS px
- Implementation screenshot: 390 by 844 px
- Picker region: 320 by 575 CSS px and 320 by 575 screenshot px

**Source normalization**:

- Source screenshot: 566 by 692 px
- Source picker crop: 470 by 575 px
- The combined comparisons align the 575 px picker heights without rescaling either crop
- The source and implementation widths remain different because BathOS uses its established compact popover width

## Compared State

The compared state is an open to-do planned for Today Later with no reminder time. The picker displays Inbox, Now, Next, and Later, the current month, disabled dates through the owner planning date, enabled future dates, the visible Reminder control, and Clear. Later is selected.

## Findings

No actionable P0, P1, or P2 finding remains.

### Fonts and Typography

The implementation uses BathOS Inter typography with the established UI sizes and weights. The source uses Apple's platform typography at a larger scale. This is an intentional visual-system difference rather than drift. Labels, month title, dates, and selected-horizon text remain readable at both tested widths.

### Spacing and Layout Rhythm

The desktop popover is compact, evenly sectioned, and aligned with the Start trigger. The corrected mobile dialog centers the 320 px picker inside the 390 px viewport with 35 px side clearance. The calendar, Reminder control, and Clear action remain fully visible without horizontal clipping or persistent-control overlap.

### Colors and Visual Tokens

The implementation uses BathOS background, foreground, muted, accent, input, border, warning, and info tokens. The source's blue selected fill is intentionally replaced by the established BathOS selected-control treatment. Contrast and hierarchy remain clear in the reviewed states.

### Image Quality, Icons, and Assets

The reference contains no raster content that the Tasks picker needs to reproduce. The implementation uses Lucide Inbox, clock, Bell, Calendar, and X icons according to the BathOS icon policy. No placeholder imagery, CSS artwork, handcrafted SVG, emoji, or approximate image asset was introduced.

### Copy and Content

The visible app-specific text is concise and self-contained: Today, Inbox, Now, Next, Later, Reminder, Clear, and Start. The menu uses Move, Do, Start, and Delete. Cancel, Move Up, Move Down, and When are absent.

### Interaction and Accessibility

- Opening Start from the editor focuses the selected Today horizon
- Command+E opens the same picker and focuses the enabled Reminder Time input
- Escape closes the picker and restores focus to its Start trigger
- Today and earlier calendar dates are disabled, while future dates are enabled
- The picker exposes tabbable horizon, month, navigation, calendar, Reminder, and Clear controls in DOM order
- The action-menu Start command opens the same complete picker in a named dialog
- The 390 by 844 mobile dialog exposes a named Close control and does not clip picker content
- The reviewed browser console contained no errors or warnings

## Full-view and Focused-region Evidence

The desktop and mobile full views establish the picker in the real authenticated Tasks layout, including the open to-do editor, surrounding rows, navigation, and mobile safe area. Focused picker crops were also required because the calendar, disabled dates, selected horizon, reminder field, icon alignment, dividers, and Clear action were too small to judge reliably from full-view evidence alone.

## Comparison History

### Pass 1

**Finding**: P1 mobile horizontal clipping in the action-menu Start dialog

**Evidence**: The first 390 by 844 capture placed the Tasks-specific picker at a negative left offset. The task title lost its first character, and the Today label, Reminder icon, and Clear icon were clipped.

**Cause**: The shared `DialogBody` supplies a negative horizontal margin for ordinary padded dialogs. The Start dialog removed its padding without neutralizing that margin.

**Fix**: The Start dialog now overrides the shared negative margin with `mx-0`, and the Tasks picker centers itself with `mx-auto`.

### Pass 2

**Post-fix evidence**: `/private/tmp/bathos-tasks-start-picker-mobile-dialog-revised.png`

The picker now begins at x 35 and ends at x 355 in the 390 px viewport. The title, Today label, Reminder icon, and Clear icon are complete. The corrected mobile combined comparison contains no remaining P0, P1, or P2 mismatch.

## Primary Interactions Tested

1. Open a to-do and activate the inline Start field
2. Open the to-do ellipsis menu and confirm its exact action structure
3. Open Start from the action menu
4. Invoke Command+E on the selected to-do and confirm Reminder Time receives focus
5. Press Escape and confirm focus returns to Start
6. Inspect calendar enablement across today, past dates, and future dates
7. Render and inspect desktop and mobile picker states
8. Check the browser console for errors and warnings

No task values were changed during rendered QA.

## Implementation Checklist

- [x] Correct the mobile Start dialog offset
- [x] Re-render the same mobile state
- [x] Recreate the focused combined comparison
- [x] Confirm desktop alignment after the correction
- [x] Confirm keyboard shortcut focus and focus restoration
- [x] Confirm menu labels and omitted actions
- [x] Confirm the browser console is clean

## Follow-up Polish

No P3 follow-up is required for the reviewed scope.

final result: passed

## Context

The shared calendar already owns arrow navigation while focus is on calendar controls. The Tasks Start picker composes that calendar with a Reminder text input and an alarm-clock menu button, so a paging chord must be recognized only by calendar controls rather than at the picker-panel level.

## Goals / Non-Goals

**Goals:**

- Provide Shift+Left and Shift+Right paging for day and month calendar pages.
- Keep modified horizontal arrows native in Reminder and other text-entry controls.
- Add an inline, keyboard-accessible Reminder clear action without overlapping the alarm-clock button.
- Clear optimistically while retaining the existing persistence and error-recovery path.

**Non-Goals:**

- Reassign plain arrow navigation.
- Add global or browser-level keyboard interception.
- Change Reminder parsing, scheduling, or database storage.

## Decisions

1. **Handle the paging chord in shared calendar control handlers.** Day cells, month cells, and their matching previous/next pager controls will recognize Shift+Left and Shift+Right. Reminder and other composed controls never see calendar paging logic, so browser-native text selection remains intact. A picker-wide handler was rejected because it would require fragile target exclusions and could steal selection from future text subcontrols.
2. **Preserve selectable-range restrictions through existing paging functions.** The new chord delegates to the same bounded month/year transitions used by pointer and ordinary pager activation.
3. **Place the clear button in the input's trailing add-on before Alarm.** The input group reserves space for both controls, preventing the value and X from sitting beneath Alarm. Pointer-down prevents an input blur commit from racing the clear action.
4. **Clear local display state before awaiting persistence.** This provides instant feedback. On persistence failure, the existing committed display value is restored.

## Risks / Trade-offs

- **Risk: modified arrows accidentally behave like ordinary grid arrows** -> Explicitly exclude modified keys from the ordinary arrow-navigation branch after handling the exact Shift-only paging chord.
- **Risk: clearing races Reminder blur persistence** -> Keep focus within the input group during pointer-down and mark the current value as handled before clearing.
- **Risk: focus is lost after paging** -> Retain or restore focus on the corresponding calendar value or pager using the calendar's existing pending-focus mechanism.

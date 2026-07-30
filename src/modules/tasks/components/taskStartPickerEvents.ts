export const TASK_START_PICKER_OPEN_EVENT = 'bathos:task-start-picker-open';
export const TASK_START_PICKER_ADVANCE_EVENT = 'bathos:task-start-picker-advance';

export type TaskStartPickerFocusTarget = 'start' | 'reminder';

export function requestTaskStartPickerOpen(
  trigger: HTMLElement,
  focusTarget: TaskStartPickerFocusTarget,
): void {
  trigger.dispatchEvent(new CustomEvent<TaskStartPickerFocusTarget>(
    TASK_START_PICKER_OPEN_EVENT,
    { detail: focusTarget },
  ));
}

export function requestTaskStartPickerAdvance(picker: HTMLElement): void {
  picker.dispatchEvent(new CustomEvent(TASK_START_PICKER_ADVANCE_EVENT));
}

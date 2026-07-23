export const TASK_START_PICKER_OPEN_EVENT = 'bathos:task-start-picker-open';

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

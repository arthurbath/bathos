export const TASK_START_PICKER_OPEN_EVENT = 'bathos:task-start-picker-open';
export const TASK_START_PICKER_ADVANCE_EVENT = 'bathos:task-start-picker-advance';
export const TASK_ROW_TEMPORAL_PICKER_OPEN_EVENT = 'bathos:task-row-temporal-picker-open';

export type TaskStartPickerFocusTarget = 'start' | 'reminder';
export type TaskRowTemporalPickerMode = 'start' | 'deadline';

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

export function requestTaskRowTemporalPickerOpen(
  taskId: string,
  mode: TaskRowTemporalPickerMode,
): void {
  window.dispatchEvent(new CustomEvent<{
    taskId: string;
    mode: TaskRowTemporalPickerMode;
  }>(TASK_ROW_TEMPORAL_PICKER_OPEN_EVENT, {
    detail: { taskId, mode },
  }));
}

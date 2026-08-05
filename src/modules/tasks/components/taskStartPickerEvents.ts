import type { TaskTodaySection } from '@/modules/tasks/types/tasks';

export const TASK_START_PICKER_OPEN_EVENT = 'bathos:task-start-picker-open';
export const TASK_START_PICKER_ADVANCE_EVENT = 'bathos:task-start-picker-advance';
export const TASK_START_PICKER_FOCUS_HORIZON_EVENT = 'bathos:task-start-picker-focus-horizon';
export const TASK_START_PICKER_CLOSE_EVENT = 'bathos:task-start-picker-close';
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

export function requestTaskStartPickerFocusHorizon(
  picker: HTMLElement,
  horizon: TaskTodaySection,
): void {
  picker.dispatchEvent(new CustomEvent<TaskTodaySection>(
    TASK_START_PICKER_FOCUS_HORIZON_EVENT,
    { detail: horizon },
  ));
}

export function requestTaskStartPickerClose(picker: HTMLElement): void {
  window.dispatchEvent(new CustomEvent<string>(TASK_START_PICKER_CLOSE_EVENT, {
    detail: picker.dataset.taskStartPickerTaskId ?? '',
  }));
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

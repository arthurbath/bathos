export const TASK_DRAG_HANDLE_VISIBILITIES = [
  'hidden',
  'always',
  'touch_only',
] as const;

export type TaskDragHandleVisibility = typeof TASK_DRAG_HANDLE_VISIBILITIES[number];

export function sanitizeTaskDragHandleVisibility(
  value: unknown,
): TaskDragHandleVisibility {
  return TASK_DRAG_HANDLE_VISIBILITIES.includes(value as TaskDragHandleVisibility)
    ? value as TaskDragHandleVisibility
    : 'hidden';
}

export function shouldShowTaskDragHandles(
  visibility: TaskDragHandleVisibility,
  touchCapable: boolean,
): boolean {
  return visibility === 'always' || (visibility === 'touch_only' && touchCapable);
}

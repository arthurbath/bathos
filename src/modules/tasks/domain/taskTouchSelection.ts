export const TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX = 48;
export const TASK_TOUCH_SELECTION_HORIZONTAL_RATIO = 1.25;
export const TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX = 24;

export type TaskTouchSelectionGesture = {
  pointerType: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  viewportWidth: number;
};

export type TaskTouchSwipeDirection = 'left' | 'right';

export function getTaskTouchSwipeDirection({
  pointerType,
  startX,
  startY,
  endX,
  endY,
  viewportWidth,
}: TaskTouchSelectionGesture): TaskTouchSwipeDirection | null {
  if (pointerType !== 'touch') return null;
  if (
    startX <= TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX
    || startX >= viewportWidth - TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX
  ) {
    return null;
  }

  const signedHorizontalDistance = endX - startX;
  const horizontalDistance = Math.abs(signedHorizontalDistance);
  const verticalDistance = Math.abs(endY - startY);
  if (
    horizontalDistance < TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX
    || horizontalDistance < verticalDistance * TASK_TOUCH_SELECTION_HORIZONTAL_RATIO
  ) {
    return null;
  }
  return signedHorizontalDistance < 0 ? 'left' : 'right';
}

export function isTaskTouchSelectionSwipe(
  gesture: TaskTouchSelectionGesture,
): boolean {
  return getTaskTouchSwipeDirection(gesture) === 'left';
}

export function getTaskTouchSwipeOffset(
  horizontalDistance: number,
  verticalDistance: number,
): number {
  if (
    Math.abs(horizontalDistance) < 6
    || Math.abs(horizontalDistance)
      < Math.abs(verticalDistance) * TASK_TOUCH_SELECTION_HORIZONTAL_RATIO
  ) {
    return 0;
  }
  const damped = horizontalDistance * 0.78;
  return Math.max(-76, Math.min(76, damped));
}

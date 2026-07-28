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

export function isTaskTouchSelectionSwipe({
  pointerType,
  startX,
  startY,
  endX,
  endY,
  viewportWidth,
}: TaskTouchSelectionGesture): boolean {
  if (pointerType !== 'touch') return false;
  if (
    startX <= TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX
    || startX >= viewportWidth - TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX
  ) {
    return false;
  }

  const horizontalDistance = startX - endX;
  const verticalDistance = Math.abs(endY - startY);
  return horizontalDistance >= TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX
    && horizontalDistance >= verticalDistance * TASK_TOUCH_SELECTION_HORIZONTAL_RATIO;
}

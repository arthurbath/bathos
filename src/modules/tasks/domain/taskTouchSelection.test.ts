import { describe, expect, it } from 'vitest';

import {
  getTaskTouchSwipeDirection,
  getTaskTouchSwipeOffset,
  isTaskTouchSelectionSwipe,
  TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX,
  TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX,
} from './taskTouchSelection';

const qualifyingGesture = {
  pointerType: 'touch',
  startX: 200,
  startY: 100,
  endX: 200 - TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX,
  endY: 100,
  viewportWidth: 390,
};

describe('task touch selection gesture', () => {
  it('accepts a qualifying leftward touch swipe', () => {
    expect(isTaskTouchSelectionSwipe(qualifyingGesture)).toBe(true);
    expect(getTaskTouchSwipeDirection(qualifyingGesture)).toBe('left');
  });

  it('recognizes the symmetric rightward scheduling swipe', () => {
    expect(getTaskTouchSwipeDirection({
      ...qualifyingGesture,
      endX: qualifyingGesture.startX + TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX,
    })).toBe('right');
  });

  it.each(['mouse', 'pen'])('ignores %s pointer movement', (pointerType) => {
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      pointerType,
    })).toBe(false);
  });

  it('rejects short and vertically dominant touch movement', () => {
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      endX: qualifyingGesture.startX - TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX + 1,
    })).toBe(false);
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      endY: qualifyingGesture.startY + 40,
    })).toBe(false);
  });

  it('preserves gestures that begin at either viewport edge', () => {
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      startX: TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX,
      endX: -40,
    })).toBe(false);
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      startX: qualifyingGesture.viewportWidth
        - TASK_TOUCH_SELECTION_VIEWPORT_EDGE_PX,
      endX: 250,
    })).toBe(false);
  });

  it('damps and clamps responsive row translation after horizontal intent wins', () => {
    expect(getTaskTouchSwipeOffset(40, 2)).toBeCloseTo(31.2);
    expect(getTaskTouchSwipeOffset(-200, 2)).toBe(-76);
    expect(getTaskTouchSwipeOffset(20, 30)).toBe(0);
  });
});

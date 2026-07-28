import { describe, expect, it } from 'vitest';

import {
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
  });

  it.each(['mouse', 'pen'])('ignores %s pointer movement', (pointerType) => {
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      pointerType,
    })).toBe(false);
  });

  it('rejects short, rightward, and vertically dominant touch movement', () => {
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      endX: qualifyingGesture.startX - TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX + 1,
    })).toBe(false);
    expect(isTaskTouchSelectionSwipe({
      ...qualifyingGesture,
      endX: qualifyingGesture.startX + TASK_TOUCH_SELECTION_SWIPE_DISTANCE_PX,
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
});

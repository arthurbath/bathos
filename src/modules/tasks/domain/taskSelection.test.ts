import { describe, expect, it } from 'vitest';

import {
  applyTaskSelectionGesture,
  isMacLikeTaskPlatform,
  type TaskSelectionState,
} from './taskSelection';

const inactive = (): TaskSelectionState => ({
  active: false,
  anchorId: null,
  selectedIds: new Set(),
});

describe('task selection gestures', () => {
  it('leaves an ordinary inactive click available for task expansion', () => {
    expect(applyTaskSelectionGesture(inactive(), {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })).toBeNull();
  });

  it('enters with the platform modifier and toggles ordinary clicks afterward', () => {
    const entered = applyTaskSelectionGesture(inactive(), {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect(entered.anchorId).toBe('b');
    expect([...entered.selectedIds]).toEqual(['b']);

    const toggled = applyTaskSelectionGesture(entered, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect([...toggled.selectedIds]).toEqual(['b', 'c']);
  });

  it('replaces repeated Shift-click ranges from the original anchor', () => {
    const entered = applyTaskSelectionGesture(inactive(), {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c', 'd', 'e'],
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      macLikePlatform: false,
    })!;
    const firstRange = applyTaskSelectionGesture(entered, {
      taskId: 'e',
      visibleTaskIds: ['a', 'b', 'c', 'd', 'e'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: true,
      macLikePlatform: false,
    })!;
    expect([...firstRange.selectedIds]).toEqual(['b', 'c', 'd', 'e']);

    const replacementRange = applyTaskSelectionGesture(firstRange, {
      taskId: 'a',
      visibleTaskIds: ['a', 'b', 'c', 'd', 'e'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: true,
      macLikePlatform: false,
    })!;
    expect(replacementRange.anchorId).toBe('b');
    expect([...replacementRange.selectedIds]).toEqual(['a', 'b']);
  });

  it('detects Mac-like platforms without treating Windows as Mac', () => {
    expect(isMacLikeTaskPlatform('MacIntel')).toBe(true);
    expect(isMacLikeTaskPlatform('iPhone')).toBe(true);
    expect(isMacLikeTaskPlatform('Win32')).toBe(false);
  });
});

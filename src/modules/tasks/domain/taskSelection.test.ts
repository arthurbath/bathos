import { describe, expect, it } from 'vitest';

import {
  applyTaskSelectionGesture,
  isMacLikeTaskPlatform,
  type TaskSelectionState,
} from './taskSelection';

const inactive = (): TaskSelectionState => ({
  active: false,
  anchorId: null,
  focusedId: null,
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

  it('establishes single-task focus without entering bulk mode', () => {
    const focused = applyTaskSelectionGesture(inactive(), {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect(focused).toEqual({
      active: false,
      anchorId: 'b',
      focusedId: 'b',
      selectedIds: new Set(),
    });

    const selected = applyTaskSelectionGesture(focused, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect(selected.active).toBe(true);
    expect(selected.focusedId).toBeNull();
    expect([...selected.selectedIds]).toEqual(['b', 'c']);
  });

  it('leaves an ordinary click on another task available for opening', () => {
    expect(applyTaskSelectionGesture({
      active: false,
      anchorId: 'b',
      focusedId: 'b',
      selectedIds: new Set(),
    }, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })).toBeNull();
  });

  it('clears focus when the sole focused task receives the modifier gesture again', () => {
    const focused: TaskSelectionState = {
      active: false,
      anchorId: 'b',
      focusedId: 'b',
      selectedIds: new Set(),
    };

    expect(applyTaskSelectionGesture(focused, {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })).toEqual(inactive());
  });

  it('collapses multi-selection back to single-task focus and then clears it', () => {
    const selected: TaskSelectionState = {
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b', 'c']),
    };

    const collapsed = applyTaskSelectionGesture(selected, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect(collapsed).toEqual({
      active: false,
      anchorId: 'b',
      focusedId: 'b',
      selectedIds: new Set(),
    });

    expect(applyTaskSelectionGesture(collapsed, {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })).toEqual(inactive());
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
    expect(firstRange.focusedId).toBeNull();

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

  it('uses the first Shift-click as a single focus anchor', () => {
    expect(applyTaskSelectionGesture(inactive(), {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: true,
      macLikePlatform: true,
    })).toEqual({
      active: false,
      anchorId: 'c',
      focusedId: 'c',
      selectedIds: new Set(),
    });
  });

  it('detects Mac-like platforms without treating Windows as Mac', () => {
    expect(isMacLikeTaskPlatform('MacIntel')).toBe(true);
    expect(isMacLikeTaskPlatform('iPhone')).toBe(true);
    expect(isMacLikeTaskPlatform('Win32')).toBe(false);
  });
});

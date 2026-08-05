import { describe, expect, it } from 'vitest';

import {
  applyTaskSelectionGesture,
  isMacControlTaskSelectionPointer,
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

  it('enters explicit selection mode for the first modified click', () => {
    const selected = applyTaskSelectionGesture(inactive(), {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect(selected).toEqual({
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b']),
    });
  });

  it('enters explicit selection mode for a Mac Control-click', () => {
    const selected = applyTaskSelectionGesture(inactive(), {
      taskId: 'b',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      macLikePlatform: true,
    });

    expect(selected).toEqual({
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b']),
    });
  });

  it('replaces prior keyboard focus when a later modified click starts selection', () => {
    const selected = applyTaskSelectionGesture({
      active: false,
      anchorId: 'b',
      focusedId: 'b',
      selectedIds: new Set(),
    }, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
    })!;
    expect(selected.active).toBe(true);
    expect(selected.focusedId).toBeNull();
    expect(selected.anchorId).toBe('c');
    expect([...selected.selectedIds]).toEqual(['c']);
  });

  it('can preserve a focused item when a nested collection activates selection', () => {
    const selected = applyTaskSelectionGesture({
      active: false,
      anchorId: 'a',
      focusedId: 'a',
      selectedIds: new Set(),
    }, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      macLikePlatform: true,
      includeFocusedOnActivation: true,
    })!;
    expect([...selected.selectedIds]).toEqual(['a', 'c']);
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

  it('promotes the sole keyboard-focused task into explicit selection', () => {
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
    })).toEqual({
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b']),
    });
  });

  it('retains selection mode with one remaining task and clears it at zero', () => {
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
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b']),
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

  it('toggles active Mac selection with Control-click', () => {
    const selected: TaskSelectionState = {
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b']),
    };

    expect(applyTaskSelectionGesture(selected, {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      macLikePlatform: true,
    })).toEqual({
      active: true,
      anchorId: 'b',
      focusedId: null,
      selectedIds: new Set(['b', 'c']),
    });
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

  it('uses the first Shift-click as a one-task explicit selection anchor', () => {
    expect(applyTaskSelectionGesture(inactive(), {
      taskId: 'c',
      visibleTaskIds: ['a', 'b', 'c'],
      metaKey: false,
      ctrlKey: false,
      shiftKey: true,
      macLikePlatform: true,
    })).toEqual({
      active: true,
      anchorId: 'c',
      focusedId: null,
      selectedIds: new Set(['c']),
    });
  });

  it('detects Mac-like platforms without treating Windows as Mac', () => {
    expect(isMacLikeTaskPlatform('MacIntel')).toBe(true);
    expect(isMacLikeTaskPlatform('iPhone')).toBe(true);
    expect(isMacLikeTaskPlatform('Win32')).toBe(false);
  });

  it('recognizes only Mac Control-left-click as the pointer interception gesture', () => {
    expect(isMacControlTaskSelectionPointer({
      macLikePlatform: true,
      ctrlKey: true,
      button: 0,
    })).toBe(true);
    expect(isMacControlTaskSelectionPointer({
      macLikePlatform: false,
      ctrlKey: true,
      button: 0,
    })).toBe(false);
    expect(isMacControlTaskSelectionPointer({
      macLikePlatform: true,
      ctrlKey: true,
      button: 2,
    })).toBe(false);
  });
});

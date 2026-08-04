import { describe, expect, it, vi } from 'vitest';

import { reducer } from './use-toast';

describe('shared toast state', () => {
  it('retains simultaneous toasts instead of evicting the prior toast', () => {
    const first = { id: 'first', open: true };
    const second = { id: 'second', open: true };
    const state = reducer({ toasts: [first] }, {
      type: 'ADD_TOAST',
      toast: second,
    });

    expect(state.toasts.map(({ id }) => id)).toEqual(['second', 'first']);
  });

  it('dismisses only the requested toast in a stack', () => {
    vi.useFakeTimers();
    try {
      const state = reducer({
        toasts: [
          { id: 'second', open: true },
          { id: 'first', open: true },
        ],
      }, {
        type: 'DISMISS_TOAST',
        toastId: 'first',
      });

      expect(state.toasts).toEqual([
        { id: 'second', open: true },
        { id: 'first', open: false },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

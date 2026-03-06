import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PullToRefresh,
  PULL_TO_REFRESH_TRIGGER_DISTANCE,
} from '@/components/PullToRefresh';

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('PullToRefresh', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      })),
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('does not refresh for short pulls', () => {
    const onRefresh = vi.fn();
    const { container, root } = mount(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Content</div>
      </PullToRefresh>,
    );

    try {
      const wrapper = container.firstElementChild as HTMLElement;

      act(() => {
        wrapper.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true,
          touches: [{ clientY: 0 } as Touch],
        }));
        wrapper.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true,
          touches: [{ clientY: 250 } as Touch],
        }));
      });
      act(() => {
        wrapper.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      });

      expect(onRefresh).not.toHaveBeenCalled();
    } finally {
      unmount(root, container);
    }
  });

  it('refreshes only after a larger pull distance', () => {
    const onRefresh = vi.fn();
    const { container, root } = mount(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Content</div>
      </PullToRefresh>,
    );

    try {
      const wrapper = container.firstElementChild as HTMLElement;

      act(() => {
        wrapper.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true,
          touches: [{ clientY: 0 } as Touch],
        }));
        wrapper.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true,
          touches: [{ clientY: PULL_TO_REFRESH_TRIGGER_DISTANCE / 0.4 } as Touch],
        }));
      });
      act(() => {
        wrapper.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });
});

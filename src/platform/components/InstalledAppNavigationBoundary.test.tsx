import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstalledAppNavigationBoundary } from '@/platform/components/InstalledAppNavigationBoundary';

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <>
        <InstalledAppNavigationBoundary />
        <a href="/tasks/config">Tasks Settings</a>
        <a href="/budget/summary">Budget</a>
        <a href="https://example.test/read">External</a>
      </>,
    );
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('InstalledAppNavigationBoundary', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: true,
    });
    window.history.replaceState(null, '', '/tasks/today');
    sessionStorage.clear();
  });

  it('keeps same-module links internal and opens cross-module and external links outside', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { container, root } = mount();

    try {
      const [tasks, budget, external] = Array.from(container.querySelectorAll('a'));
      tasks.addEventListener('click', (event) => event.preventDefault());
      tasks.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(open).not.toHaveBeenCalled();

      expect(budget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
      expect(external.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
      expect(open).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/budget/summary'),
        '_blank',
        'noopener,noreferrer',
      );
      expect(open).toHaveBeenNthCalledWith(
        2,
        'https://example.test/read',
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      open.mockRestore();
      cleanup(root, container);
    }
  });
});

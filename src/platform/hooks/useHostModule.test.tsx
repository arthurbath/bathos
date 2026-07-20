import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useHostModule } from '@/platform/hooks/useHostModule';

function HostModuleHarness() {
  return <div data-testid="module-id">{useHostModule() ?? 'none'}</div>;
}

function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<HostModuleHarness />);
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('useHostModule', () => {
  it('detects the wardrobe module from the URL path', () => {
    window.history.replaceState({}, '', '/wardrobe/items');

    const { container, root } = renderHarness();
    try {
      expect(container.querySelector('[data-testid="module-id"]')?.textContent).toBe('wardrobe');
    } finally {
      cleanup(root, container);
    }
  });

  it('detects the snake module from the URL path', () => {
    window.history.replaceState({}, '', '/snake/weights');

    const { container, root } = renderHarness();
    try {
      expect(container.querySelector('[data-testid="module-id"]')?.textContent).toBe('snake');
    } finally {
      cleanup(root, container);
    }
  });

  it('detects the tasks module from the URL path', () => {
    window.history.replaceState({}, '', '/tasks/today');

    const { container, root } = renderHarness();
    try {
      expect(container.querySelector('[data-testid="module-id"]')?.textContent).toBe('tasks');
    } finally {
      cleanup(root, container);
    }
  });

  it('returns none for retired module paths', () => {
    window.history.replaceState({}, '', '/corpus/documents');

    const { container, root } = renderHarness();
    try {
      expect(container.querySelector('[data-testid="module-id"]')?.textContent).toBe('none');
    } finally {
      cleanup(root, container);
    }
  });
});

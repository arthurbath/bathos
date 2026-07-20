import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { useTaskSearch } from './useTaskSearch';

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

let latest: ReturnType<typeof useTaskSearch>;

function Harness() {
  latest = useTaskSearch('owner-a', true);
  return null;
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('useTaskSearch', () => {
  it('queries all present owner tasks for local cross-view search', () => {
    mocks.useQuery.mockReturnValue({
      data: [{ id: 'task-a' }],
      isLoading: false,
      error: null,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => root.render(<Harness />));
      expect(mocks.useQuery).toHaveBeenCalledWith(
        expect.stringContaining("disposition = 'present'"),
        ['owner-a', 1],
      );
      expect(mocks.useQuery.mock.calls[0]?.[0]).toContain('ORDER BY updated_at DESC, id');
      expect(latest).toEqual({
        tasks: [{ id: 'task-a' }],
        loading: false,
        error: null,
      });
    } finally {
      cleanup(root, container);
    }
  });
});

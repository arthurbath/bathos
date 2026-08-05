import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskDragHandleVisibility } from './useTaskDragHandleVisibility';

const useQueryMock = vi.fn();
const setDragHandleVisibility = vi.fn();

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => ({
    repository: { setDragHandleVisibility },
  }),
}));

function Harness() {
  const preference = useTaskDragHandleVisibility('owner-a');
  return (
    <div>
      <output data-testid="visibility">{preference.visibility}</output>
      <output data-testid="pending">{String(preference.pending)}</output>
      <button type="button" onClick={() => void preference.setVisibility('touch_only')}>
        Touch Only
      </button>
    </div>
  );
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Harness />));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('useTaskDragHandleVisibility', () => {
  beforeEach(() => {
    useQueryMock.mockReset().mockReturnValue({
      data: [{ drag_handle_visibility: 'hidden' }],
      isLoading: false,
      error: null,
    });
    setDragHandleVisibility.mockReset().mockResolvedValue(undefined);
  });

  it('updates the durable preference optimistically', async () => {
    const { container, root } = mount();
    try {
      expect(container.querySelector('[data-testid="visibility"]')).toHaveTextContent('hidden');
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')?.click();
        await Promise.resolve();
      });
      expect(setDragHandleVisibility).toHaveBeenCalledWith('owner-a', 'touch_only');
      expect(container.querySelector('[data-testid="visibility"]'))
        .toHaveTextContent('touch_only');
    } finally {
      cleanup(root, container);
    }
  });
});

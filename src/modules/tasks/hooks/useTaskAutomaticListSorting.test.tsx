import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskAutomaticListSorting } from './useTaskAutomaticListSorting';

const useQueryMock = vi.fn();
const setAutomaticListSorting = vi.fn();

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => ({
    repository: { setAutomaticListSorting },
  }),
}));

function Harness() {
  const preference = useTaskAutomaticListSorting('owner-a');
  return (
    <div>
      <output data-testid="enabled">{String(preference.enabled)}</output>
      <output data-testid="pending">{String(preference.pending)}</output>
      <button type="button" onClick={() => void preference.setEnabled(true)}>Enable</button>
      <button type="button" onClick={() => void preference.setEnabled(false)}>Disable</button>
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

describe('useTaskAutomaticListSorting', () => {
  beforeEach(() => {
    useQueryMock.mockReset().mockReturnValue({
      data: [{ automatic_list_sorting: 0 }],
      isLoading: false,
      error: null,
    });
    setAutomaticListSorting.mockReset().mockResolvedValue(undefined);
  });

  it('defaults the synchronized preference to off and enables optimistically', async () => {
    const { container, root } = mount();
    try {
      expect(container.querySelector('[data-testid="enabled"]')).toHaveTextContent('false');
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')?.click();
        await Promise.resolve();
      });
      expect(setAutomaticListSorting).toHaveBeenCalledWith('owner-a', true);
      expect(container.querySelector('[data-testid="enabled"]')).toHaveTextContent('true');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps sorting enabled until disable materialization succeeds', async () => {
    useQueryMock.mockReturnValue({
      data: [{ automatic_list_sorting: 1 }],
      isLoading: false,
      error: null,
    });
    let resolveDisable!: () => void;
    setAutomaticListSorting.mockReturnValue(new Promise<void>((resolve) => {
      resolveDisable = resolve;
    }));
    const { container, root } = mount();
    try {
      const buttons = container.querySelectorAll<HTMLButtonElement>('button');
      act(() => buttons[1]?.click());
      expect(container.querySelector('[data-testid="enabled"]')).toHaveTextContent('true');
      expect(container.querySelector('[data-testid="pending"]')).toHaveTextContent('true');

      await act(async () => {
        resolveDisable();
        await Promise.resolve();
      });
      expect(container.querySelector('[data-testid="enabled"]')).toHaveTextContent('false');
      expect(container.querySelector('[data-testid="pending"]')).toHaveTextContent('false');
    } finally {
      cleanup(root, container);
    }
  });
});

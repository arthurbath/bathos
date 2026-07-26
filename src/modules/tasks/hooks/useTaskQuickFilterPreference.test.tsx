import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskQuickFilterPreference } from '@/modules/tasks/hooks/useTaskQuickFilterPreference';

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

const queryBuilder = {
  select: (...args: unknown[]) => selectMock(...args),
  eq: (...args: unknown[]) => eqMock(...args),
  maybeSingle: (...args: unknown[]) => maybeSingleMock(...args),
  upsert: (...args: unknown[]) => upsertMock(...args),
};

selectMock.mockImplementation(() => queryBuilder);
eqMock.mockImplementation(() => queryBuilder);
fromMock.mockImplementation(() => queryBuilder);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('@/lib/supabaseRequest', () => ({
  supabaseRequest: async <T,>(operation: () => Promise<{ data: T; error: unknown }>) => {
    const result = await operation();
    if (result.error) throw result.error;
    return result.data;
  },
}));

function HookHarness({ userId = 'user-1' }: { userId?: string }) {
  const { filter, setFilter } = useTaskQuickFilterPreference(userId);
  return (
    <div>
      <output data-testid="filter">{filter}</output>
      <button type="button" onClick={() => setFilter('waiting')}>Waiting</button>
    </div>
  );
}

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function readFilter(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="filter"]')?.textContent ?? null;
}

describe('useTaskQuickFilterPreference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null });
    upsertMock.mockReset().mockResolvedValue({ data: null, error: null });
    selectMock.mockClear();
    eqMock.mockClear();
    fromMock.mockClear();
  });

  it('starts with All Tasks when no preference exists', async () => {
    const { container, root } = mount(<HookHarness />);
    try {
      expect(readFilter(container)).toBe('all');
      await flushUi();
      expect(upsertMock).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('sanitizes an unknown cached value to All Tasks', () => {
    window.localStorage.setItem('bathos_tasks_quick_filter:user-1', JSON.stringify({
      value: 'blocked',
      updatedAt: '2026-07-25T10:00:00.000Z',
    }));
    const { container, root } = mount(<HookHarness />);
    try {
      expect(readFilter(container)).toBe('all');
    } finally {
      cleanup(root, container);
    }
  });

  it('uses a newer database preference and updates the local cache', async () => {
    window.localStorage.setItem('bathos_tasks_quick_filter:user-1', JSON.stringify({
      value: 'waiting',
      updatedAt: '2026-07-25T10:00:00.000Z',
    }));
    maybeSingleMock.mockResolvedValue({
      data: {
        tasks_quick_filter: 'rechecking',
        tasks_quick_filter_updated_at: '2026-07-25T11:00:00.000Z',
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      expect(readFilter(container)).toBe('waiting');
      await flushUi();
      expect(readFilter(container)).toBe('rechecking');
      expect(window.localStorage.getItem('bathos_tasks_quick_filter:user-1'))
        .toContain('2026-07-25T11:00:00.000Z');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps and promotes a newer cached preference', async () => {
    window.localStorage.setItem('bathos_tasks_quick_filter:user-1', JSON.stringify({
      value: 'non_actionable',
      updatedAt: '2026-07-25T12:00:00.000Z',
    }));
    maybeSingleMock.mockResolvedValue({
      data: {
        tasks_quick_filter: 'actionable',
        tasks_quick_filter_updated_at: '2026-07-25T11:00:00.000Z',
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();
      expect(readFilter(container)).toBe('non_actionable');
      expect(upsertMock).toHaveBeenCalledWith(
        [expect.objectContaining({
          user_id: 'user-1',
          tasks_quick_filter: 'non_actionable',
          tasks_quick_filter_updated_at: '2026-07-25T12:00:00.000Z',
        })],
        { onConflict: 'user_id' },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('persists a user change immediately', async () => {
    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')?.click();
        await Promise.resolve();
      });

      expect(readFilter(container)).toBe('waiting');
      expect(window.localStorage.getItem('bathos_tasks_quick_filter:user-1'))
        .toContain('"value":"waiting"');
      expect(upsertMock).toHaveBeenCalledWith(
        [expect.objectContaining({
          user_id: 'user-1',
          tasks_quick_filter: 'waiting',
        })],
        { onConflict: 'user_id' },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('reconciles cross-tab storage changes and focus or online recovery', async () => {
    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();
      const initialReads = maybeSingleMock.mock.calls.length;
      window.localStorage.setItem('bathos_tasks_quick_filter:user-1', JSON.stringify({
        value: 'actionable',
        updatedAt: '2026-07-25T13:00:00.000Z',
      }));
      await act(async () => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'bathos_tasks_quick_filter:user-1',
        }));
        await Promise.resolve();
      });
      expect(readFilter(container)).toBe('actionable');

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
        await Promise.resolve();
      });
      expect(maybeSingleMock.mock.calls.length).toBeGreaterThan(initialReads);
    } finally {
      cleanup(root, container);
    }
  });
});

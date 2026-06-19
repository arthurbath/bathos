import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SortingState } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGridViewPreferences } from '@/hooks/useGridViewPreferences';

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

interface SummaryFilters {
  hideFullSplits: boolean;
}

const DEFAULT_FILTERS: SummaryFilters = { hideFullSplits: false };
const DEFAULT_SORTING: SortingState = [{ id: 'name', desc: false }];

function HookHarness({ userId = 'user-1' }: { userId?: string }) {
  const {
    filters,
    setFilters,
    sorting,
    setSorting,
  } = useGridViewPreferences<SummaryFilters>({
    userId,
    gridKey: 'summary',
    defaultFilters: DEFAULT_FILTERS,
    defaultSorting: DEFAULT_SORTING,
  });

  return (
    <div>
      <div
        data-testid="state"
        data-hide-full-splits={String(filters.hideFullSplits)}
        data-sort-id={sorting[0]?.id ?? ''}
        data-sort-desc={String(sorting[0]?.desc ?? false)}
      />
      <button
        type="button"
        data-testid="set-filters"
        onClick={() => setFilters({ hideFullSplits: true })}
      >
        Filter
      </button>
      <button
        type="button"
        data-testid="set-sorting"
        onClick={() => setSorting([{ id: 'monthly', desc: true }])}
      >
        Sort
      </button>
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

function getState(container: HTMLElement) {
  const state = container.querySelector<HTMLElement>('[data-testid="state"]');
  expect(state).toBeTruthy();
  return state as HTMLElement;
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useGridViewPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    maybeSingleMock.mockReset();
    upsertMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    fromMock.mockClear();
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_view_preferences: {},
      },
      error: null,
    });
    upsertMock.mockResolvedValue({ data: null, error: null });
  });

  it('uses cached local preferences before loading database preferences', () => {
    window.localStorage.setItem(
      'bathos_grid_view_preferences:user-1',
      JSON.stringify({
        summary: {
          filters: {
            value: { hideFullSplits: true },
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
          sorting: {
            value: [{ id: 'monthly', desc: true }],
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        },
      }),
    );

    const { container, root } = mount(<HookHarness />);
    try {
      const state = getState(container);
      expect(state.getAttribute('data-hide-full-splits')).toBe('true');
      expect(state.getAttribute('data-sort-id')).toBe('monthly');
      expect(state.getAttribute('data-sort-desc')).toBe('true');
    } finally {
      cleanup(root, container);
    }
  });

  it('overrides cached preferences when the database version is newer', async () => {
    window.localStorage.setItem(
      'bathos_grid_view_preferences:user-1',
      JSON.stringify({
        summary: {
          filters: {
            value: { hideFullSplits: false },
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
          sorting: {
            value: [{ id: 'name', desc: false }],
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        },
      }),
    );
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_view_preferences: {
          summary: {
            filters: {
              value: { hideFullSplits: true },
              updatedAt: '2026-06-02T00:00:00.000Z',
            },
            sorting: {
              value: [{ id: 'monthly', desc: true }],
              updatedAt: '2026-06-02T00:00:00.000Z',
            },
          },
        },
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();

      const state = getState(container);
      expect(state.getAttribute('data-hide-full-splits')).toBe('true');
      expect(state.getAttribute('data-sort-id')).toBe('monthly');
      expect(state.getAttribute('data-sort-desc')).toBe('true');
      expect(window.localStorage.getItem('bathos_grid_view_preferences:user-1')).toContain('2026-06-02T00:00:00.000Z');
    } finally {
      cleanup(root, container);
    }
  });

  it('keeps cached preferences and syncs them when the database version is older', async () => {
    window.localStorage.setItem(
      'bathos_grid_view_preferences:user-1',
      JSON.stringify({
        summary: {
          filters: {
            value: { hideFullSplits: true },
            updatedAt: '2026-06-02T00:00:00.000Z',
          },
          sorting: {
            value: [{ id: 'monthly', desc: true }],
            updatedAt: '2026-06-02T00:00:00.000Z',
          },
        },
      }),
    );
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_view_preferences: {
          summary: {
            filters: {
              value: { hideFullSplits: false },
              updatedAt: '2026-06-01T00:00:00.000Z',
            },
            sorting: {
              value: [{ id: 'name', desc: false }],
              updatedAt: '2026-06-01T00:00:00.000Z',
            },
          },
        },
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();

      const state = getState(container);
      expect(state.getAttribute('data-hide-full-splits')).toBe('true');
      expect(state.getAttribute('data-sort-id')).toBe('monthly');
      expect(state.getAttribute('data-sort-desc')).toBe('true');
      expect(upsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 'user-1',
            grid_view_preferences: expect.objectContaining({
              summary: expect.objectContaining({
                filters: expect.objectContaining({
                  updatedAt: '2026-06-02T00:00:00.000Z',
                }),
              }),
            }),
          }),
        ]),
        { onConflict: 'user_id' },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('persists user changes to local storage and Supabase', async () => {
    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();

      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-testid="set-filters"]')?.click();
        await Promise.resolve();
      });
      await act(async () => {
        container.querySelector<HTMLButtonElement>('[data-testid="set-sorting"]')?.click();
        await Promise.resolve();
      });

      const state = getState(container);
      expect(state.getAttribute('data-hide-full-splits')).toBe('true');
      expect(state.getAttribute('data-sort-id')).toBe('monthly');
      expect(state.getAttribute('data-sort-desc')).toBe('true');
      expect(window.localStorage.getItem('bathos_grid_view_preferences:user-1')).toContain('hideFullSplits');
      expect(upsertMock).toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });
});

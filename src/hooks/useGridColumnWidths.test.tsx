import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGridColumnWidths } from '@/hooks/useGridColumnWidths';
import { writeCachedDefaultGridColumnWidthsOnly } from '@/lib/gridColumnWidthPreferences';

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
  const defaults = React.useMemo(() => ({ name: 220, amount: 140, actions: 40 }), []);
  const fixedColumnIds = React.useMemo(() => ['actions'], []);
  const {
    columnSizing,
    columnResizingEnabled,
    onColumnSizingChange,
    onColumnSizingInfoChange,
  } = useGridColumnWidths({
    userId,
    gridKey: 'summary',
    defaults,
    fixedColumnIds,
  });

  return (
    <div>
      <div
        data-testid="state"
        data-name-width={String(columnSizing.name)}
        data-amount-width={String(columnSizing.amount)}
        data-actions-width={String(columnSizing.actions)}
        data-column-resizing-enabled={String(columnResizingEnabled)}
      />
      <button
        type="button"
        data-testid="resize-name"
        onClick={() => {
          onColumnSizingChange(() => ({ name: 500 }));
          onColumnSizingInfoChange(() => ({
            startOffset: null,
            startSize: null,
            deltaOffset: null,
            deltaPercentage: null,
            isResizingColumn: 'name',
            columnSizingStart: [],
          }));
          onColumnSizingInfoChange(() => ({
            startOffset: null,
            startSize: null,
            deltaOffset: null,
            deltaPercentage: null,
            isResizingColumn: false,
            columnSizingStart: [],
          }));
        }}
      >
        Resize
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

describe('useGridColumnWidths', () => {
  beforeEach(() => {
    window.localStorage.clear();
    maybeSingleMock.mockReset();
    upsertMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    fromMock.mockClear();
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_column_widths: {},
        use_default_grid_column_widths: false,
      },
      error: null,
    });
    upsertMock.mockResolvedValue({ data: null, error: null });
  });

  it('uses default widths and disables resizing when default-width mode is cached or saved', async () => {
    window.localStorage.setItem(
      'bathos_grid_column_widths:user-1',
      JSON.stringify({
        summary: { name: 480, amount: 260, actions: 40 },
      }),
    );
    writeCachedDefaultGridColumnWidthsOnly('user-1', true);
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_column_widths: {
          summary: { name: 640, amount: 320, actions: 40 },
        },
        use_default_grid_column_widths: true,
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();

      const state = getState(container);
      expect(state.getAttribute('data-name-width')).toBe('220');
      expect(state.getAttribute('data-amount-width')).toBe('140');
      expect(state.getAttribute('data-actions-width')).toBe('40');
      expect(state.getAttribute('data-column-resizing-enabled')).toBe('false');
    } finally {
      cleanup(root, container);
    }
  });

  it('does not persist resized widths while default-width mode is enabled', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_column_widths: {
          summary: { name: 360, amount: 200, actions: 40 },
        },
        use_default_grid_column_widths: true,
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();

      await act(async () => {
        const button = container.querySelector<HTMLButtonElement>('[data-testid="resize-name"]');
        expect(button).toBeTruthy();
        button?.click();
        await Promise.resolve();
      });

      const state = getState(container);
      expect(state.getAttribute('data-name-width')).toBe('220');
      expect(upsertMock).not.toHaveBeenCalled();
    } finally {
      cleanup(root, container);
    }
  });

  it('continues loading saved widths and allowing resizing when the setting is disabled', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        grid_column_widths: {
          summary: { name: 360, amount: 200, actions: 40 },
        },
        use_default_grid_column_widths: false,
      },
      error: null,
    });

    const { container, root } = mount(<HookHarness />);
    try {
      await flushUi();

      const state = getState(container);
      expect(state.getAttribute('data-name-width')).toBe('360');
      expect(state.getAttribute('data-amount-width')).toBe('200');
      expect(state.getAttribute('data-column-resizing-enabled')).toBe('true');
    } finally {
      cleanup(root, container);
    }
  });
});

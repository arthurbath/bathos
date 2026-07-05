import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { SnakeWeightRecordsGrid } from '@/modules/snake/components/SnakeWeightRecordsGrid';
import { TOOLTIP_HOVER_DELAY_MS, TooltipProvider } from '@/components/ui/tooltip';
import type { Snake, SnakeGrowthExpectationRange, SnakeWeightRecord } from '@/modules/snake/types/snake';

vi.mock('@/hooks/useGridColumnWidths', () => ({
  useGridColumnWidths: () => ({
    columnSizing: {},
    columnSizingInfo: {},
    columnResizingEnabled: true,
    onColumnSizingChange: vi.fn(),
    onColumnSizingInfoChange: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGridViewPreferences', () => ({
  EMPTY_GRID_VIEW_FILTERS: {},
  sanitizeSortingState: (_raw: unknown, fallback: unknown) => fallback,
  useGridViewPreferences: ({ defaultSorting }: { defaultSorting: unknown }) => ({
    sorting: defaultSorting,
    setSorting: vi.fn(),
  }),
}));

vi.mock('@/components/ui/data-grid-history', () => ({
  useDataGridHistory: () => null,
}));

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

async function waitForTooltip() {
  await act(async () => {
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS);
    await Promise.resolve();
  });
}

const snake: Snake = {
  id: 'snake-1',
  household_id: 'household-1',
  name: 'Babylon',
  birthday: '2024-11-27',
  species: 'Ball Python',
  growth_profile: 'ball_python',
  morph: null,
  sex: 'unknown',
  notes: null,
  sort_order: 1,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const expectationRanges: SnakeGrowthExpectationRange[] = [
  {
    id: 'range-0-3',
    profile: 'ball_python',
    range_label: '0-3',
    age_lower_months: 0,
    age_upper_months: 3,
    growth_lower_grams_per_month: 30,
    growth_upper_grams_per_month: 50,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'range-3-6',
    profile: 'ball_python',
    range_label: '3-6',
    age_lower_months: 3,
    age_upper_months: 6,
    growth_lower_grams_per_month: 40,
    growth_upper_grams_per_month: 80,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'range-6-12',
    profile: 'ball_python',
    range_label: '6-12',
    age_lower_months: 6,
    age_upper_months: 12,
    growth_lower_grams_per_month: 50,
    growth_upper_grams_per_month: 100,
    sort_order: 3,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

const records: SnakeWeightRecord[] = [
  {
    id: 'record-1',
    household_id: 'household-1',
    snake_id: 'snake-1',
    recorded_on: '2025-04-01',
    weight_grams: 100,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'record-2',
    household_id: 'household-1',
    snake_id: 'snake-1',
    recorded_on: '2025-05-01',
    weight_grams: 140,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
];

describe('SnakeWeightRecordsGrid', () => {
  it('shows expected growth thresholds and bolds the active age band from a growth status cell', async () => {
    vi.useFakeTimers();
    const { container, root } = mount(
      <TooltipProvider>
        <SnakeWeightRecordsGrid
          userId="user-1"
          snake={snake}
          records={records}
          expectationRanges={expectationRanges}
          loading={false}
          onAddWeightRecord={async () => {}}
          onUpdateWeightRecord={async () => {}}
          onDeleteWeightRecord={async () => {}}
        />
      </TooltipProvider>,
    );

    try {
      const trigger = Array.from(container.querySelectorAll('[role="button"]'))
        .find((element) => element.textContent?.includes('Within Expectations'));
      expect(trigger).toBeTruthy();

      await act(async () => {
        trigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
      await waitForTooltip();

      const tooltip = document.body.querySelector('[role="tooltip"]');
      expect(tooltip?.textContent).toContain('Age');
      expect(tooltip?.textContent).toContain('Expected Growth');
      expect(tooltip?.textContent).toContain('0-3 mo');
      expect(tooltip?.textContent).toContain('30-50 g/mo');
      expect(tooltip?.textContent).toContain('3-6 mo');
      expect(tooltip?.textContent).toContain('40-80 g/mo');

      const activeRow = Array.from(tooltip?.querySelectorAll('tr') ?? [])
        .find((row) => row.textContent?.includes('3-6 mo'));
      expect(activeRow?.className).toContain('font-bold');
    } finally {
      unmount(root, container);
      vi.useRealTimers();
    }
  });
});

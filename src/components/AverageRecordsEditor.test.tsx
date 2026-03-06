import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AverageRecordsEditor } from '@/components/AverageRecordsEditor';
import type { BudgetAverageRecord } from '@/lib/budgetAveraging';

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

async function flushUi() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function flushUiTwice() {
  await flushUi();
  await flushUi();
}

describe('AverageRecordsEditor', () => {
  it('shows both yearly and monthly averages in yearly mode', () => {
    const { container, root } = mount(
      <AverageRecordsEditor
        valueType="yearly_averaged"
        records={[
          { year: 2024, month: null, amount: 12000, date: '2024-04-15' },
          { year: 2025, month: null, amount: 24000, date: '2025-08-20' },
        ]}
        onChange={() => {}}
      />,
    );

    try {
      expect(container.textContent).toContain('Yearly average:');
      expect(container.textContent).toContain('$18000.00');
      expect(container.textContent).toContain('Monthly average:');
      expect(container.textContent).toContain('$1500.00');
    } finally {
      unmount(root, container);
    }
  });

  it('uses icon-only add control in records header', () => {
    const { container, root } = mount(
      <AverageRecordsEditor
        valueType="monthly_averaged"
        records={[]}
        onChange={() => {}}
      />,
    );

    try {
      const addButton = container.querySelector('button[aria-label="Add month record"]');
      expect(addButton).toBeTruthy();
      expect(addButton?.textContent?.trim()).toBe('');
    } finally {
      unmount(root, container);
    }
  });

  it('focuses the add button on mount when requested', async () => {
    const { container, root } = mount(
      <AverageRecordsEditor
        valueType="monthly_averaged"
        records={[{ year: 2026, month: 3, amount: 100, date: '2026-03-02' }]}
        onChange={() => {}}
        autoFocusAddButton
      />,
    );

    try {
      await flushUiTwice();
      const addButton = container.querySelector('button[aria-label="Add month record"]');
      expect(document.activeElement).toBe(addButton);
    } finally {
      unmount(root, container);
    }
  });

  it('clears the final monthly record to todays date, keeps amount input blank, and refocuses primary input', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00-08:00'));

    function Harness() {
      const [records, setRecords] = React.useState<BudgetAverageRecord[]>([
        { year: 2024, month: 7, amount: 500, date: '2024-07-12' },
      ]);
      return (
        <AverageRecordsEditor
          valueType="monthly_averaged"
          records={records}
          onChange={setRecords}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const clearButton = container.querySelector('button[aria-label="Clear month record"]') as HTMLButtonElement | null;
      act(() => {
        clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      act(() => {
        vi.runAllTimers();
      });

      const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement | null;
      expect(amountInput?.value).toBe('');
      expect(container.textContent).toContain('Mar 2, 2026');

      const active = document.activeElement as HTMLElement | null;
      expect(active?.getAttribute('data-average-record-primary-input')).toBe('true');
      expect(active?.getAttribute('data-average-record-row')).toBe('0');
    } finally {
      unmount(root, container);
      vi.useRealTimers();
    }
  });

  it('prepends new records to the top of the list with a default exact date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00-08:00'));

    const onChange = vi.fn();
    const existingRecords = [
      { year: 2024, month: null as null, amount: 1000, date: '2024-02-01' },
      { year: 2025, month: null as null, amount: 2000, date: '2025-09-15' },
    ];

    const { container, root } = mount(
      <AverageRecordsEditor
        valueType="yearly_averaged"
        records={existingRecords}
        onChange={onChange}
      />,
    );

    try {
      const addButton = container.querySelector('button[aria-label="Add year record"]') as HTMLButtonElement | null;
      act(() => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const nextRecords = onChange.mock.calls[0]?.[0] as BudgetAverageRecord[];
      expect(nextRecords[0]).toEqual({ year: 2026, month: null, amount: 0, date: '2026-03-02' });
      expect(nextRecords.slice(1)).toEqual(existingRecords);
    } finally {
      unmount(root, container);
      vi.useRealTimers();
    }
  });

  it('focuses the newly-added row primary picker control', async () => {
    function Harness() {
      const [records, setRecords] = React.useState<BudgetAverageRecord[]>([{ year: 2025, month: null, amount: 100, date: '2025-05-10' }]);
      return (
        <AverageRecordsEditor
          valueType="yearly_averaged"
          records={records}
          onChange={setRecords}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const addButton = container.querySelector('button[aria-label="Add year record"]') as HTMLButtonElement | null;
      act(() => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUiTwice();

      const active = document.activeElement as HTMLElement | null;
      expect(active?.getAttribute('data-average-record-primary-input')).toBe('true');
      expect(active?.getAttribute('data-average-record-row')).toBe('0');
    } finally {
      unmount(root, container);
    }
  });

  it('opens a calendar datepicker and updates a monthly record with a specific date', async () => {
    function Harness() {
      const [records, setRecords] = React.useState<BudgetAverageRecord[]>([
        { year: 2026, month: 3, amount: 100, date: '2026-03-02' },
      ]);
      return (
        <AverageRecordsEditor
          valueType="monthly_averaged"
          records={records}
          onChange={setRecords}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const trigger = Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Mar 2, 2026')) as HTMLButtonElement | undefined;
      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const dayButton = Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.getAttribute('name') === 'day' && button.textContent?.trim() === '18') as HTMLButtonElement | undefined;
      expect(dayButton).toBeTruthy();

      act(() => {
        dayButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(container.textContent).toContain('Mar 18, 2026');
    } finally {
      unmount(root, container);
    }
  });

  it('returns focus to the datepicker trigger after selecting a date', async () => {
    function Harness() {
      const [records, setRecords] = React.useState<BudgetAverageRecord[]>([
        { year: 2026, month: 3, amount: 100, date: '2026-03-02' },
      ]);
      return (
        <AverageRecordsEditor
          valueType="monthly_averaged"
          records={records}
          onChange={setRecords}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const trigger = Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Mar 2, 2026')) as HTMLButtonElement | undefined;
      expect(trigger).toBeTruthy();

      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const dayButton = Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.getAttribute('name') === 'day' && button.textContent?.trim() === '18') as HTMLButtonElement | undefined;
      expect(dayButton).toBeTruthy();

      act(() => {
        dayButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const updatedTrigger = Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Mar 18, 2026')) as HTMLButtonElement | undefined;
      expect(updatedTrigger).toBeTruthy();
      expect(document.activeElement).toBe(updatedTrigger);
    } finally {
      unmount(root, container);
    }
  });

  it('shows blank amount for a single default zero-valued record', () => {
    const { container, root } = mount(
      <AverageRecordsEditor
        valueType="yearly_averaged"
        records={[{ year: 2026, month: null, amount: 0, date: '2026-01-01' }]}
        onChange={() => {}}
      />,
    );

    try {
      const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement | null;
      expect(amountInput?.value).toBe('');
    } finally {
      unmount(root, container);
    }
  });
});

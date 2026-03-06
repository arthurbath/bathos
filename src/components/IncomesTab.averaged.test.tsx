import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { IncomesTab, applyNewIncomeTypeToDraft } from '@/components/IncomesTab';
import type { Income } from '@/hooks/useIncomes';
import { TooltipProvider } from '@/components/ui/tooltip';

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
    await Promise.resolve();
  });
}

describe('IncomesTab averaged rows', () => {
  it('shows static averaged frequency and opens the records editor from amount', () => {
    const incomes: Income[] = [
      {
        id: 'income-1',
        household_id: 'h-1',
        name: 'Contract',
        amount: 12000,
        frequency_type: 'annual',
        frequency_param: null,
        partner_label: 'X',
        is_estimate: true,
        value_type: 'yearly_averaged',
        average_records: [
          { year: 2025, month: null, amount: 11000, date: '2025-04-15' },
          { year: 2026, month: null, amount: 13000, date: '2026-09-01' },
        ],
      },
    ];

    const { container, root } = mount(
      <TooltipProvider>
        <IncomesTab
          incomes={incomes}
          partnerX="Partner X"
          partnerY="Partner Y"
          onAdd={async () => {}}
          onUpdate={async () => {}}
          onRemove={async () => {}}
        />
      </TooltipProvider>,
    );

    try {
      expect(container.textContent).toContain('Yearly Avg');
      const amountButton = container.querySelector('button[aria-label="Edit averaged records for Contract"]');
      expect(amountButton).toBeTruthy();

      act(() => {
        amountButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(document.body.textContent).toContain('Edit Yearly Records');
    } finally {
      unmount(root, container);
    }
  });

  it('seeds one default record row when switching draft type to yearly averaged', () => {
    const converted = applyNewIncomeTypeToDraft({
      name: 'New income',
      amount: 0,
      partner_label: 'X',
      frequency_type: 'monthly',
      frequency_param: null,
      is_estimate: false,
      value_type: 'simple',
      average_records: [],
    }, 'yearly_averaged', new Date('2026-03-02T12:00:00-08:00'));

    expect(converted.value_type).toBe('yearly_averaged');
    expect(converted.average_records).toEqual([{ year: 2026, month: null, amount: 0, date: '2026-01-01' }]);
  });

  it('saves and closes the edit records modal when pressing enter in an amount input', async () => {
    const onUpdate = vi.fn(async () => {});
    const incomes: Income[] = [
      {
        id: 'income-1',
        household_id: 'h-1',
        name: 'Contract',
        amount: 12000,
        frequency_type: 'annual',
        frequency_param: null,
        partner_label: 'X',
        is_estimate: true,
        value_type: 'yearly_averaged',
        average_records: [
          { year: 2025, month: null, amount: 11000, date: '2025-04-15' },
          { year: 2026, month: null, amount: 13000, date: '2026-09-01' },
        ],
      },
    ];

    const { container, root } = mount(
      <TooltipProvider>
        <IncomesTab
          incomes={incomes}
          partnerX="Partner X"
          partnerY="Partner Y"
          onAdd={async () => {}}
          onUpdate={onUpdate}
          onRemove={async () => {}}
        />
      </TooltipProvider>,
    );

    try {
      const amountButton = container.querySelector('button[aria-label="Edit averaged records for Contract"]');
      act(() => {
        amountButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const amountInput = document.body.querySelector('input[type="number"]') as HTMLInputElement | null;
      expect(amountInput).toBeTruthy();

      act(() => {
        amountInput?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      await flushUi();

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).not.toContain('Edit Yearly Records');
    } finally {
      unmount(root, container);
    }
  });
});

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExpensesTab, applyNewExpenseTypeToDraft } from '@/components/ExpensesTab';
import { TooltipProvider } from '@/components/ui/tooltip';
import { fromMonthly } from '@/lib/frequency';
import type { Expense } from '@/hooks/useExpenses';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';

function renderExpensesTab({
  expenses,
  linkedAccounts = [],
  filterPayer = 'all',
}: {
  expenses: Expense[];
  linkedAccounts?: LinkedAccount[];
  filterPayer?: 'all' | 'X' | 'Y' | 'unassigned';
}) {
  localStorage.setItem('expenses_filterPayer', filterPayer);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <TooltipProvider>
        <ExpensesTab
          expenses={expenses}
          categories={[]}
          linkedAccounts={linkedAccounts}
          incomes={[]}
          partnerX="Partner X"
          partnerY="Partner Y"
          onAdd={async () => {}}
          onUpdate={async () => {}}
          onRemove={async () => {}}
          onAddCategory={async () => {}}
          onAddLinkedAccount={async () => {}}
        />
      </TooltipProvider>,
    );
  });

  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function tooltipText() {
  return document.body.querySelector('[role="tooltip"]')?.textContent ?? '';
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ExpensesTab empty message', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('shows the setup message when there are no expenses at all', () => {
    const { container, root } = renderExpensesTab({ expenses: [] });
    try {
      expect(container.textContent).toContain('No expenses yet. Click "Add" to start.');
    } finally {
      unmount(root, container);
    }
  });

  it('shows the filtered empty message when expenses exist but none match the filter', () => {
    const expense: Expense = {
      id: 'expense-1',
      name: 'Rent',
      amount: 1200,
      frequency_type: 'monthly',
      frequency_param: null,
      benefit_x: 50,
      category_id: null,
      household_id: 'household-1',
      is_estimate: false,
      budget_id: null,
      linked_account_id: 'account-y',
      value_type: 'simple',
      average_records: [],
    };

    const linkedAccount: LinkedAccount = {
      id: 'account-y',
      name: 'Partner Y Card',
      color: null,
      owner_partner: 'Y',
      household_id: 'household-1',
    };

    const { container, root } = renderExpensesTab({
      expenses: [expense],
      linkedAccounts: [linkedAccount],
      filterPayer: 'X',
    });

    try {
      expect(container.textContent).toContain('No expenses match the filter.');
      expect(container.textContent).not.toContain('No expenses yet. Click "Add" to start.');
    } finally {
      unmount(root, container);
    }
  });

  it('shows normalized cadence details when hovering a monthly value', async () => {
    const expense: Expense = {
      id: 'expense-1',
      name: 'Rent',
      amount: 333,
      frequency_type: 'monthly',
      frequency_param: null,
      benefit_x: 50,
      category_id: null,
      household_id: 'household-1',
      is_estimate: false,
      budget_id: null,
      linked_account_id: null,
      value_type: 'simple',
      average_records: [],
    };

    const { container, root } = renderExpensesTab({ expenses: [expense] });
    try {
      const trigger = Array.from(container.querySelectorAll('span[role="button"]'))
        .find((el) => el.textContent?.trim() === '$333');
      expect(trigger).toBeTruthy();

      act(() => {
        trigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
      await flushUi();

      const { daily, weekly, annual } = fromMonthly(333);
      const text = tooltipText();
      expect(text).toContain(`Daily: $${daily.toFixed(2)}`);
      expect(text).toContain(`Weekly: $${weekly.toFixed(2)}`);
      expect(text).toContain(`Annually: $${annual.toFixed(2)}`);
    } finally {
      unmount(root, container);
    }
  });

  it('shows averaged frequency text and opens averaged records editor from amount', () => {
    const expense: Expense = {
      id: 'expense-avg',
      name: 'Groceries',
      amount: 950,
      frequency_type: 'monthly',
      frequency_param: null,
      benefit_x: 50,
      category_id: null,
      household_id: 'household-1',
      is_estimate: true,
      budget_id: null,
      linked_account_id: null,
      value_type: 'monthly_averaged',
      average_records: [
        { year: 2026, month: 2, amount: 1000, date: '2026-02-10' },
        { year: 2025, month: 12, amount: 900, date: '2025-12-28' },
      ],
    };

    const { container, root } = renderExpensesTab({ expenses: [expense] });
    try {
      expect(container.textContent).toContain('Monthly Avg');
      const amountButton = container.querySelector('button[aria-label="Edit averaged records for Groceries"]');
      expect(amountButton).toBeTruthy();

      act(() => {
        amountButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(document.body.textContent).toContain('Edit Monthly Records');
    } finally {
      unmount(root, container);
    }
  });

  it('seeds one default monthly record when switching add-expense draft to monthly averaged', () => {
    const converted = applyNewExpenseTypeToDraft({
      name: 'New expense',
      amount: 0,
      benefit_x: 50,
      category_id: null,
      budget_id: null,
      linked_account_id: null,
      frequency_type: 'monthly',
      frequency_param: null,
      is_estimate: false,
      value_type: 'simple',
      average_records: [],
    }, 'monthly_averaged', new Date('2026-03-02T12:00:00-08:00'));

    expect(converted.value_type).toBe('monthly_averaged');
    expect(converted.average_records).toEqual([{ year: 2026, month: 3, amount: 0, date: '2026-03-01' }]);
  });
});

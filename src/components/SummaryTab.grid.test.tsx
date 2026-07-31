import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { SummaryTab } from '@/components/SummaryTab';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';
import { fromMonthly } from '@/lib/frequency';

const CPH = 'include_current_period' as const;

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

function tooltipText() {
  return document.body.querySelector('[role="tooltip"]')?.textContent ?? '';
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('SummaryTab DataGrid', () => {
  it('renders resize handles for breakdown columns', () => {
    const incomes: Income[] = [
      {
        id: 'income-x',
        household_id: 'h-1',
        name: 'Salary X',
        amount: 5000,
        partner_label: 'X',
        frequency_type: 'monthly',
        frequency_param: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
      {
        id: 'income-y',
        household_id: 'h-1',
        name: 'Salary Y',
        amount: 4000,
        partner_label: 'Y',
        frequency_type: 'monthly',
        frequency_param: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];
    const linkedAccounts: LinkedAccount[] = [
      {
        id: 'acct-x',
        household_id: 'h-1',
        name: 'X Card',
        owner_partner: 'X',
        color: null,
      },
    ];
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        household_id: 'h-1',
        name: 'Groceries',
        amount: 300,
        benefit_x: 50,
        frequency_type: 'monthly',
        frequency_param: null,
        category_id: null,
        budget_id: null,
        linked_account_id: 'acct-x',
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];

    const { container, root } = mount(
      <SummaryTab
        incomes={incomes}
        expenses={expenses}
        linkedAccounts={linkedAccounts}
        partnerX="Alex"
        partnerY="Blair"
        userId="user-1"
      />,
    );

    try {
      const handles = container.querySelectorAll('button[aria-label^="Resize "]');
      expect(handles.length).toBeGreaterThan(0);
    } finally {
      unmount(root, container);
    }
  });

  it('restores sorting from localStorage for the breakdown grid', () => {
    localStorage.setItem('summary_sorting', JSON.stringify([{ id: 'name', desc: true }]));

    const incomes: Income[] = [
      {
        id: 'income-x',
        household_id: 'h-1',
        name: 'Salary X',
        amount: 5000,
        partner_label: 'X',
        frequency_type: 'monthly',
        frequency_param: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];
    const linkedAccounts: LinkedAccount[] = [];
    const expenses: Expense[] = [
      {
        id: 'exp-a',
        household_id: 'h-1',
        name: 'Alpha',
        amount: 120,
        benefit_x: 50,
        frequency_type: 'monthly',
        frequency_param: null,
        category_id: null,
        budget_id: null,
        linked_account_id: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
      {
        id: 'exp-b',
        household_id: 'h-1',
        name: 'Bravo',
        amount: 140,
        benefit_x: 50,
        frequency_type: 'monthly',
        frequency_param: null,
        category_id: null,
        budget_id: null,
        linked_account_id: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];

    const { container, root } = mount(
      <SummaryTab
        incomes={incomes}
        expenses={expenses}
        linkedAccounts={linkedAccounts}
        partnerX="Alex"
        partnerY="Blair"
        userId="user-1"
      />,
    );

    try {
      const expenseNameCells = Array.from(container.querySelectorAll('tbody tr td:first-child'))
        .map((cell) => cell.textContent?.trim())
        .filter((text): text is string => text === 'Alpha' || text === 'Bravo');
      expect(expenseNameCells[0]).toBe('Bravo');
    } finally {
      unmount(root, container);
      localStorage.removeItem('summary_sorting');
    }
  });

  it('shows normalized cadence details when activating a monthly value', async () => {
    const incomes: Income[] = [
      {
        id: 'income-x',
        household_id: 'h-1',
        name: 'Salary X',
        amount: 5000,
        partner_label: 'X',
        frequency_type: 'monthly',
        frequency_param: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];
    const linkedAccounts: LinkedAccount[] = [];
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        household_id: 'h-1',
        name: 'Utilities',
        amount: 300,
        benefit_x: 50,
        frequency_type: 'monthly',
        frequency_param: null,
        category_id: null,
        budget_id: null,
        linked_account_id: null,
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];

    const { container, root } = mount(
      <SummaryTab
        incomes={incomes}
        expenses={expenses}
        linkedAccounts={linkedAccounts}
        partnerX="Alex"
        partnerY="Blair"
        userId="user-1"
      />,
    );

    try {
      const trigger = Array.from(container.querySelectorAll('span[role="button"]'))
        .find((el) => el.textContent?.trim() === '$300');
      expect(trigger).toBeTruthy();

      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const { daily, weekly, annual } = fromMonthly(300);
      const text = tooltipText();
      expect(text).toContain(`Daily: $${daily.toFixed(2)}`);
      expect(text).toContain(`Weekly: $${weekly.toFixed(2)}`);
      expect(text).toContain(`Annually: $${annual.toFixed(2)}`);
    } finally {
      unmount(root, container);
    }
  });
});

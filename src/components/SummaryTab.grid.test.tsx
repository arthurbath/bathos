import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { SummaryTab } from '@/components/SummaryTab';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';

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
      },
      {
        id: 'income-y',
        household_id: 'h-1',
        name: 'Salary Y',
        amount: 4000,
        partner_label: 'Y',
        frequency_type: 'monthly',
        frequency_param: null,
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
      const firstCell = container.querySelector('tbody tr td');
      expect(firstCell?.textContent).toContain('Bravo');
    } finally {
      unmount(root, container);
      localStorage.removeItem('summary_sorting');
    }
  });
});

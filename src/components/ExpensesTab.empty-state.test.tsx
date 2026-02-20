import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExpensesTab } from '@/components/ExpensesTab';
import { TooltipProvider } from '@/components/ui/tooltip';
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
});

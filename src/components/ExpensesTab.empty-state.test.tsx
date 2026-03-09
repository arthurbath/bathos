import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesTab, applyNewExpenseTypeToDraft } from '@/components/ExpensesTab';
import { TOOLTIP_HOVER_DELAY_MS, TooltipProvider } from '@/components/ui/tooltip';
import { fromMonthly } from '@/lib/frequency';
import type { Expense } from '@/hooks/useExpenses';
import type { LinkedAccount } from '@/hooks/useLinkedAccounts';

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock }),
}));

if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
}

const CPH = 'include_current_period' as const;

function renderExpensesTab({
  expenses,
  linkedAccounts = [],
  filterName = '',
  filterPayer = 'all',
  onUpdate = async () => {},
}: {
  expenses: Expense[];
  linkedAccounts?: LinkedAccount[];
  filterName?: string;
  filterPayer?: 'all' | 'X' | 'Y' | 'unassigned';
  onUpdate?: (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => Promise<void>;
}) {
  localStorage.setItem('expenses_filterName', filterName);
  localStorage.setItem('expenses_filterPayer', filterPayer);

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <TestHarness
        expenses={expenses}
        linkedAccounts={linkedAccounts}
        onUpdate={onUpdate}
      />,
    );
  });

  return { container, root };
}

function TestHarness({
  expenses,
  linkedAccounts,
  onUpdate,
}: {
  expenses: Expense[];
  linkedAccounts: LinkedAccount[];
  onUpdate: (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => Promise<void>;
}) {
  const [currentExpenses, setCurrentExpenses] = React.useState(expenses);

  const handleUpdate = React.useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'household_id'>>) => {
    await onUpdate(id, updates);
    setCurrentExpenses((previous) => previous.map((expense) => (
      expense.id === id ? { ...expense, ...updates } : expense
    )));
  }, [onUpdate]);

  return (
    <TooltipProvider>
      <ExpensesTab
        expenses={currentExpenses}
        categories={[]}
        linkedAccounts={linkedAccounts}
        incomes={[]}
        partnerX="Partner X"
        partnerY="Partner Y"
        onAdd={async () => {}}
        onUpdate={handleUpdate}
        onRemove={async () => {}}
        onAddCategory={async () => {}}
        onAddLinkedAccount={async () => {}}
      />
    </TooltipProvider>
  );
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

async function waitForCondition(assertion: () => void, timeoutMs = 300) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start <= timeoutMs) {
    try {
      assertion();
      return;
    } catch (error: unknown) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }
  throw lastError instanceof Error ? lastError : new Error('Condition not met before timeout');
}

async function startEditing(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
  });
  await waitForCondition(() => {
    expect(input.getAttribute('data-grid-editing')).toBe('true');
  });
}

async function dispatchInputChange(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  const setValue = prototypeSetter && valueSetter !== prototypeSetter ? prototypeSetter : valueSetter;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function dispatchEnter(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function getVisibleExpenseNames(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('tbody input[data-col="0"]'))
    .map((input) => input.value);
}

describe('ExpensesTab empty message', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    toastMock.mockReset();
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
      current_period_handling: CPH,
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
      expect(container.textContent).toContain('No expenses match the filter');
      expect(container.textContent).not.toContain('No expenses yet. Click "Add" to start.');
    } finally {
      unmount(root, container);
    }
  });

  it('filters expenses live by name on desktop', async () => {
    setViewportWidth(1200);

    const expenses: Expense[] = [
      {
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
        linked_account_id: null,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
      {
        id: 'expense-2',
        name: 'Groceries',
        amount: 450,
        frequency_type: 'monthly',
        frequency_param: null,
        benefit_x: 50,
        category_id: null,
        household_id: 'household-1',
        is_estimate: false,
        budget_id: null,
        linked_account_id: null,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];

    const { container, root } = renderExpensesTab({ expenses });

    try {
      const filterInput = container.querySelector<HTMLInputElement>('input[placeholder="Expense Name"]');
      expect(filterInput).toBeTruthy();

      await dispatchInputChange(filterInput!, 'groc');

      await waitForCondition(() => {
        expect(getVisibleExpenseNames(container)).toEqual(['Groceries']);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('applies the mobile name filter only after saving the filters modal', async () => {
    setViewportWidth(500);

    const expenses: Expense[] = [
      {
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
        linked_account_id: null,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
      {
        id: 'expense-2',
        name: 'Groceries',
        amount: 450,
        frequency_type: 'monthly',
        frequency_param: null,
        benefit_x: 50,
        category_id: null,
        household_id: 'household-1',
        is_estimate: false,
        budget_id: null,
        linked_account_id: null,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
    ];

    const { container, root } = renderExpensesTab({ expenses });

    try {
      await waitForCondition(() => {
        expect(Array.from(document.body.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Filters')).toBe(true);
      });

      const filtersButton = Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Filters') as HTMLButtonElement | undefined;
      expect(filtersButton).toBeTruthy();

      await act(async () => {
        filtersButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const modalInput = document.body.querySelector<HTMLInputElement>('#expenses-filter-query');
      expect(modalInput).toBeTruthy();

      await dispatchInputChange(modalInput!, 'groc');

      expect(getVisibleExpenseNames(container).sort()).toEqual(['Groceries', 'Rent']);

      const saveButton = document.body.querySelector<HTMLButtonElement>('button[data-dialog-confirm="true"]');
      expect(saveButton).toBeTruthy();

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(getVisibleExpenseNames(container)).toEqual(['Groceries']);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('shows normalized cadence details when hovering a monthly value', async () => {
    vi.useFakeTimers();
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
      current_period_handling: CPH,
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
      act(() => {
        vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS);
      });
      await flushUi();

      const { daily, weekly, annual } = fromMonthly(333);
      const text = tooltipText();
      expect(text).toContain(`Daily: $${daily.toFixed(2)}`);
      expect(text).toContain(`Weekly: $${weekly.toFixed(2)}`);
      expect(text).toContain(`Annually: $${annual.toFixed(2)}`);
    } finally {
      unmount(root, container);
      vi.useRealTimers();
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
      current_period_handling: CPH,
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

  it('rolls back the edited name when an async expense save fails', async () => {
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
      linked_account_id: null,
      value_type: 'simple',
      current_period_handling: CPH,
      average_records: [],
    };

    const onUpdate = vi.fn(async () => {
      throw new Error('Save failed');
    });

    const { container, root } = renderExpensesTab({ expenses: [expense], onUpdate });
    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="expense-1"][data-col="0"]');
      expect(input).toBeTruthy();
      expect(input?.value).toBe('Rent');

      await startEditing(input!);
      await dispatchInputChange(input!, 'Updated rent');
      await dispatchEnter(input!);

      await waitForCondition(() => {
        const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="expense-1"][data-col="0"]');
        expect(liveInput?.value).toBe('Rent');
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });

  it('shows a toast when an edited expense is hidden by active filters', async () => {
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
      linked_account_id: null,
      value_type: 'simple',
      current_period_handling: CPH,
      average_records: [],
    };

    const onUpdate = vi.fn(async () => {});
    const { container, root } = renderExpensesTab({
      expenses: [expense],
      filterName: 'rent',
      onUpdate,
    });

    try {
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="expense-1"][data-col="0"]');
      expect(input).toBeTruthy();

      await startEditing(input!);
      await dispatchInputChange(input!, 'Utilities');
      await dispatchEnter(input!);

      await waitForCondition(() => {
        expect(getVisibleExpenseNames(container)).toEqual([]);
        expect(toastMock).toHaveBeenCalledWith({
          title: 'Expense updated but hidden by filters',
          description: 'The expense was updated, and it is no longer visible because of the current filters.',
        });
      });

      expect(onUpdate).toHaveBeenCalledWith('expense-1', { name: 'Utilities' });
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
      current_period_handling: CPH,
      average_records: [],
    }, 'monthly_averaged', new Date('2026-03-02T12:00:00-08:00'));

    expect(converted.value_type).toBe('monthly_averaged');
    expect(converted.average_records).toEqual([{ year: 2026, month: 3, amount: 0, date: '2026-03-01' }]);
  });
});

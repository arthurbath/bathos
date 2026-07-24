import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IncomesTab, applyNewIncomeTypeToDraft } from '@/components/IncomesTab';
import type { Income } from '@/hooks/useIncomes';
import { TooltipProvider } from '@/components/ui/tooltip';

if (typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.scrollIntoView !== 'function') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
}

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

function getVisibleIncomeNames(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('tbody input[data-col="0"]'))
    .map((input) => input.value);
}

describe('IncomesTab averaged rows', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

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
        current_period_handling: CPH,
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
      current_period_handling: CPH,
      average_records: [],
    }, 'yearly_averaged', new Date('2026-03-02T12:00:00-08:00'));

    expect(converted.value_type).toBe('yearly_averaged');
    expect(converted.average_records).toEqual([{ year: 2026, month: null, amount: 0, date: '2026-01-01' }]);
  });

  it('keeps the edit records modal open when pressing unmodified Return in an amount input', async () => {
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
        current_period_handling: CPH,
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

      expect(onUpdate).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('Edit Yearly Records');
    } finally {
      unmount(root, container);
    }
  });

  it('rolls back the edited name when an async income save fails', async () => {
    const onUpdate = vi.fn(async () => {
      throw new Error('Save failed');
    });
    const incomes: Income[] = [
      {
        id: 'income-1',
        household_id: 'h-1',
        name: 'Salary',
        amount: 6000,
        frequency_type: 'monthly',
        frequency_param: null,
        partner_label: 'X',
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
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
      const input = container.querySelector<HTMLInputElement>('input[data-row-id="income-1"][data-col="0"]');
      expect(input).toBeTruthy();
      expect(input?.value).toBe('Salary');

      await startEditing(input!);
      await dispatchInputChange(input!, 'Updated salary');
      await dispatchEnter(input!);

      await waitForCondition(() => {
        const liveInput = container.querySelector<HTMLInputElement>('input[data-row-id="income-1"][data-col="0"]');
        expect(liveInput?.value).toBe('Salary');
      });

      expect(onUpdate).toHaveBeenCalledTimes(1);
    } finally {
      unmount(root, container);
    }
  });

  it('does not render a name filter on desktop', async () => {
    setViewportWidth(1200);

    const incomes: Income[] = [
      {
        id: 'income-1',
        household_id: 'h-1',
        name: 'Salary',
        amount: 6000,
        frequency_type: 'monthly',
        frequency_param: null,
        partner_label: 'X',
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
      {
        id: 'income-2',
        household_id: 'h-1',
        name: 'Freelance',
        amount: 1500,
        frequency_type: 'monthly',
        frequency_param: null,
        partner_label: 'Y',
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
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
      expect(container.querySelector('input[placeholder="Income"]')).toBeNull();
      expect(getVisibleIncomeNames(container).sort()).toEqual(['Freelance', 'Salary']);
    } finally {
      unmount(root, container);
    }
  });

  it('does not render a filters button on mobile', async () => {
    setViewportWidth(500);

    const incomes: Income[] = [
      {
        id: 'income-1',
        household_id: 'h-1',
        name: 'Salary',
        amount: 6000,
        frequency_type: 'monthly',
        frequency_param: null,
        partner_label: 'X',
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
      },
      {
        id: 'income-2',
        household_id: 'h-1',
        name: 'Freelance',
        amount: 1500,
        frequency_type: 'monthly',
        frequency_param: null,
        partner_label: 'Y',
        is_estimate: false,
        value_type: 'simple',
        current_period_handling: CPH,
        average_records: [],
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
      expect(Array.from(document.body.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Filters')).toBe(false);
      expect(getVisibleIncomeNames(container).sort()).toEqual(['Freelance', 'Salary']);
    } finally {
      unmount(root, container);
    }
  });
});

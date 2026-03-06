import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { RestoreTab } from '@/components/RestoreTab';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';

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

describe('RestoreTab snapshot payload', () => {
  it('includes averaged fields and income estimate fields when saving a backup', async () => {
    let captured: { notes: string; snapshot: unknown } | null = null;

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
        average_records: [{ year: 2024, month: null, amount: 12000, date: '2024-04-15' }],
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'expense-1',
        household_id: 'h-1',
        name: 'Groceries',
        amount: 950,
        frequency_type: 'monthly',
        frequency_param: null,
        benefit_x: 50,
        category_id: null,
        budget_id: null,
        linked_account_id: null,
        is_estimate: true,
        value_type: 'monthly_averaged',
        average_records: [{ year: 2026, month: 2, amount: 950, date: '2026-02-11' }],
      },
    ];

    const { container, root } = mount(
      <RestoreTab
        points={[]}
        incomes={incomes}
        expenses={expenses}
        categories={[]}
        linkedAccounts={[]}
        onSave={async (notes, snapshot) => {
          captured = { notes, snapshot };
        }}
        onRemove={async () => {}}
        onUpdateNotes={async () => {}}
        onRestore={async () => {}}
      />,
    );

    try {
      const createBackupButton = container.querySelector('button[aria-label="Create backup"]');
      expect(createBackupButton).toBeTruthy();
      act(() => {
        createBackupButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const saveButton = Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === 'Save');
      expect(saveButton).toBeTruthy();
      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });

      expect(captured?.notes).toBe('');
      const snapshot = captured?.snapshot as { incomes?: Array<Record<string, unknown>>; expenses?: Array<Record<string, unknown>> } | undefined;
      expect(snapshot?.incomes?.[0]?.is_estimate).toBe(true);
      expect(snapshot?.incomes?.[0]?.value_type).toBe('yearly_averaged');
      expect(snapshot?.incomes?.[0]?.average_records).toEqual([{ year: 2024, month: null, amount: 12000, date: '2024-04-15' }]);
      expect(snapshot?.expenses?.[0]?.value_type).toBe('monthly_averaged');
      expect(snapshot?.expenses?.[0]?.average_records).toEqual([{ year: 2026, month: 2, amount: 950, date: '2026-02-11' }]);
    } finally {
      unmount(root, container);
    }
  });

  it('opens backup actions menu when clicking the ellipsis trigger', async () => {
    const { container, root } = mount(
      <RestoreTab
        points={[
          {
            id: 'restore-1',
            notes: 'First backup',
            data: {},
            household_id: 'h-1',
            created_at: '2026-03-01T12:00:00.000Z',
          },
        ]}
        incomes={[]}
        expenses={[]}
        categories={[]}
        linkedAccounts={[]}
        onSave={async () => {}}
        onRemove={async () => {}}
        onUpdateNotes={async () => {}}
        onRestore={async () => {}}
      />,
    );

    try {
      const trigger = container.querySelector('button[aria-label="Backup actions"]') as HTMLButtonElement | null;
      expect(trigger).toBeTruthy();

      await act(async () => {
        const pointerDownEvent = typeof PointerEvent !== 'undefined'
          ? new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false, pointerType: 'mouse' })
          : (() => {
            const event = new MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false });
            Object.defineProperty(event, 'pointerType', { value: 'mouse' });
            return event;
          })();

        trigger?.dispatchEvent(pointerDownEvent);
        trigger?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        trigger?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        await Promise.resolve();
      });

      const menuItems = Array.from(document.body.querySelectorAll('[role="menuitem"]'));
      const restoreItem = menuItems.find((item) => item.textContent?.includes('Restore'));
      expect(restoreItem).toBeTruthy();
    } finally {
      unmount(root, container);
    }
  });
});

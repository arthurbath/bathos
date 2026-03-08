import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarageConfigView } from '@/modules/garage/components/GarageConfigView';
import type { GarageUserSettings, GarageVehicle } from '@/modules/garage/types/garage';

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

async function waitForCondition(assertion: () => void, timeoutMs = 500) {
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

describe('GarageConfigView vehicles grid', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('uses the same touch keyboard hints as the add-vehicle modal fields', () => {
    const vehicles: GarageVehicle[] = [
      {
        id: 'vehicle-1',
        user_id: 'user-1',
        name: 'Daily Driver',
        make: 'Honda',
        model: 'Civic',
        model_year: 2020,
        in_service_date: '2020-06-01',
        current_odometer_miles: 42000,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const settings: GarageUserSettings = {
      id: 'settings-1',
      user_id: 'user-1',
      upcoming_miles_default: 1000,
      upcoming_days_default: 60,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        settings={settings}
        onAddVehicle={async () => {}}
        onUpdateVehicle={async () => {}}
        onRemoveVehicle={async () => {}}
        onUpdateSettings={async () => {}}
      />,
    );

    try {
      const nameInput = container.querySelector('input[data-col="0"]') as HTMLInputElement | null;
      const yearInput = container.querySelector('input[data-col="3"]') as HTMLInputElement | null;
      const dateButton = container.querySelector('button[data-col="4"]') as HTMLButtonElement | null;
      const mileageInput = container.querySelector('input[data-col="5"]') as HTMLInputElement | null;

      expect(nameInput?.inputMode).toBe('');
      expect(yearInput?.inputMode).toBe('numeric');
      expect(yearInput?.value).toBe('2020');
      expect(mileageInput?.inputMode).toBe('decimal');
      expect(dateButton?.textContent).toContain('Jun');
    } finally {
      unmount(root, container);
    }
  });

  it('shows delete as the only row action in the vehicles menu', async () => {
    const removeVehicle = vi.fn(async () => {});
    const vehicles: GarageVehicle[] = [
      {
        id: 'vehicle-1',
        user_id: 'user-1',
        name: 'Daily Driver',
        make: 'Honda',
        model: 'Civic',
        model_year: 2020,
        in_service_date: '2020-06-01',
        current_odometer_miles: 42000,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        settings={null}
        onAddVehicle={async () => {}}
        onUpdateVehicle={async () => {}}
        onRemoveVehicle={removeVehicle}
        onUpdateSettings={async () => {}}
      />,
    );

    try {
      const menuButton = container.querySelector('button[aria-label="Actions for Daily Driver"]') as HTMLButtonElement | null;
      expect(menuButton).toBeTruthy();

      await act(async () => {
        menuButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        menuButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        menuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        const menu = document.body.querySelector('[role="menu"]');
        expect(menu).toBeTruthy();
        expect(menu?.textContent).toContain('Delete');
        expect(menu?.textContent).not.toContain('Edit');
      });
    } finally {
      unmount(root, container);
    }
  });
});

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarageConfigView } from '@/modules/garage/components/GarageConfigView';
import type { GarageVehicle } from '@/modules/garage/types/garage';

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock }),
}));

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

async function dispatchInputChange(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
  const prototypeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  const setValue = prototypeSetter && valueSetter !== prototypeSetter ? prototypeSetter : valueSetter;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function startGridEdit(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.focus();
  });
  await waitForCondition(() => {
    expect(input.getAttribute('data-grid-editing')).toBe('true');
  });
}

async function commitGridEdit(input: HTMLInputElement) {
  await act(async () => {
    input.blur();
  });
}

describe('GarageConfigView vehicles grid', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    toastMock.mockReset();
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
        upcoming_miles: 2500,
        upcoming_days: 90,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={async () => {}}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const nameInput = container.querySelector('input[data-col="0"]') as HTMLInputElement | null;
      const yearInput = container.querySelector('input[data-col="3"]') as HTMLInputElement | null;
      const dateButton = container.querySelector('button[data-col="4"]') as HTMLButtonElement | null;
      const mileageInput = container.querySelector('input[data-col="5"]') as HTMLInputElement | null;
      const upcomingMilesInput = container.querySelector('input[data-col="6"]') as HTMLInputElement | null;
      const upcomingMonthsInput = container.querySelector('input[data-col="7"]') as HTMLInputElement | null;

      expect(nameInput?.inputMode).toBe('');
      expect(yearInput?.inputMode).toBe('numeric');
      expect(yearInput?.value).toBe('2020');
      expect(mileageInput?.inputMode).toBe('decimal');
      expect(upcomingMilesInput?.value).toBe('2500');
      expect(upcomingMonthsInput?.value).toBe('3');
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
        upcoming_miles: 1000,
        upcoming_days: 60,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={async () => {}}
        onRemoveVehicle={removeVehicle}
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

  it('requires model year when adding a vehicle', async () => {
    const addVehicle = vi.fn(async () => {});

    const { container, root } = mount(
      <GarageConfigView
        vehicles={[]}
        onAddVehicle={addVehicle}
        onUpdateVehicle={async () => {}}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const addButton = container.querySelector('button[aria-label="Add vehicle"]') as HTMLButtonElement | null;
      expect(addButton).toBeTruthy();

      await act(async () => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const nameInput = document.body.querySelector('#garage-vehicle-name') as HTMLInputElement | null;
      const yearInput = document.body.querySelector('#garage-vehicle-year') as HTMLInputElement | null;
      const upcomingMilesInput = document.body.querySelector('#garage-vehicle-upcoming-miles') as HTMLInputElement | null;
      const upcomingMonthsInput = document.body.querySelector('#garage-vehicle-upcoming-months') as HTMLInputElement | null;
      const saveButton = document.body.querySelector('button[data-dialog-confirm="true"]') as HTMLButtonElement | null;

      expect(nameInput).toBeTruthy();
      expect(yearInput?.required).toBe(true);
      expect(upcomingMilesInput?.value).toBe('1000');
      expect(upcomingMonthsInput?.value).toBe('2');
      expect(saveButton).toBeTruthy();

      if (nameInput) {
        await dispatchInputChange(nameInput, 'Project Car');
      }

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(addVehicle).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith({ title: 'Model year required', variant: 'destructive' });
    } finally {
      unmount(root, container);
    }
  });

  it('saves custom upcoming horizons with a new vehicle', async () => {
    const addVehicle = vi.fn(async () => {});
    const { container, root } = mount(
      <GarageConfigView
        vehicles={[]}
        onAddVehicle={addVehicle}
        onUpdateVehicle={async () => {}}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const addButton = container.querySelector('button[aria-label="Add vehicle"]') as HTMLButtonElement | null;
      await act(async () => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const nameInput = document.body.querySelector('#garage-vehicle-name') as HTMLInputElement;
      const yearInput = document.body.querySelector('#garage-vehicle-year') as HTMLInputElement;
      const upcomingMilesInput = document.body.querySelector('#garage-vehicle-upcoming-miles') as HTMLInputElement;
      const upcomingMonthsInput = document.body.querySelector('#garage-vehicle-upcoming-months') as HTMLInputElement;
      const saveButton = document.body.querySelector('button[data-dialog-confirm="true"]') as HTMLButtonElement;

      await dispatchInputChange(nameInput, 'Cargo Bike');
      await dispatchInputChange(yearInput, '2025');
      await dispatchInputChange(upcomingMilesInput, '200');
      await dispatchInputChange(upcomingMonthsInput, '2.5');

      await act(async () => {
        saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(addVehicle).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Cargo Bike',
          model_year: 2025,
          upcoming_miles: 200,
          upcoming_days: 75,
        }));
      });
    } finally {
      unmount(root, container);
    }
  });

  it('restores the previous name and shows a toast when the grid name cell is cleared and saved', async () => {
    const updateVehicle = vi.fn(async () => {});
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
        upcoming_miles: 1000,
        upcoming_days: 60,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={updateVehicle}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const nameInput = container.querySelector('input[data-col="0"]') as HTMLInputElement | null;
      expect(nameInput).toBeTruthy();

      if (!nameInput) throw new Error('Missing name input');

      await startGridEdit(nameInput);
      await dispatchInputChange(nameInput, '');
      await commitGridEdit(nameInput);

      await waitForCondition(() => {
        expect(nameInput.value).toBe('Daily Driver');
      });
      expect(updateVehicle).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith({ title: 'Name is required', variant: 'destructive' });
    } finally {
      unmount(root, container);
    }
  });

  it('restores the previous model year and shows a toast when the grid model year cell is cleared and saved', async () => {
    const updateVehicle = vi.fn(async () => {});
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
        upcoming_miles: 1000,
        upcoming_days: 60,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={updateVehicle}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const yearInput = container.querySelector('input[data-col="3"]') as HTMLInputElement | null;
      expect(yearInput).toBeTruthy();

      if (!yearInput) throw new Error('Missing model year input');

      await startGridEdit(yearInput);
      await dispatchInputChange(yearInput, '');
      await commitGridEdit(yearInput);

      await waitForCondition(() => {
        expect(yearInput.value).toBe('2020');
      });
      expect(updateVehicle).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith({ title: 'Model year is required', variant: 'destructive' });
    } finally {
      unmount(root, container);
    }
  });

  it('restores the previous model year and shows the year bounds when an out-of-range value is committed', async () => {
    const updateVehicle = vi.fn(async () => {});
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
        upcoming_miles: 1000,
        upcoming_days: 60,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={updateVehicle}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const yearInput = container.querySelector('input[data-col="3"]') as HTMLInputElement | null;
      expect(yearInput).toBeTruthy();

      if (!yearInput) throw new Error('Missing model year input');

      await startGridEdit(yearInput);
      await dispatchInputChange(yearInput, '2301');
      await commitGridEdit(yearInput);

      await waitForCondition(() => {
        expect(yearInput.value).toBe('2020');
      });
      expect(updateVehicle).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith({
        title: 'Invalid model year',
        description: 'Model year must be between 1900 and 2200.',
        variant: 'destructive',
      });
    } finally {
      unmount(root, container);
    }
  });

  it('sets current mileage to 0 when the grid mileage cell is cleared and saved', async () => {
    const updateVehicle = vi.fn(async () => {});
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
        upcoming_miles: 1000,
        upcoming_days: 60,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={updateVehicle}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const mileageInput = container.querySelector('input[data-col="5"]') as HTMLInputElement | null;
      expect(mileageInput).toBeTruthy();

      if (!mileageInput) throw new Error('Missing mileage input');

      await startGridEdit(mileageInput);
      await dispatchInputChange(mileageInput, '');
      await commitGridEdit(mileageInput);

      await waitForCondition(() => {
        expect(mileageInput.value).toBe('0');
      });
      expect(updateVehicle).toHaveBeenCalledWith('vehicle-1', { current_odometer_miles: 0 });
    } finally {
      unmount(root, container);
    }
  });

  it('updates each vehicle horizon independently from the grid', async () => {
    const updateVehicle = vi.fn(async () => {});
    const vehicles: GarageVehicle[] = [
      {
        id: 'vehicle-1',
        user_id: 'user-1',
        name: 'Cargo Bike',
        make: null,
        model: null,
        model_year: 2025,
        in_service_date: '2025-01-01',
        current_odometer_miles: 800,
        upcoming_miles: 200,
        upcoming_days: 60,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageConfigView
        vehicles={vehicles}
        onAddVehicle={async () => {}}
        onUpdateVehicle={updateVehicle}
        onRemoveVehicle={async () => {}}
      />,
    );

    try {
      const upcomingMilesInput = container.querySelector('input[data-col="6"]') as HTMLInputElement;
      const upcomingMonthsInput = container.querySelector('input[data-col="7"]') as HTMLInputElement;

      await startGridEdit(upcomingMilesInput);
      await dispatchInputChange(upcomingMilesInput, '350');
      await commitGridEdit(upcomingMilesInput);
      await waitForCondition(() => {
        expect(updateVehicle).toHaveBeenCalledWith('vehicle-1', { upcoming_miles: 350 });
      });

      await startGridEdit(upcomingMonthsInput);
      await dispatchInputChange(upcomingMonthsInput, '3.5');
      await commitGridEdit(upcomingMonthsInput);
      await waitForCondition(() => {
        expect(updateVehicle).toHaveBeenCalledWith('vehicle-1', { upcoming_days: 105 });
      });
    } finally {
      unmount(root, container);
    }
  });
});

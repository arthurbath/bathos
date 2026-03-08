import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GarageServicingsGrid } from '@/modules/garage/components/GarageServicingsGrid';
import type { GarageService, GarageServicingWithRelations } from '@/modules/garage/types/garage';

type MockDataGridTable = {
  getHeaderGroups: () => Array<{
    id: string;
    headers: Array<{
      id: string;
      isPlaceholder?: boolean;
      column: { columnDef: { header?: unknown } };
    }>;
  }>;
  getRowModel: () => {
    rows: Array<{
      id: string;
      getVisibleCells: () => Array<{
        id: string;
        column: { columnDef: { cell?: unknown } };
        getContext: () => unknown;
      }>;
    }>;
  };
};

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/components/ui/data-grid', () => ({
  DataGrid: ({ table }: { table: MockDataGridTable }) => (
    <table data-testid="garage-servicings-grid">
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : (
                  typeof header.column.columnDef.header === 'function'
                    ? (header.column.columnDef.header as (context: unknown) => React.ReactNode)({})
                    : header.column.columnDef.header as React.ReactNode
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {cell.column.columnDef.cell
                  ? (cell.column.columnDef.cell as (context: unknown) => React.ReactNode)(cell.getContext())
                  : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  GridEditableCell: () => null,
  gridMenuTriggerProps: () => ({}),
  gridNavProps: () => ({}),
  useDataGrid: () => null,
}));

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

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

async function waitForCondition(assertion: () => void, timeoutMs = 1000) {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start <= timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }
  throw lastError instanceof Error ? lastError : new Error('Condition not met before timeout');
}

async function flushUi() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function click(node: HTMLElement) {
  act(() => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function clickAsync(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

function setFileInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });

  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function buildProps(overrides: Partial<React.ComponentProps<typeof GarageServicingsGrid>> = {}): React.ComponentProps<typeof GarageServicingsGrid> {
  const services: GarageService[] = [{
    id: 'service-1',
    user_id: 'user-1',
    vehicle_id: 'vehicle-1',
    name: 'Oil Change',
    type: 'replacement',
    monitoring: true,
    cadence_type: 'recurring',
    every_miles: 5000,
    every_months: 6,
    sort_order: 0,
    notes: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  }];

  const servicings: GarageServicingWithRelations[] = [];

  return {
    userId: '',
    currentVehicleId: 'vehicle-1',
    services,
    servicings,
    loading: false,
    currentVehicleMileage: 123456,
    vehicleName: 'Test Car',
    onAddServicing: async () => {},
    onUpdateServicing: async () => {},
    onDeleteServicing: async () => {},
    onOpenReceipt: async () => {},
    onAddService: async () => services[0]!,
    ...overrides,
  };
}

function buildServicing(overrides: Partial<GarageServicingWithRelations> = {}): GarageServicingWithRelations {
  return {
    id: 'servicing-1',
    user_id: 'user-1',
    vehicle_id: 'vehicle-1',
    service_date: '2026-03-02',
    odometer_miles: 123000,
    shop_name: 'Test Shop',
    notes: null,
    created_at: '2026-03-02T00:00:00.000Z',
    updated_at: '2026-03-02T00:00:00.000Z',
    outcomes: [{
      id: 'outcome-1',
      service_id: 'service-1',
      status: 'performed',
      created_at: '2026-03-02T00:00:00.000Z',
      user_id: 'user-1',
      vehicle_id: 'vehicle-1',
      servicing_id: 'servicing-1',
    }],
    receipts: [],
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GarageServicingsGrid servicing dialog', () => {
  it('renders Notes after Receipts in the add servicing dialog', async () => {
    const { container, root } = mount(<GarageServicingsGrid {...buildProps()} />);

    try {
      const addButton = document.body.querySelector('button[aria-label="Add servicing"]') as HTMLButtonElement | null;
      expect(addButton).toBeTruthy();

      click(addButton!);

      await waitForCondition(() => {
        expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
      });

      const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
      const labels = Array.from(dialog.querySelectorAll('label')).map((label) => label.textContent?.trim() ?? '');
      const mileageInput = dialog.querySelector('#garage-servicing-mileage') as HTMLInputElement | null;

      expect(labels).toEqual(['Date', 'Mileage', 'Shop', 'Service Outcomes', 'Receipts', 'Notes']);
      expect(mileageInput?.inputMode).toBe('decimal');
    } finally {
      unmount(root, container);
    }
  });

  it('lists pending receipt files and lets the user remove them before saving', async () => {
    const onAddServicing = vi.fn(async () => {});
    const { container, root } = mount(
      <GarageServicingsGrid
        {...buildProps({ onAddServicing })}
      />,
    );

    try {
      const addButton = document.body.querySelector('button[aria-label="Add servicing"]') as HTMLButtonElement | null;
      expect(addButton).toBeTruthy();
      click(addButton!);

      await waitForCondition(() => {
        expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
      });

      const receiptInput = document.body.querySelector('#garage-servicing-receipts') as HTMLInputElement | null;
      expect(receiptInput).toBeTruthy();

      const fileA = new File(['alpha'], 'invoice-a.pdf', { type: 'application/pdf' });
      const fileB = new File(['beta'], 'invoice-b.jpg', { type: 'image/jpeg' });
      setFileInputFiles(receiptInput!, [fileA, fileB]);

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('invoice-a.pdf');
        expect(document.body.textContent).toContain('invoice-b.jpg');
      });
      expect(document.body.textContent).not.toContain('pending upload');

      const removeButton = document.body.querySelector('button[aria-label="Remove invoice-a.pdf"]') as HTMLButtonElement | null;
      expect(removeButton).toBeTruthy();
      click(removeButton!);

      await waitForCondition(() => {
        expect(document.body.textContent).not.toContain('invoice-a.pdf');
        expect(document.body.textContent).toContain('invoice-b.jpg');
      });

      const saveButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Save') as HTMLButtonElement | undefined;
      expect(saveButton).toBeTruthy();
      await clickAsync(saveButton!);

      await waitForCondition(() => {
        expect(onAddServicing).toHaveBeenCalledTimes(1);
      });

      expect(onAddServicing.mock.calls[0]![0].receipt_files).toEqual([fileB]);
    } finally {
      unmount(root, container);
    }
  });

  it('keeps the selected date when the user chooses the same day again', async () => {
    const { container, root } = mount(<GarageServicingsGrid {...buildProps()} />);

    try {
      const addButton = document.body.querySelector('button[aria-label="Add servicing"]') as HTMLButtonElement | null;
      expect(addButton).toBeTruthy();
      click(addButton!);

      await waitForCondition(() => {
        expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
      });

      const dateButton = document.body.querySelector('#garage-servicing-date') as HTMLButtonElement | null;
      expect(dateButton).toBeTruthy();
      const initialLabel = dateButton!.textContent?.trim();
      expect(initialLabel).toBeTruthy();
      expect(initialLabel).not.toContain('Pick a date');

      click(dateButton!);
      await flushUi();

      const selectedDay = Array.from(document.body.querySelectorAll('button[name="day"]')).find((button) => button.getAttribute('aria-selected') === 'true') as HTMLButtonElement | undefined;
      expect(selectedDay).toBeTruthy();

      click(selectedDay!);

      await waitForCondition(() => {
        expect((document.body.querySelector('#garage-servicing-date') as HTMLButtonElement | null)?.textContent?.trim()).toBe(initialLabel);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('focuses the service outcome add button when opened from the Outcomes column', async () => {
    const services: GarageService[] = [
      buildProps().services[0]!,
      {
        id: 'service-2',
        user_id: 'user-1',
        vehicle_id: 'vehicle-1',
        name: 'Air Filter',
        type: 'replacement',
        monitoring: true,
        cadence_type: 'recurring',
        every_miles: 15000,
        every_months: 12,
        sort_order: 1,
        notes: null,
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
      },
    ];
    const { container, root } = mount(
      <GarageServicingsGrid {...buildProps({ services, servicings: [buildServicing()] })} />,
    );

    try {
      const outcomesButton = Array.from(document.body.querySelectorAll('button[aria-label="Open servicing detail for 2026-03-02"]'))
        .find((button) => button.textContent?.trim() === '100') as HTMLButtonElement | undefined;
      expect(outcomesButton).toBeTruthy();

      click(outcomesButton!);

      await waitForCondition(() => {
        const addOutcomeButton = document.body.querySelector('button[aria-label="Add service outcome"]') as HTMLButtonElement | null;
        expect(addOutcomeButton).toBeTruthy();
        expect(document.activeElement).toBe(addOutcomeButton);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('focuses the receipt add area when opened from the Receipts column', async () => {
    const servicing = buildServicing({
      receipts: [{
        id: 'receipt-1',
        user_id: 'user-1',
        vehicle_id: 'vehicle-1',
        servicing_id: 'servicing-1',
        filename: 'receipt.pdf',
        storage_object_path: 'garage-receipts/receipt.pdf',
        mime_type: 'application/pdf',
        size_bytes: 123,
        created_at: '2026-03-02T00:00:00.000Z',
      }],
    });
    const { container, root } = mount(
      <GarageServicingsGrid {...buildProps({ servicings: [servicing] })} />,
    );

    try {
      const receiptButton = Array.from(document.body.querySelectorAll('button[aria-label="Open servicing detail for 2026-03-02"]'))
        .find((button) => button.textContent?.trim() === '1') as HTMLButtonElement | undefined;
      expect(receiptButton).toBeTruthy();

      click(receiptButton!);

      await waitForCondition(() => {
        const receiptAddButton = document.body.querySelector('button[aria-label="Add receipts"]') as HTMLButtonElement | null;
        expect(receiptAddButton).toBeTruthy();
        expect(document.activeElement).toBe(receiptAddButton);
      });
    } finally {
      unmount(root, container);
    }
  });
});

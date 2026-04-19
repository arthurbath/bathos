import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarageServicesGrid } from '@/modules/garage/components/GarageServicesGrid';
import type { GarageService, GarageServicingWithRelations } from '@/modules/garage/types/garage';

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock }),
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

function renderStatefulGarageServicesGrid({
  services,
  servicings = [],
  vehicleName = 'Test Car',
  fullView = false,
  onUpdateService = async () => {},
}: {
  services: GarageService[];
  servicings?: GarageServicingWithRelations[];
  vehicleName?: string;
  fullView?: boolean;
  onUpdateService?: (id: string, updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>) => Promise<void>;
}) {
  return mount(
    <StatefulGarageServicesGrid
      services={services}
      servicings={servicings}
      vehicleName={vehicleName}
      fullView={fullView}
      onUpdateService={onUpdateService}
    />,
  );
}

function StatefulGarageServicesGrid({
  services,
  servicings,
  vehicleName,
  fullView,
  onUpdateService,
}: {
  services: GarageService[];
  servicings: GarageServicingWithRelations[];
  vehicleName: string;
  fullView: boolean;
  onUpdateService: (id: string, updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>) => Promise<void>;
}) {
  const [currentServices, setCurrentServices] = React.useState(services);

  const handleUpdateService = React.useCallback(async (
    id: string,
    updates: Partial<Omit<GarageService, 'id' | 'user_id' | 'vehicle_id' | 'created_at'>>,
  ) => {
    await onUpdateService(id, updates);
    setCurrentServices((previous) => previous.map((service) => (
      service.id === id ? { ...service, ...updates } : service
    )));
  }, [onUpdateService]);

  return (
    <GarageServicesGrid
      userId=""
      services={currentServices}
      servicings={servicings}
      loading={false}
      vehicleName={vehicleName}
      fullView={fullView}
      onAddService={async () => currentServices[0]!}
      onUpdateService={handleUpdateService}
      onImportServices={async () => {}}
      onDeleteService={async () => {}}
    />
  );
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

function setFileInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });

  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
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

async function dispatchEnter(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

async function openButtonMenu(button: HTMLButtonElement) {
  const PointerEventCtor = window.PointerEvent ?? MouseEvent;
  await act(async () => {
    button.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0, ctrlKey: false }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function getVisibleServiceNames(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('tbody input[data-col="0"]'))
    .map((input) => input.value);
}

function makeRect({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mockElementRect(element: Element, rect: DOMRect) {
  const original = element.getBoundingClientRect.bind(element);
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
  return () => {
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: original,
    });
  };
}

describe('GarageServicesGrid focus scrolling', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    toastMock.mockReset();
  });

  it('uses decimal keyboard hints for cadence inputs in the add-service dialog', async () => {
    const services: GarageService[] = [];

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={services}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={async () => ({
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
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        })}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );

    try {
      const addButton = document.body.querySelector('button[aria-label="Add service"]') as HTMLButtonElement | null;
      expect(addButton).toBeTruthy();

      await act(async () => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();
      });

      const milesInput = document.body.querySelector('#garage-service-miles') as HTMLInputElement | null;
      const monthsInput = document.body.querySelector('#garage-service-months') as HTMLInputElement | null;

      expect(milesInput?.inputMode).toBe('decimal');
      expect(monthsInput?.inputMode).toBe('decimal');
    } finally {
      unmount(root, container);
    }
  });

  it('keeps a focused notes cell fully visible in full-view grouped mode', async () => {
    localStorage.setItem('garage_services_groupBy', 'type');
    localStorage.setItem('garage_services_cadenceFilter', 'all');

    const services: GarageService[] = [
      {
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
        notes: 'Use synthetic',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const servicings: GarageServicingWithRelations[] = [];

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={services}
        servicings={servicings}
        loading={false}
        vehicleName="Test Car"
        fullView
        onAddService={async () => services[0]!}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );
    const restoreRects: Array<() => void> = [];

    try {
      const gridContainer = container.querySelector<HTMLDivElement>('div.overflow-auto');
      const header = container.querySelector<HTMLElement>('thead.sticky');
      const groupRow = container.querySelector<HTMLElement>('tbody tr.sticky');
      const groupHeaderCell = groupRow?.querySelector<HTMLElement>('td.sticky');
      const stickyFirstCell = container.querySelector<HTMLElement>('tbody tr:not(.sticky) td.sticky');
      const targetInput = container.querySelector<HTMLInputElement>('input[data-col="6"]');

      expect(gridContainer).not.toBeNull();
      expect(header).not.toBeNull();
      expect(groupRow).not.toBeNull();
      expect(groupHeaderCell).not.toBeNull();
      expect(stickyFirstCell).not.toBeNull();
      expect(targetInput).not.toBeNull();

      restoreRects.push(mockElementRect(gridContainer!, makeRect({ top: 0, left: 0, width: 220, height: 200 })));
      restoreRects.push(mockElementRect(header!, makeRect({ top: 0, left: 0, width: 220, height: 36 })));
      restoreRects.push(mockElementRect(groupRow!, makeRect({ top: 36, left: 0, width: 220, height: 28 })));
      restoreRects.push(mockElementRect(groupHeaderCell!, makeRect({ top: 36, left: 0, width: 80, height: 28 })));
      restoreRects.push(mockElementRect(stickyFirstCell!, makeRect({ top: 60, left: 0, width: 80, height: 28 })));
      restoreRects.push(mockElementRect(targetInput!, makeRect({ top: 60, left: 70, width: 90, height: 28 })));

      gridContainer!.scrollTop = 50;
      gridContainer!.scrollLeft = 30;

      await act(async () => {
        targetInput!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(gridContainer!.scrollTop).toBe(46);
        expect(gridContainer!.scrollLeft).toBe(20);
      });
    } finally {
      localStorage.removeItem('garage_services_groupBy');
      localStorage.removeItem('garage_services_cadenceFilter');
      while (restoreRects.length > 0) restoreRects.pop()?.();
      unmount(root, container);
    }
  });

  it('filters services live by name on desktop', async () => {
    setViewportWidth(1200);

    const services: GarageService[] = [
      {
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
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'service-2',
        user_id: 'user-1',
        vehicle_id: 'vehicle-1',
        name: 'Brake Inspection',
        type: 'check',
        monitoring: true,
        cadence_type: 'recurring',
        every_miles: 12000,
        every_months: 12,
        sort_order: 1,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={services}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={async () => services[0]!}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );

    try {
      const filterInput = container.querySelector<HTMLInputElement>('input[placeholder="Service Name"]');
      expect(filterInput).toBeTruthy();

      await dispatchInputChange(filterInput!, 'brake');

      await waitForCondition(() => {
        expect(getVisibleServiceNames(container)).toEqual(['Brake Inspection']);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('applies the mobile name filter only after saving the filters modal', async () => {
    setViewportWidth(500);

    const services: GarageService[] = [
      {
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
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'service-2',
        user_id: 'user-1',
        vehicle_id: 'vehicle-1',
        name: 'Brake Inspection',
        type: 'check',
        monitoring: true,
        cadence_type: 'recurring',
        every_miles: 12000,
        every_months: 12,
        sort_order: 1,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={services}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={async () => services[0]!}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );

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

      const modalInput = document.body.querySelector<HTMLInputElement>('#garage-services-filter-query');
      expect(modalInput).toBeTruthy();

      await dispatchInputChange(modalInput!, 'brake');

      expect(getVisibleServiceNames(container).sort()).toEqual(['Brake Inspection', 'Oil Change']);

      const saveButton = document.body.querySelector<HTMLButtonElement>('button[data-dialog-confirm="true"]');
      expect(saveButton).toBeTruthy();

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(getVisibleServiceNames(container)).toEqual(['Brake Inspection']);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('shows a toast when an edited service is hidden by active filters', async () => {
    localStorage.setItem('garage_services_nameFilter', 'oil');

    const services: GarageService[] = [
      {
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
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const onUpdateService = vi.fn(async () => {});
    const { container, root } = renderStatefulGarageServicesGrid({
      services,
      onUpdateService,
    });

    try {
      const input = container.querySelector<HTMLInputElement>('tbody input[data-col="0"]');
      expect(input).toBeTruthy();

      await startEditing(input!);
      await dispatchInputChange(input!, 'Brake Service');
      await dispatchEnter(input!);

      await waitForCondition(() => {
        expect(getVisibleServiceNames(container)).toEqual([]);
        expect(toastMock).toHaveBeenCalledWith({
          title: 'Service updated but hidden by filters',
          description: 'The service was updated, and it is no longer visible because of the current filters.',
        });
      });

      expect(onUpdateService).toHaveBeenCalledWith('service-1', { name: 'Brake Service' });
    } finally {
      unmount(root, container);
    }
  });

  it('defaults new services to a blank Type value', async () => {
    const onAddService = vi.fn(async () => ({
      id: 'service-2',
      user_id: 'user-1',
      vehicle_id: 'vehicle-1',
      name: 'Brake Service',
      type: null,
      monitoring: false,
      cadence_type: 'no_interval',
      every_miles: null,
      every_months: null,
      sort_order: 1,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }));

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={[]}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={onAddService}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );

    try {
      const addButton = document.body.querySelector('button[aria-label="Add service"]') as HTMLButtonElement | null;
      expect(addButton).toBeTruthy();

      await act(async () => {
        addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const nameInput = document.body.querySelector<HTMLInputElement>('#garage-service-name');
      expect(nameInput).toBeTruthy();
      await dispatchInputChange(nameInput!, 'Brake Service');

      const saveButton = document.body.querySelector<HTMLButtonElement>('button[data-dialog-confirm="true"]');
      expect(saveButton).toBeTruthy();

      await act(async () => {
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(onAddService).toHaveBeenCalledWith({
          id: expect.any(String),
          name: 'Brake Service',
          type: null,
          every_miles: null,
          every_months: null,
          notes: null,
        });
      });
    } finally {
      unmount(root, container);
    }
  });

  it('rejects duplicate inline service names with a warning dialog', async () => {
    const services: GarageService[] = [
      {
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
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'service-2',
        user_id: 'user-1',
        vehicle_id: 'vehicle-1',
        name: 'Brake Inspection',
        type: 'check',
        monitoring: true,
        cadence_type: 'recurring',
        every_miles: 12000,
        every_months: 12,
        sort_order: 1,
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const onUpdateService = vi.fn(async () => {});
    const { container, root } = renderStatefulGarageServicesGrid({
      services,
      onUpdateService,
    });

    try {
      const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('tbody input[data-col="0"]'));
      const targetInput = inputs.find((input) => input.value === 'Brake Inspection');
      expect(targetInput).toBeTruthy();

      await startEditing(targetInput!);
      await dispatchInputChange(targetInput!, ' Oil Change ');
      await dispatchEnter(targetInput!);

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Invalid Service Name');
        expect(document.body.textContent).toContain('Name must be unique for this vehicle.');
      });

      expect(onUpdateService).not.toHaveBeenCalled();
    } finally {
      unmount(root, container);
    }
  });

  it('revalidates CSV uploads and imports only the valid rows', async () => {
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
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }];

    const onImportServices = vi.fn(async () => {});
    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={services}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={async () => services[0]!}
        onUpdateService={async () => {}}
        onImportServices={onImportServices}
        onDeleteService={async () => {}}
      />,
    );

    try {
      const menuButton = document.body.querySelector('button[aria-label="Services menu"]') as HTMLButtonElement | null;
      expect(menuButton).toBeTruthy();

      await openButtonMenu(menuButton!);

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Bulk Import from CSV');
      });

      const menuItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((element) => element.textContent?.trim() === 'Bulk Import from CSV');
      expect(menuItem).toBeTruthy();

      await act(async () => {
        menuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(document.body.querySelector('#garage-service-import-file')).toBeTruthy();
      });
      const fileInput = document.body.querySelector<HTMLInputElement>('#garage-service-import-file');

      const invalidCsvText = 'Name,Type,Monitoring\nOil Change,Wrong,TRUE\n';
      const invalidCsv = new File([invalidCsvText], 'invalid.csv', { type: 'text/csv' });
      Object.defineProperty(invalidCsv, 'text', {
        configurable: true,
        value: async () => invalidCsvText,
      });
      setFileInputFiles(fileInput!, [invalidCsv]);

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Invalid Rows');
        expect(document.body.textContent).toContain('Oil Change');
      });

      const validCsvText = 'Name,Type,Every (Miles),Every (Months),Monitoring,Notes,Ignored\n'
        + 'Oil Change,Replacement,6000,,TRUE,Updated note,foo\n'
        + 'Tire Pressure,Check,,,FALSE,,bar\n'
        + 'Tire Pressure,Replacement,,,TRUE,,baz\n'
        + 'Wiper Blades,BadType,,,TRUE,,qux\n';
      const validCsv = new File([validCsvText], 'valid.csv', { type: 'text/csv' });
      Object.defineProperty(validCsv, 'text', {
        configurable: true,
        value: async () => validCsvText,
      });
      setFileInputFiles(fileInput!, [validCsv]);

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('New Services');
        expect(document.body.textContent).toContain('Updated Services');
        expect(document.body.textContent).toContain('Earlier Duplicate Rows');
        expect(document.body.textContent).toContain('Ignored Headers');
        expect(document.body.textContent).toContain('Tire Pressure');
        expect(document.body.textContent).toContain('Oil Change');
        expect(document.body.textContent).toContain('Wiper Blades');
        expect(document.body.textContent).toContain('Ignored because CSV row 4 uses the same Name and later rows win.');
        expect(document.body.textContent).toContain('Ignored');
      });

      const importButton = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button[data-dialog-confirm="true"]'))
        .find((button) => button.textContent?.includes('Import Services'));
      expect(importButton).toBeTruthy();

      await act(async () => {
        importButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(onImportServices).toHaveBeenCalledWith([
          {
            name: 'Tire Pressure',
            type: 'replacement',
            monitoring: true,
          },
          {
            name: 'Oil Change',
            type: 'replacement',
            every_miles: 6000,
            monitoring: true,
            notes: 'Updated note',
          },
        ]);
      });
    } finally {
      unmount(root, container);
    }
  });

  it('downloads the template CSV from the import dialog', async () => {
    const createObjectUrlMock = vi.fn(() => 'blob:test-template');
    const revokeObjectUrlMock = vi.fn();
    const anchorClickMock = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL ?? (() => {});
    const originalClick = HTMLAnchorElement.prototype.click;

    URL.createObjectURL = createObjectUrlMock;
    URL.revokeObjectURL = revokeObjectUrlMock;
    HTMLAnchorElement.prototype.click = anchorClickMock;

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={[]}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={async () => {
          throw new Error('unused');
        }}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );

    try {
      const menuButton = document.body.querySelector('button[aria-label="Services menu"]') as HTMLButtonElement | null;
      expect(menuButton).toBeTruthy();

      await openButtonMenu(menuButton!);

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Bulk Import from CSV');
      });

      const menuItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((element) => element.textContent?.trim() === 'Bulk Import from CSV');
      expect(menuItem).toBeTruthy();

      await act(async () => {
        menuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await waitForCondition(() => {
        expect(document.body.textContent).toContain('Download Template CSV');
      });
      const downloadButton = Array.from(document.body.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Download Template CSV'));
      expect(downloadButton).toBeTruthy();

      await act(async () => {
        downloadButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });

      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(anchorClickMock).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalClick;
      unmount(root, container);
    }
  });

  it('shows the blank marker for null service types', async () => {
    const services: GarageService[] = [{
      id: 'service-1',
      user_id: 'user-1',
      vehicle_id: 'vehicle-1',
      name: 'Chain Check',
      type: null,
      monitoring: false,
      cadence_type: 'no_interval',
      every_miles: null,
      every_months: null,
      sort_order: 0,
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }];

    const { container, root } = mount(
      <GarageServicesGrid
        userId=""
        services={services}
        servicings={[]}
        loading={false}
        vehicleName="Test Car"
        onAddService={async () => services[0]!}
        onUpdateService={async () => {}}
        onImportServices={async () => {}}
        onDeleteService={async () => {}}
      />,
    );

    try {
      await waitForCondition(() => {
        expect(container.textContent).toContain('—');
      });
    } finally {
      unmount(root, container);
    }
  });
});

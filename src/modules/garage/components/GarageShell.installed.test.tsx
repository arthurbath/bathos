import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GarageShell } from '@/modules/garage/components/GarageShell';

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: () => <header data-testid="topline-header" />,
}));
vi.mock('@/platform/components/MobileBottomNav', () => ({
  MobileBottomNav: () => <nav data-testid="mobile-nav" />,
}));
vi.mock('@/platform/components/InstalledAppAccountCard', () => ({
  InstalledAppAccountCard: () => null,
}));
vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/garage',
}));
vi.mock('@/modules/garage/hooks/useGarageVehicles', () => ({
  useGarageVehicles: () => ({
    vehicles: [
      { id: 'vehicle-1', name: 'First', is_active: true, current_odometer_miles: 1 },
      { id: 'vehicle-2', name: 'Second', is_active: false, current_odometer_miles: 2 },
    ],
    activeVehicle: { id: 'vehicle-1', name: 'First', is_active: true, current_odometer_miles: 1 },
    loading: false,
    addVehicle: vi.fn(),
    updateVehicle: vi.fn(async () => ({})),
    removeVehicle: vi.fn(),
  }),
}));
vi.mock('@/modules/garage/hooks/useGarageServices', () => ({
  useGarageServices: () => ({
    services: [],
    loading: false,
    addService: vi.fn(),
    updateService: vi.fn(),
    importServices: vi.fn(),
    removeService: vi.fn(),
  }),
}));
vi.mock('@/modules/garage/hooks/useGarageServicings', () => ({
  useGarageServicings: () => ({
    servicings: [],
    loading: false,
    addServicing: vi.fn(),
    updateServicing: vi.fn(),
    removeServicing: vi.fn(),
    createReceiptSignedUrl: vi.fn(),
  }),
}));
vi.mock('@/modules/garage/hooks/useGarageDue', () => ({
  useGarageDue: () => ({ grouped: [] }),
}));
vi.mock('@/modules/garage/components/GarageDueView', () => ({
  GarageDueView: () => <div data-testid="due-view" />,
}));
vi.mock('@/modules/garage/components/GarageServicesGrid', () => ({
  GarageServicesGrid: () => null,
}));
vi.mock('@/modules/garage/components/GarageServicingsGrid', () => ({
  GarageServicingsGrid: () => null,
}));
vi.mock('@/modules/garage/components/GarageConfigView', () => ({
  GarageConfigView: () => null,
}));

function setStandaloneMode(enabled: boolean) {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: enabled,
  });
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/garage/due']}>
        <GarageShell
          userId="user-1"
          displayName="Art"
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    );
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('GarageShell installed selector', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setStandaloneMode(false);
  });

  it('moves the vehicle selector into the page body only while installed', () => {
    setStandaloneMode(true);
    const installed = mount();
    try {
      expect(installed.container.querySelector('[role="combobox"][aria-label="Active Vehicle"]')).toBeTruthy();
    } finally {
      cleanup(installed.root, installed.container);
    }

    setStandaloneMode(false);
    const browser = mount();
    try {
      expect(browser.container.querySelector('[role="combobox"][aria-label="Active Vehicle"]')).toBeNull();
    } finally {
      cleanup(browser.root, browser.container);
    }
  });
});

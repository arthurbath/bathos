import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { GarageDueView } from '@/modules/garage/components/GarageDueView';
import type { GarageDueItem } from '@/modules/garage/types/garage';

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

function makeDueItem(overrides: Partial<GarageDueItem> = {}): GarageDueItem {
  return {
    service: {
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
    },
    bucket: 'upcoming',
    lastPerformedDate: null,
    lastPerformedMileage: null,
    lastConfirmedNotNeededDate: null,
    remainingMiles: null,
    remainingMonths: null,
    dueMileage: null,
    dueDate: null,
    daysUntilDue: null,
    ...overrides,
  };
}

describe('GarageDueView', () => {
  it('renders the blank marker for null service types', () => {
    const { container, root } = mount(
      <GarageDueView
        grouped={{ due: [makeDueItem()], upcoming: [] }}
        onUpdateServiceMonitoring={async () => {}}
      />,
    );

    try {
      expect(container.textContent).toContain('—');
    } finally {
      unmount(root, container);
    }
  });
});

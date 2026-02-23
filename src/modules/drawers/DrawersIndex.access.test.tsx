import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DrawersIndex from '@/modules/drawers/DrawersIndex';

const mockAuth = vi.fn();
const mockHouseholdData = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('@/modules/drawers/hooks/useDrawersHouseholdData', () => ({
  useDrawersHouseholdData: () => mockHouseholdData(),
}));

vi.mock('@/platform/components/AuthPage', () => ({
  default: () => <div data-testid="auth-page" />,
}));

vi.mock('@/modules/drawers/components/DrawersHouseholdSetup', () => ({
  DrawersHouseholdSetup: () => <div data-testid="drawers-setup" />,
}));

vi.mock('@/modules/drawers/components/DrawersPlanner', () => ({
  DrawersPlanner: () => <div data-testid="drawers-planner" />,
}));

function renderComponent() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/drawers/plan']}>
        <DrawersIndex />
      </MemoryRouter>,
    );
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('DrawersIndex access', () => {
  it('shows setup for signed-in users without a drawers household', () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      signOut: vi.fn(),
    });

    mockHouseholdData.mockReturnValue({
      household: null,
      loading: false,
      displayName: 'User',
      createHousehold: vi.fn(),
      joinHousehold: vi.fn(),
    });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="drawers-setup"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows planner for signed-in users with a drawers household', () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      signOut: vi.fn(),
    });

    mockHouseholdData.mockReturnValue({
      household: {
        householdId: 'hh-1',
        householdName: 'My Household',
        inviteCode: 'abc123',
        displayName: 'User',
      },
      loading: false,
      displayName: 'User',
      createHousehold: vi.fn(),
      joinHousehold: vi.fn(),
    });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="drawers-planner"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows auth page for signed-out users', () => {
    mockAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    });

    mockHouseholdData.mockReturnValue({
      household: null,
      loading: false,
      displayName: 'User',
      createHousehold: vi.fn(),
      joinHousehold: vi.fn(),
    });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="auth-page"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });
});

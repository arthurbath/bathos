import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LauncherPage from '@/platform/components/LauncherPage';

const mockNavigate = vi.fn();
const mockAuthContext = vi.fn();
const mockIsAdmin = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/platform/contexts/AuthContext', () => ({
  useAuthContext: () => mockAuthContext(),
}));

vi.mock('@/platform/hooks/useIsAdmin', () => ({
  useIsAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: () => <header data-testid="topline-header" />,
}));

vi.mock('@/platform/components/AuthPage', () => ({
  default: () => <div data-testid="auth-page" />,
}));

function renderLauncher() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/']}>
        <LauncherPage />
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

describe('LauncherPage modules', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockIsAdmin.mockReset();
  });

  it('shows Budget, Drawer Planner, Garage, and Ticket Estimator for signed-in users', () => {
    mockAuthContext.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      signOut: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ isAdmin: false, loading: false, resolved: true });

    const { container, root } = renderLauncher();

    try {
      expect(container.textContent).toContain('Budget');
      expect(container.textContent).toContain('Drawer Planner');
      expect(container.textContent).toContain('Garage');
      expect(container.textContent).toContain('Ticket Estimator');
      expect(container.textContent).not.toContain('Administration');
      expect(mockNavigate).not.toHaveBeenCalledWith('/budget/summary', { replace: true });
    } finally {
      cleanup(root, container);
    }
  });

  it('shows Exercise and Administration for admin users', () => {
    mockAuthContext.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      signOut: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ isAdmin: true, loading: false, resolved: true });

    const { container, root } = renderLauncher();

    try {
      expect(container.textContent).toContain('Garage');
      expect(container.textContent).toContain('Ticket Estimator');
      expect(container.textContent).toContain('Exercise');
      expect(container.textContent).toContain('Administration');
      expect(container.textContent).toContain('Admin');
    } finally {
      cleanup(root, container);
    }
  });

  it('shows auth page when user is signed out', () => {
    mockAuthContext.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ isAdmin: false, loading: false, resolved: true });

    const { container, root } = renderLauncher();

    try {
      expect(container.querySelector('[data-testid="auth-page"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });
});

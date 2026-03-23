import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExerciseIndex from '@/modules/exercise/ExerciseIndex';

const mockAuth = vi.fn();
const mockIsAdmin = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('@/platform/hooks/useIsAdmin', () => ({
  useIsAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock('@/platform/components/AuthPage', () => ({
  default: () => <div data-testid="auth-page" />,
}));

vi.mock('@/modules/exercise/components/ExerciseShell', () => ({
  ExerciseShell: () => <div data-testid="exercise-shell" />,
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div data-testid="not-found" />,
}));

function renderComponent() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/exercise/routines']}>
        <Routes>
          <Route path="/exercise/routines" element={<ExerciseIndex />} />
        </Routes>
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

describe('ExerciseIndex access', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockIsAdmin.mockReset();
  });

  it('shows the exercise shell for signed-in admins', () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: false,
      signOut: vi.fn(),
      isSigningOut: false,
      displayName: 'Art',
    });
    mockIsAdmin.mockReturnValue({ isAdmin: true, loading: false, resolved: true });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="exercise-shell"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows auth page for signed-out users', () => {
    mockAuth.mockReturnValue({
      user: null,
      loading: false,
      signOut: vi.fn(),
      isSigningOut: false,
      displayName: '',
    });
    mockIsAdmin.mockReturnValue({ isAdmin: false, loading: false, resolved: true });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="auth-page"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('returns not found for signed-in non-admin users', () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-2' },
      loading: false,
      signOut: vi.fn(),
      isSigningOut: false,
      displayName: 'Art',
    });
    mockIsAdmin.mockReturnValue({ isAdmin: false, loading: false, resolved: true });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[data-testid="not-found"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows a loading spinner while auth or role checks are unresolved', () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-1' },
      loading: true,
      signOut: vi.fn(),
      isSigningOut: false,
      displayName: 'Art',
    });
    mockIsAdmin.mockReturnValue({ isAdmin: true, loading: true, resolved: false });

    const { container, root } = renderComponent();
    try {
      expect(container.querySelector('[role="status"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="exercise-shell"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });
});

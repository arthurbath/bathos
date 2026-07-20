import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import TasksIndex from '@/modules/tasks/TasksIndex';

const mockAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('@/platform/components/AuthPage', () => ({
  default: () => <div data-testid="auth-page" />,
}));

vi.mock('@/modules/tasks/runtime/TasksRuntime', () => ({
  TasksRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tasks-runtime">{children}</div>
  ),
}));

vi.mock('@/modules/tasks/components/TasksShell', () => ({
  TasksShell: () => <div data-testid="tasks-shell" />,
}));

function renderComponent() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<TasksIndex />);
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('TasksIndex access', () => {
  it('opens the owner-bound runtime for a signed-in user', () => {
    mockAuth.mockReturnValue({
      user: { id: 'owner-a' },
      displayName: 'Owner',
      loading: false,
      isSigningOut: false,
      signOut: vi.fn(),
    });
    const { container, root } = renderComponent();

    try {
      expect(container.querySelector('[data-testid="tasks-runtime"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="tasks-shell"]')).toBeTruthy();
    } finally {
      cleanup(root, container);
    }
  });

  it('shows authentication when signed out', () => {
    mockAuth.mockReturnValue({
      user: null,
      displayName: '',
      loading: false,
      isSigningOut: false,
      signOut: vi.fn(),
    });
    const { container, root } = renderComponent();

    try {
      expect(container.querySelector('[data-testid="auth-page"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="tasks-runtime"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });

  it('waits for authentication to resolve before opening local data', () => {
    mockAuth.mockReturnValue({
      user: { id: 'owner-a' },
      displayName: 'Owner',
      loading: true,
      isSigningOut: false,
      signOut: vi.fn(),
    });
    const { container, root } = renderComponent();

    try {
      expect(container.querySelector('[role="status"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="tasks-runtime"]')).toBeNull();
    } finally {
      cleanup(root, container);
    }
  });
});

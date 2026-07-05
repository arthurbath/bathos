import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '@/platform/components/AuthPage';

const mockNavigate = vi.fn();
const mockAuthContext = vi.fn();
const mockToast = vi.fn();

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

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/components/PasswordRequirements', () => ({
  PasswordRequirements: () => <div data-testid="password-requirements" />,
}));

function renderAt(initialEntry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthPage />
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

describe('AuthPage redirect after sign-in', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockAuthContext.mockReset();
    mockToast.mockReset();
  });

  it('redirects to the next path when a session is already present', () => {
    mockAuthContext.mockReturnValue({
      session: { user: { id: 'user-1' } },
      signIn: vi.fn(),
      signUp: vi.fn(),
    });

    const { root, container } = renderAt('/signin?next=%2Fbudget%2Fsummary');

    try {
      expect(mockNavigate).toHaveBeenCalledWith('/budget/summary', { replace: true });
    } finally {
      cleanup(root, container);
    }
  });

  it('redirects to the launcher when no next path is provided', () => {
    mockAuthContext.mockReturnValue({
      session: { user: { id: 'user-1' } },
      signIn: vi.fn(),
      signUp: vi.fn(),
    });

    const { root, container } = renderAt('/signin');

    try {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    } finally {
      cleanup(root, container);
    }
  });

  it('ignores an unsafe next path and redirects to the launcher', () => {
    mockAuthContext.mockReturnValue({
      session: { user: { id: 'user-1' } },
      signIn: vi.fn(),
      signUp: vi.fn(),
    });

    const { root, container } = renderAt('/signin?next=%2F%2Fevil.com');

    try {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    } finally {
      cleanup(root, container);
    }
  });
});

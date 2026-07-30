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

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange }: { id?: string; checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input
      data-testid="checkbox"
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

let capturedOnValueChange: ((value: string) => void) | null = null;

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange?: (value: string) => void }) => {
    capturedOnValueChange = onValueChange ?? null;
    return <div data-testid="tabs" data-value={value}>{children}</div>;
  },
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-testid={`tabs-content-${value}`}>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button role="tab" data-value={value}>{children}</button>
  ),
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

  it('preserves the next param when switching tabs', () => {
    mockAuthContext.mockReturnValue({
      session: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
    });

    const { root, container } = renderAt('/signin?next=%2F.lovable%2Foauth%2Fconsent%3Fid%3D123');

    try {
      expect(capturedOnValueChange).toBeTruthy();
      act(() => {
        capturedOnValueChange?.('signup');
      });
      expect(mockNavigate).toHaveBeenCalledWith(
        '/signup?next=%2F.lovable%2Foauth%2Fconsent%3Fid%3D123',
        { replace: true },
      );
    } finally {
      cleanup(root, container);
    }
  });

  it('exposes the correct credential semantics for sign-in and sign-up', () => {
    mockAuthContext.mockReturnValue({
      session: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
    });

    const { root, container } = renderAt('/signin');

    try {
      const login = container.querySelector('[data-testid="tabs-content-login"]');
      const signup = container.querySelector('[data-testid="tabs-content-signup"]');

      expect(login?.querySelector('input[type="email"]')).toMatchObject({
        autocomplete: 'username',
        name: 'email',
      });
      expect(login?.querySelector('input[type="password"]')).toMatchObject({
        autocomplete: 'current-password',
        name: 'password',
      });
      expect(signup?.querySelector('input[name="name"]')).toMatchObject({
        autocomplete: 'name',
      });
      expect(signup?.querySelector('input[type="email"]')).toMatchObject({
        autocomplete: 'username',
        name: 'email',
      });
      expect(signup?.querySelector('input[type="password"]')).toMatchObject({
        autocomplete: 'new-password',
        name: 'new-password',
      });
    } finally {
      cleanup(root, container);
    }
  });
});

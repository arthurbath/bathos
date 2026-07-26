import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AccountPage from '@/platform/components/AccountPage';

const mockAuthContext = vi.fn();
const mockIsAdmin = vi.fn();
const toastMock = vi.fn();

vi.mock('@/platform/contexts/AuthContext', () => ({
  useAuthContext: () => mockAuthContext(),
}));

vi.mock('@/platform/hooks/useIsAdmin', () => ({
  useIsAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: () => <header data-testid="topline-header" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
    },
    functions: {
      invoke: vi.fn(async () => ({ data: { success: true }, error: null })),
    },
  },
}));

describe('AccountPage', () => {
  function mountAccountPage() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/account']}>
          <AccountPage />
        </MemoryRouter>,
      );
    });

    return { container, root };
  }

  function unmount(root: Root, container: HTMLElement) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }

  beforeEach(() => {
    mockAuthContext.mockReset();
    mockIsAdmin.mockReset();
    toastMock.mockReset();

    mockAuthContext.mockReturnValue({
      user: { id: 'user-1', email: 'art@example.com' },
      isSigningOut: false,
      signOut: vi.fn(),
      displayName: 'Art',
      setDisplayName: vi.fn(),
    });
    mockIsAdmin.mockReturnValue({ isAdmin: false });
  });

  it('opens the change email dialog from the inline email pencil trigger', () => {
    const { container, root } = mountAccountPage();

    try {
      expect(container.textContent).not.toContain('Change Email');
      expect(container.textContent).toContain('art@example.com');

      const changeEmailButton = container.querySelector('button[aria-label="Change Email"]') as HTMLButtonElement | null;
      expect(changeEmailButton).toBeTruthy();

      act(() => {
        changeEmailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(document.body.textContent).toContain('Change Email');
      const currentEmailInput = document.body.querySelector('input[value="art@example.com"]') as HTMLInputElement | null;
      expect(currentEmailInput).toBeTruthy();
    } finally {
      unmount(root, container);
    }
  });
});

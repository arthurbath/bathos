import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuthContext } from '@/platform/contexts/AuthContext';

const getSessionMock = vi.fn();
const signOutMock = vi.fn();
const unsubscribeMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

let authStateChangeHandler: ((event: string, session: Session | null) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: {
      onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
        authStateChangeHandler = callback;
        return { data: { subscription: { unsubscribe: unsubscribeMock } } };
      },
      getSession: (...args: unknown[]) => getSessionMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

function Consumer() {
  const { user, loading, displayName, signOut } = useAuthContext();
  return (
    <div data-testid="state" data-user-id={user?.id ?? ''} data-loading={String(loading)} data-display-name={displayName}>
      <button type="button" onClick={() => void signOut()}>Sign Out</button>
    </div>
  );
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitForCondition(assertion: () => void, timeoutMs = 1500) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 16));
    });
  }

  throw lastError instanceof Error ? lastError : new Error('Condition not met before timeout');
}

describe('AuthProvider', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  beforeEach(() => {
    authStateChangeHandler = null;
    getSessionMock.mockReset();
    signOutMock.mockReset();
    unsubscribeMock.mockReset();
    maybeSingleMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    fromMock.mockReset();

    maybeSingleMock.mockResolvedValue({ data: { display_name: 'Art' }, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1', email: 'user@example.com' },
        },
      },
    });
  });

  it('ignores TOKEN_REFRESHED events that have a null session', async () => {
    const { container, root } = mount();
    try {
      const state = container.querySelector<HTMLElement>('[data-testid="state"]');
      expect(state).toBeTruthy();

      await waitForCondition(() => {
        expect(state?.getAttribute('data-loading')).toBe('false');
        expect(state?.getAttribute('data-user-id')).toBe('user-1');
        expect(state?.getAttribute('data-display-name')).toBe('Art');
      });

      act(() => {
        authStateChangeHandler?.('TOKEN_REFRESHED', null);
      });

      expect(state?.getAttribute('data-loading')).toBe('false');
      expect(state?.getAttribute('data-user-id')).toBe('user-1');
    } finally {
      cleanup(root, container);
    }
  });

  it('clears user when SIGNED_OUT arrives after an authenticated session', async () => {
    const { container, root } = mount();
    try {
      const state = container.querySelector<HTMLElement>('[data-testid="state"]');
      expect(state).toBeTruthy();

      await waitForCondition(() => {
        expect(state?.getAttribute('data-loading')).toBe('false');
        expect(state?.getAttribute('data-user-id')).toBe('user-1');
      });

      act(() => {
        authStateChangeHandler?.('SIGNED_OUT', null);
      });

      expect(state?.getAttribute('data-loading')).toBe('false');
      expect(state?.getAttribute('data-user-id')).toBe('');
    } finally {
      cleanup(root, container);
    }
  });

  it('does not lose a restoring session when startup SIGNED_OUT fires first', async () => {
    const deferredSession = createDeferred<{ data: { session: { user: { id: string; email: string } } } }>();
    getSessionMock.mockReturnValueOnce(deferredSession.promise);

    const { container, root } = mount();
    try {
      const state = container.querySelector<HTMLElement>('[data-testid="state"]');
      expect(state).toBeTruthy();

      act(() => {
        authStateChangeHandler?.('SIGNED_OUT', null);
      });

      expect(state?.getAttribute('data-loading')).toBe('false');
      expect(state?.getAttribute('data-user-id')).toBe('');

      await act(async () => {
        deferredSession.resolve({
          data: {
            session: { user: { id: 'user-1', email: 'user@example.com' } },
          },
        });
        await deferredSession.promise;
      });

      await waitForCondition(() => {
        expect(state?.getAttribute('data-user-id')).toBe('user-1');
        expect(state?.getAttribute('data-loading')).toBe('false');
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('unsubscribes user-bound browser push before completing sign-out', async () => {
    const pushUnsubscribe = vi.fn().mockResolvedValue(true);
    const getSubscription = vi.fn().mockResolvedValue({ unsubscribe: pushUnsubscribe });
    const getRegistration = vi.fn().mockResolvedValue({ pushManager: { getSubscription } });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration },
    });
    signOutMock.mockResolvedValue({ error: null });

    const { container, root } = mount();
    try {
      await waitForCondition(() => {
        expect(container.querySelector<HTMLElement>('[data-testid="state"]')
          ?.getAttribute('data-user-id')).toBe('user-1');
      });

      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')?.click();
      });

      expect(getRegistration).toHaveBeenCalledWith('/');
      expect(pushUnsubscribe).toHaveBeenCalledOnce();
      expect(signOutMock).toHaveBeenCalledOnce();
      expect(pushUnsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
        signOutMock.mock.invocationCallOrder[0],
      );
    } finally {
      cleanup(root, container);
    }
  });
});

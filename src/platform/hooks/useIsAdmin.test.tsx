import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsAdmin } from '@/platform/hooks/useIsAdmin';

const maybeSingleMock = vi.fn();
const getUserMock = vi.fn();

const queryBuilder = {
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: (...args: unknown[]) => maybeSingleMock(...args),
};

queryBuilder.select.mockImplementation(() => queryBuilder);
queryBuilder.eq.mockImplementation(() => queryBuilder);

const fromMock = vi.fn((_table: string) => queryBuilder);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
    from: (table: string) => fromMock(table),
  },
}));

function HookHarness({ userId }: { userId?: string }) {
  const { isAdmin, loading, resolved } = useIsAdmin(userId);
  return <div data-testid="state" data-loading={String(loading)} data-admin={String(isAdmin)} data-resolved={String(resolved)} />;
}

function mount(userId?: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<HookHarness userId={userId} />);
  });

  const rerender = (nextUserId?: string) => {
    act(() => {
      root.render(<HookHarness userId={nextUserId} />);
    });
  };

  return { container, root, rerender };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function getStateElement(container: HTMLElement) {
  const state = container.querySelector<HTMLElement>('[data-testid="state"]');
  expect(state).toBeTruthy();
  return state as HTMLElement;
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

describe('useIsAdmin', () => {
  beforeEach(() => {
    window.localStorage.clear();
    fromMock.mockClear();
    queryBuilder.select.mockClear();
    queryBuilder.eq.mockClear();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it('enters loading when userId appears and waits to resolve admin status', async () => {
    const deferred = createDeferred<{ data: { role: string } | null; error: null }>();
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-100' } }, error: null });
    maybeSingleMock.mockReturnValueOnce(deferred.promise);

    const { container, root, rerender } = mount(undefined);
    try {
      const state = getStateElement(container);
      expect(state.getAttribute('data-loading')).toBe('false');
      expect(state.getAttribute('data-admin')).toBe('false');
      expect(state.getAttribute('data-resolved')).toBe('true');

      rerender('user-100');
      expect(state.getAttribute('data-loading')).toBe('true');
      expect(state.getAttribute('data-admin')).toBe('false');
      expect(state.getAttribute('data-resolved')).toBe('false');

      await act(async () => {
        deferred.resolve({ data: { role: 'admin' }, error: null });
        await deferred.promise;
      });

      await waitForCondition(() => {
        expect(state.getAttribute('data-loading')).toBe('false');
        expect(state.getAttribute('data-admin')).toBe('true');
        expect(state.getAttribute('data-resolved')).toBe('true');
      });
    } finally {
      cleanup(root, container);
    }
  });

  it('ignores stale role checks when userId changes mid-request', async () => {
    const first = createDeferred<{ data: { role: string } | null; error: null }>();
    const second = createDeferred<{ data: { role: string } | null; error: null }>();

    getUserMock.mockResolvedValue({ data: { user: { id: 'user-200' } }, error: null });

    maybeSingleMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { container, root, rerender } = mount('user-200');
    try {
      const state = getStateElement(container);
      expect(state.getAttribute('data-loading')).toBe('true');
      expect(state.getAttribute('data-resolved')).toBe('false');

      await waitForCondition(() => {
        expect(maybeSingleMock).toHaveBeenCalledTimes(1);
      });

      getUserMock.mockResolvedValue({ data: { user: { id: 'user-201' } }, error: null });
      rerender('user-201');
      expect(state.getAttribute('data-loading')).toBe('true');

      await act(async () => {
        second.resolve({ data: { role: 'admin' }, error: null });
        await second.promise;
      });

      await waitForCondition(() => {
        expect(state.getAttribute('data-loading')).toBe('false');
        expect(state.getAttribute('data-admin')).toBe('true');
        expect(state.getAttribute('data-resolved')).toBe('true');
      });

      await act(async () => {
        first.resolve({ data: null, error: null });
        await first.promise;
      });

      expect(state.getAttribute('data-admin')).toBe('true');
    } finally {
      cleanup(root, container);
    }
  });

  it('requires a confirmed false result before resolving non-admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-300' } }, error: null });
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { container, root, rerender } = mount(undefined);
    try {
      const state = getStateElement(container);
      rerender('user-300');

      expect(state.getAttribute('data-loading')).toBe('true');
      expect(state.getAttribute('data-resolved')).toBe('false');

      await waitForCondition(() => {
        expect(maybeSingleMock).toHaveBeenCalledTimes(4);
      }, 2000);

      await waitForCondition(() => {
        expect(state.getAttribute('data-loading')).toBe('false');
        expect(state.getAttribute('data-resolved')).toBe('true');
        expect(state.getAttribute('data-admin')).toBe('false');
      });
    } finally {
      cleanup(root, container);
    }
  });
});

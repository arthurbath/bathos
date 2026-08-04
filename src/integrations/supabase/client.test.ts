import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ kind: 'supabase-client' }));
const companionLock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('./authLock', () => ({
  resolveSupabaseAuthLock: () => companionLock,
}));

describe('shared Supabase browser client', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    vi.resetModules();
  });

  it('enables bounded PostgREST retries and preserves the selected auth lock', async () => {
    await import('./client');

    expect(createClientMock).toHaveBeenCalledOnce();
    expect(createClientMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        db: { retry: true },
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
          lock: companionLock,
        }),
      }),
    );
  });
});

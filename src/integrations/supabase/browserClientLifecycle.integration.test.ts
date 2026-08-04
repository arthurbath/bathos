// @vitest-environment node

import { createHmac } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from './types';

const integrationEnabled = process.env.RUN_SUPABASE_BROWSER_CLIENT_LIFECYCLE === '1';
const localSupabaseUrl = process.env.TASKS_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const localSupabaseAnonKey = process.env.TASKS_TEST_SUPABASE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const fallbackLocalJwtSecret = 'super-secret-jwt-token-with-at-least-32-characters-long';
const storageKey = 'bathos-browser-client-lifecycle';

let adminClient: SupabaseClient<Database> | null = null;
let syntheticUserId: string | null = null;

afterAll(async () => {
  if (adminClient && syntheticUserId) {
    await adminClient.auth.admin.deleteUser(syntheticUserId).catch(() => undefined);
  }
});

describe.skipIf(!integrationEnabled)('Supabase browser client lifecycle integration', () => {
  it('creates, refreshes, restores, and signs out a synthetic local session', async () => {
    const initialStorage = createMemoryStorage();
    const initialClient = createBrowserLikeClient(initialStorage);
    adminClient = createClient<Database>(localSupabaseUrl, createLocalServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = `bathos-browser-client-${Date.now()}-${crypto.randomUUID()}@example.test`;
    const { data: signUp, error: signUpError } = await initialClient.auth.signUp({
      email,
      password: `BathOS-${crypto.randomUUID()}-browser-client`,
    });
    expect(signUpError).toBeNull();
    expect(signUp.session).not.toBeNull();
    expect(signUp.user).not.toBeNull();
    syntheticUserId = signUp.user?.id ?? null;

    const { data: refreshed, error: refreshError } = await initialClient.auth.refreshSession();
    expect(refreshError).toBeNull();
    expect(refreshed.session?.user.id).toBe(syntheticUserId);

    const restorationStorage = createMemoryStorage(initialStorage.snapshot());
    const restoredClient = createBrowserLikeClient(restorationStorage);
    const { data: restored, error: restoreError } = await restoredClient.auth.getSession();
    expect(restoreError).toBeNull();
    expect(restored.session?.user.id).toBe(syntheticUserId);

    const { error: signOutError } = await restoredClient.auth.signOut();
    expect(signOutError).toBeNull();
    const { data: signedOut } = await restoredClient.auth.getSession();
    expect(signedOut.session).toBeNull();
    expect(restorationStorage.getItem(storageKey)).toBeNull();
  });
});

function createBrowserLikeClient(storage: ReturnType<typeof createMemoryStorage>) {
  return createClient<Database, 'public'>(localSupabaseUrl, localSupabaseAnonKey, {
    db: { retry: true },
    auth: {
      storage,
      storageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function createMemoryStorage(seed: ReadonlyMap<string, string> = new Map()) {
  const values = new Map(seed);
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    snapshot() {
      return new Map(values);
    },
  };
}

function createLocalServiceRoleKey(): string {
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtPart({
    iss: 'supabase-demo',
    role: 'service_role',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac(
    'sha256',
    process.env.TASKS_TEST_SUPABASE_JWT_SECRET ?? fallbackLocalJwtSecret,
  ).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function encodeJwtPart(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

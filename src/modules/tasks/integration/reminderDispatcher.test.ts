import { describe, expect, it, vi } from 'vitest';

import {
  createReminderDispatchHandler,
  isTrustedWebPushEndpoint,
  providerFailure,
  resolveSupabaseSecretKey,
  type PushDelivery,
  type ReminderDispatchClient,
} from '../../../../supabase/functions/dispatch-task-reminders/handler';

const dispatchSecret = 'dispatch-secret-for-tests-32-bytes';

const configuration = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'server-secret-key',
  TASKS_REMINDER_DISPATCH_SECRET: dispatchSecret,
  TASKS_WEB_PUSH_VAPID_PUBLIC_KEY: 'public-key',
  TASKS_WEB_PUSH_VAPID_PRIVATE_KEY: 'private-key',
  TASKS_WEB_PUSH_SUBJECT: 'mailto:owner@example.test',
};

const delivery = (id: string): PushDelivery => ({
  delivery_id: id,
  occurrence_id: `occurrence-${id}`,
  title: `Title ${id}`,
  preview: 'title',
  navigate_url: `/tasks/today?reminder_delivery=${id}`,
  subscription: {
    endpoint: `https://web.push.apple.com/${id}`,
    keys: { p256dh: 'p256dh', auth: 'auth' },
  },
});

function buildHandler(options?: {
  environment?: Partial<Record<keyof typeof configuration, string | null>>;
  claim?: ReminderDispatchClient['claim'];
  record?: ReminderDispatchClient['record'];
  sendPush?: (value: PushDelivery) => Promise<void>;
  createClient?: () => ReminderDispatchClient;
}) {
  const values = { ...configuration, ...options?.environment };
  const claim = options?.claim ?? vi.fn(async () => ({
    data: { outcome: 'accepted', through_at: '2026-07-20T12:00:00.000Z', items: [] },
    error: null,
  }));
  const record = options?.record ?? vi.fn(async () => ({ error: null }));
  const sendPush = options?.sendPush ?? vi.fn(async () => undefined);
  const errors: string[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const handler = createReminderDispatchHandler({
    getEnvironment: (name) => values[name as keyof typeof values] ?? null,
    createClient: options?.createClient ?? (() => ({ claim, record })),
    sendPush,
    now: () => new Date('2026-07-20T12:00:00.000Z'),
    logError: (message) => errors.push(message),
    logInfo: (entry) => logs.push(entry),
  });
  return { handler, claim, record, sendPush, errors, logs };
}

describe('task reminder dispatcher handler', () => {
  it('accepts only HTTPS endpoints owned by approved browser push providers', () => {
    expect(isTrustedWebPushEndpoint('https://web.push.apple.com/Q-device')).toBe(true);
    expect(isTrustedWebPushEndpoint('https://fcm.googleapis.com/fcm/send/device')).toBe(true);
    expect(isTrustedWebPushEndpoint('https://android.googleapis.com/gcm/send/device')).toBe(true);
    expect(isTrustedWebPushEndpoint(
      'https://updates.push.services.mozilla.com/wpush/v2/device',
    )).toBe(true);
    expect(isTrustedWebPushEndpoint('https://db3.notify.windows.com/?token=device')).toBe(true);

    expect(isTrustedWebPushEndpoint('http://web.push.apple.com/Q-device')).toBe(false);
    expect(isTrustedWebPushEndpoint('https://127.0.0.1/internal')).toBe(false);
    expect(isTrustedWebPushEndpoint('https://web.push.apple.com.attacker.test/device')).toBe(false);
    expect(isTrustedWebPushEndpoint('https://user@web.push.apple.com/device')).toBe(false);
    expect(isTrustedWebPushEndpoint('https://push.example.test/device')).toBe(false);
  });

  it('resolves current hosted, current local, and legacy secret-key shapes', () => {
    expect(resolveSupabaseSecretKey((name) => name === 'SUPABASE_SECRET_KEYS'
      ? JSON.stringify({ default: 'hosted-key' })
      : null)).toBe('hosted-key');
    expect(resolveSupabaseSecretKey((name) => name === 'SUPABASE_SECRET_KEY'
      ? 'local-key'
      : null)).toBe('local-key');
    expect(resolveSupabaseSecretKey((name) => name === 'SUPABASE_SERVICE_ROLE_KEY'
      ? 'legacy-key'
      : null)).toBe('legacy-key');
    expect(resolveSupabaseSecretKey(() => null)).toBeNull();
  });

  it('rejects unsupported methods before constructing a privileged client', async () => {
    const { handler, claim } = buildHandler();
    const response = await handler(new Request('https://example.test', { method: 'GET' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(claim).not.toHaveBeenCalled();
  });

  it('reports missing configuration without attempting a claim', async () => {
    const { handler, claim } = buildHandler({
      environment: { TASKS_WEB_PUSH_VAPID_PRIVATE_KEY: null },
    });
    const response = await handler(new Request('https://example.test', { method: 'POST' }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Reminder delivery is not configured' });
    expect(claim).not.toHaveBeenCalled();
  });

  it('rejects a weak configured dispatch secret', async () => {
    const { handler, claim } = buildHandler({
      environment: { TASKS_REMINDER_DISPATCH_SECRET: 'too-short' },
    });
    const response = await handler(new Request('https://example.test', { method: 'POST' }));
    expect(response.status).toBe(503);
    expect(claim).not.toHaveBeenCalled();
  });

  it('rejects an incorrect dispatch secret without attempting a claim', async () => {
    const { handler, claim } = buildHandler();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': 'incorrect' },
    }));
    expect(response.status).toBe(401);
    expect(claim).not.toHaveBeenCalled();
  });

  it('records accepted and revoked provider outcomes in bounded dispatch counts', async () => {
    const items = [delivery('delivery-a'), delivery('delivery-b')];
    const record = vi.fn(async () => ({ error: null }));
    const sendPush = vi.fn(async (item: PushDelivery) => {
      if (item.delivery_id === 'delivery-b') throw { statusCode: 410 };
    });
    const { handler, logs } = buildHandler({
      claim: vi.fn(async () => ({
        data: { outcome: 'accepted', through_at: '2026-07-20T12:00:00.000Z', items },
        error: null,
      })),
      record,
      sendPush,
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': dispatchSecret },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 2,
      accepted: 1,
      failed: 1,
      revoked: 1,
      receipt_errors: 0,
    });
    expect(record).toHaveBeenCalledWith({
      deliveryId: 'delivery-a',
      outcome: 'provider_accepted',
      errorCode: null,
      targetRevoked: false,
    });
    expect(record).toHaveBeenCalledWith({
      deliveryId: 'delivery-b',
      outcome: 'failed',
      errorCode: 'push_http_410',
      targetRevoked: true,
    });
    expect(logs).toEqual([expect.objectContaining({
      event: 'tasks_reminder_dispatch',
      claimed: 2,
      receipt_errors: 0,
    })]);
  });

  it('revokes an untrusted endpoint without issuing a provider request', async () => {
    const item = delivery('delivery-untrusted');
    item.subscription.endpoint = 'https://127.0.0.1/internal';
    const record = vi.fn(async () => ({ error: null }));
    const sendPush = vi.fn(async () => undefined);
    const { handler } = buildHandler({
      claim: vi.fn(async () => ({
        data: {
          outcome: 'accepted',
          through_at: '2026-07-20T12:00:00.000Z',
          items: [item],
        },
        error: null,
      })),
      record,
      sendPush,
    });

    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': dispatchSecret },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 1,
      accepted: 0,
      failed: 1,
      revoked: 1,
      receipt_errors: 0,
    });
    expect(sendPush).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith({
      deliveryId: 'delivery-untrusted',
      outcome: 'failed',
      errorCode: 'push_endpoint_untrusted',
      targetRevoked: true,
    });
  });

  it('fails the invocation when a provider outcome cannot be recorded', async () => {
    const { handler, errors } = buildHandler({
      claim: vi.fn(async () => ({
        data: {
          outcome: 'accepted',
          through_at: '2026-07-20T12:00:00.000Z',
          items: [delivery('delivery-a')],
        },
        error: null,
      })),
      record: vi.fn(async () => ({ error: { message: 'database unavailable' } })),
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': dispatchSecret },
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      claimed: 1,
      accepted: 0,
      failed: 0,
      revoked: 0,
      receipt_errors: 1,
    });
    expect(errors).toEqual(['Task reminder provider acceptance could not be recorded']);
  });

  it('returns content-free failures for claim errors and invalid claims', async () => {
    const failed = buildHandler({
      claim: vi.fn(async () => ({ data: null, error: { message: 'private detail' } })),
    });
    const invalid = buildHandler({
      claim: vi.fn(async () => ({ data: { unexpected: true }, error: null })),
    });
    const request = () => new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': dispatchSecret },
    });
    expect((await failed.handler(request())).status).toBe(500);
    expect((await invalid.handler(request())).status).toBe(500);
    expect(failed.errors).toEqual(['Task reminder claim failed']);
    expect(invalid.errors).toEqual(['Task reminder claim was invalid']);
  });

  it('contains thrown database failures without leaking their details', async () => {
    const claimFailure = buildHandler({
      claim: vi.fn(async () => {
        throw new Error('private claim detail');
      }),
    });
    const receiptFailure = buildHandler({
      claim: vi.fn(async () => ({
        data: {
          outcome: 'accepted',
          through_at: '2026-07-20T12:00:00.000Z',
          items: [delivery('delivery-a')],
        },
        error: null,
      })),
      record: vi.fn(async () => {
        throw new Error('private receipt detail');
      }),
    });
    const request = () => new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': dispatchSecret },
    });

    expect((await claimFailure.handler(request())).status).toBe(500);
    expect((await receiptFailure.handler(request())).status).toBe(500);
    expect(claimFailure.errors).toEqual(['Task reminder claim failed']);
    expect(receiptFailure.errors).toEqual([
      'Task reminder provider acceptance could not be recorded',
    ]);
  });

  it('contains privileged client construction failures', async () => {
    const { handler, errors } = buildHandler({
      createClient: () => {
        throw new Error('private client detail');
      },
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { 'x-tasks-dispatch-secret': dispatchSecret },
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Reminder service is unavailable' });
    expect(errors).toEqual(['Task reminder service client could not be created']);
  });

  it('classifies transport and terminal provider failures', () => {
    expect(providerFailure(new Error('offline'))).toEqual({
      code: 'push_transport_error',
      revoked: false,
    });
    expect(providerFailure({ statusCode: 404 })).toEqual({
      code: 'push_http_404',
      revoked: true,
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  createWidgetPushDispatchHandler,
  type WidgetPushClaim,
  type WidgetPushDispatchClient,
} from '../../../../supabase/functions/dispatch-task-widget-updates/handler';

const ownerId = '9d000000-0000-4000-8000-000000000001';
const claimId = '9d000000-0000-4000-8000-000000000002';
const registrationId = '9d000000-0000-4000-8000-000000000003';
const secret = 's'.repeat(32);

function claim(overrides: Partial<WidgetPushClaim> = {}): WidgetPushClaim {
  return {
    ownerId,
    claimId,
    generation: 4,
    targets: [{
      registrationId,
      platform: 'ios',
      environment: 'development',
      topic: 'garden.bath.tasks.push-type.widgets',
      deviceToken: 'a'.repeat(64),
    }],
    ...overrides,
  };
}

function setup(claims: unknown = [claim()]) {
  const client: WidgetPushDispatchClient = {
    claim: vi.fn(async () => ({ data: claims, error: null })),
    finish: vi.fn(async () => ({ error: null })),
    retire: vi.fn(async () => ({ error: null })),
  };
  const send = vi.fn(async (): Promise<{
    accepted: boolean;
    permanent: boolean;
    reason?: string;
  }> => ({ accepted: true, permanent: false }));
  const handler = createWidgetPushDispatchHandler({
    getEnvironment: (name) => ({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      TASKS_WIDGET_PUSH_DISPATCH_SECRET: secret,
      TASKS_WIDGET_APNS_TEAM_ID: 'TEAMID',
      TASKS_WIDGET_APNS_KEY_ID: 'KEYID',
      TASKS_WIDGET_APNS_PRIVATE_KEY: 'private-key',
    }[name] ?? null),
    createClient: () => client,
    send,
    logError: vi.fn(),
  });
  const request = () => new Request('https://example.test', {
    method: 'POST',
    headers: { 'x-tasks-widget-push-secret': secret },
  });
  return { client, handler, request, send };
}

describe('task widget push dispatcher', () => {
  it('rejects an unauthenticated dispatcher before claiming work', async () => {
    const { client, handler } = setup();
    const response = await handler(new Request('https://example.test', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(client.claim).not.toHaveBeenCalled();
  });

  it('acknowledges an owner generation after APNs accepts every target', async () => {
    const { client, handler, request, send } = setup();
    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accepted: 1, retired: 0, retried: 0 });
    expect(send).toHaveBeenCalledOnce();
    expect(client.finish).toHaveBeenCalledWith(claim(), true);
  });

  it('retires a permanently invalid token and acknowledges the generation', async () => {
    const { client, handler, request, send } = setup();
    send.mockResolvedValue({ accepted: false, permanent: true, reason: 'Unregistered' });

    const response = await handler(request());

    expect(await response.json()).toMatchObject({ accepted: 0, retired: 1, retried: 0 });
    expect(client.retire).toHaveBeenCalledWith(registrationId);
    expect(client.finish).toHaveBeenCalledWith(claim(), true);
  });

  it('retries when any active target has a transient failure', async () => {
    const secondRegistrationId = '9d000000-0000-4000-8000-000000000004';
    const mixedClaim = claim({
      targets: [
        claim().targets[0],
        { ...claim().targets[0], registrationId: secondRegistrationId },
      ],
    });
    const { client, handler, request, send } = setup([mixedClaim]);
    send
      .mockResolvedValueOnce({ accepted: true, permanent: false })
      .mockResolvedValueOnce({ accepted: false, permanent: false, reason: 'ServiceUnavailable' });

    const response = await handler(request());

    expect(await response.json()).toMatchObject({ accepted: 1, retired: 0, retried: 1 });
    expect(client.finish).toHaveBeenCalledWith(mixedClaim, false);
  });

  it('rejects malformed claims instead of contacting APNs', async () => {
    const { handler, request, send } = setup([{ ...claim(), generation: 0 }]);
    const response = await handler(request());

    expect(response.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });
});

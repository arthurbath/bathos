import { describe, expect, it, vi } from 'vitest';

import {
  createTasksWidgetActionsHandler,
  type WidgetActionRpcClient,
} from '../../../../supabase/functions/tasks-widget-actions/handler';

const environment: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

function setup(overrides?: {
  ownerId?: string | null;
  issue?: WidgetActionRpcClient['issue'];
  complete?: WidgetActionRpcClient['complete'];
  revoke?: WidgetActionRpcClient['revoke'];
}) {
  const rpc: WidgetActionRpcClient = {
    issue: overrides?.issue ?? vi.fn(async () => ({ data: { outcome: 'issued' }, error: null })),
    complete: overrides?.complete ?? vi.fn(async () => ({
      data: { outcome: 'accepted', revision: 2 },
      error: null,
    })),
    revoke: overrides?.revoke ?? vi.fn(async () => ({ data: { outcome: 'revoked' }, error: null })),
  };
  return {
    rpc,
    handler: createTasksWidgetActionsHandler({
      getEnvironment: (name) => environment[name] ?? null,
      authenticateUser: vi.fn(async () => (
        overrides?.ownerId === undefined
          ? '9b000000-0000-4000-8000-000000000001'
          : overrides.ownerId
      )),
      createRpcClient: () => rpc,
      randomBytes: () => new Uint8Array(32).fill(1),
      now: () => new Date('2026-07-28T20:00:00.000Z'),
      logError: vi.fn(),
    }),
  };
}

describe('tasks widget action handler', () => {
  it('issues an expiring installation-bound credential to an authenticated user', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issue',
        installationId: '9b000000-0000-4000-8000-000000000040',
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      outcome: 'issued',
      ownerId: '9b000000-0000-4000-8000-000000000001',
      installationId: '9b000000-0000-4000-8000-000000000040',
    });
    expect(rpc.issue).toHaveBeenCalledOnce();
  });

  it('refuses credential issue when Supabase user validation fails', async () => {
    const { handler, rpc } = setup({ ownerId: null });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issue',
        installationId: '9b000000-0000-4000-8000-000000000040',
      }),
    }));
    expect(response.status).toBe(401);
    expect(rpc.issue).not.toHaveBeenCalled();
  });

  it('completes a task with only the narrow widget credential', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'complete',
        taskId: '9b000000-0000-4000-8000-000000000010',
        clientMutationId: '9b000000-0000-4000-8000-000000000060',
        operationId: '9b000000-0000-4000-8000-000000000061',
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: 'accepted' });
    expect(rpc.complete).toHaveBeenCalledOnce();
  });

  it('returns content-free rejection for an invalid widget credential', async () => {
    const { handler, rpc } = setup({
      complete: vi.fn(async () => ({
        data: { outcome: 'rejected', code: 'invalid_credential' },
        error: null,
      })),
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'complete',
        taskId: '9b000000-0000-4000-8000-000000000010',
        clientMutationId: '9b000000-0000-4000-8000-000000000060',
        operationId: '9b000000-0000-4000-8000-000000000061',
      }),
    }));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('Owned widget task');
    expect(rpc.complete).toHaveBeenCalledOnce();
  });

  it('revokes the credential through the same narrow authorization scheme', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'revoke' }),
    }));
    expect(response.status).toBe(200);
    expect(rpc.revoke).toHaveBeenCalledWith(`twc_${'A'.repeat(43)}`);
  });
});

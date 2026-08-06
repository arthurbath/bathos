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
  snapshot?: WidgetActionRpcClient['snapshot'];
  createInboxTask?: WidgetActionRpcClient['createInboxTask'];
  todayProgress?: WidgetActionRpcClient['todayProgress'];
  revoke?: WidgetActionRpcClient['revoke'];
  registerPushToken?: WidgetActionRpcClient['registerPushToken'];
  issueQuickEntry?: WidgetActionRpcClient['issueQuickEntry'];
  quickEntryBootstrap?: WidgetActionRpcClient['quickEntryBootstrap'];
  createQuickEntry?: WidgetActionRpcClient['createQuickEntry'];
  revokeQuickEntry?: WidgetActionRpcClient['revokeQuickEntry'];
}) {
  const rpc: WidgetActionRpcClient = {
    issue: overrides?.issue ?? vi.fn(async () => ({ data: { outcome: 'issued' }, error: null })),
    complete: overrides?.complete ?? vi.fn(async () => ({
      data: { outcome: 'accepted', revision: 2 },
      error: null,
    })),
    snapshot: overrides?.snapshot ?? vi.fn(async () => ({
      data: {
        type: 'snapshot',
        schemaVersion: 2,
        ownerId: '9b000000-0000-4000-8000-000000000001',
        generatedAt: '2026-07-28T20:00:00.000Z',
        planningDate: '2026-07-28',
        todayTotalCount: 4,
        lists: [
          { id: 'today', title: 'Today', totalCount: 1, truncated: false, tasks: [] },
          { id: 'upcoming', title: 'Upcoming', totalCount: 0, truncated: false, tasks: [] },
          { id: 'anytime', title: 'Anytime', totalCount: 1, truncated: false, tasks: [] },
          { id: 'someday', title: 'Someday', totalCount: 0, truncated: false, tasks: [] },
          { id: 'done', title: 'Done', totalCount: 0, truncated: false, tasks: [] },
        ],
      },
      error: null,
    })),
    createInboxTask: overrides?.createInboxTask ?? vi.fn(async () => ({
      data: {
        outcome: 'accepted',
        taskId: '9b000000-0000-4000-8000-000000000070',
        planningDate: '2026-08-01',
        revision: 1,
      },
      error: null,
    })),
    todayProgress: overrides?.todayProgress ?? vi.fn(async () => ({
      data: {
        type: 'todayProgress',
        schemaVersion: 1,
        ownerId: '9b000000-0000-4000-8000-000000000001',
        generatedAt: '2026-08-01T20:00:00.000Z',
        planningDate: '2026-08-01',
        completedCount: 3,
        totalCount: 5,
      },
      error: null,
    })),
    revoke: overrides?.revoke ?? vi.fn(async () => ({ data: { outcome: 'revoked' }, error: null })),
    registerPushToken: overrides?.registerPushToken ?? vi.fn(async () => ({
      data: { outcome: 'registered' }, error: null,
    })),
    issueQuickEntry: overrides?.issueQuickEntry ?? vi.fn(async () => ({
      data: { outcome: 'issued' },
      error: null,
    })),
    quickEntryBootstrap: overrides?.quickEntryBootstrap ?? vi.fn(async () => ({
      data: {
        outcome: 'accepted',
        type: 'nativeQuickEntryBootstrap',
        schemaVersion: 1,
        payloadSchemaVersion: 1,
        contractFingerprint: '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
        capability: 'native_quick_entry_v1',
        ownerId: '9b000000-0000-4000-8000-000000000001',
        generatedAt: '2026-07-28T20:00:00.000Z',
        planningDate: '2026-07-28',
        planningTimeZone: 'America/Los_Angeles',
        areas: [{ id: '9b000000-0000-4000-8000-000000000010', name: 'Home' }],
        limits: { maximumChecklistItems: 200, maximumPayloadBytes: 262144 },
      },
      error: null,
    })),
    createQuickEntry: overrides?.createQuickEntry ?? vi.fn(async () => ({
      data: {
        outcome: 'accepted',
        taskId: '9b000000-0000-4000-8000-000000000080',
        revision: 1,
        acceptedAt: '2026-07-28T20:00:00.000Z',
        planningDate: '2026-07-28',
      },
      error: null,
    })),
    revokeQuickEntry: overrides?.revokeQuickEntry ?? vi.fn(async () => ({
      data: { outcome: 'revoked' },
      error: null,
    })),
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
  it('registers an allowlisted WidgetKit push token through widget authority', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'registerPushToken',
        platform: 'ios',
        environment: 'development',
        topic: 'garden.bath.tasks.push-type.widgets',
        deviceToken: 'a'.repeat(64),
        enabled: true,
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'registered' });
    expect(rpc.registerPushToken).toHaveBeenCalledOnce();
  });

  it('rejects a WidgetKit push topic outside the Tasks allowlist', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'registerPushToken',
        platform: 'ios',
        environment: 'development',
        topic: 'garden.bath.other.push-type.widgets',
        deviceToken: 'a'.repeat(64),
        enabled: true,
      }),
    }));
    expect(response.status).toBe(400);
    expect(rpc.registerPushToken).not.toHaveBeenCalled();
  });
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

  it('reads only the bounded snapshot with the widget credential', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'snapshot' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      type: 'snapshot',
      schemaVersion: 2,
      ownerId: '9b000000-0000-4000-8000-000000000001',
      todayTotalCount: 4,
    });
    expect(rpc.snapshot).toHaveBeenCalledWith(`twc_${'A'.repeat(43)}`);
    expect(rpc.complete).not.toHaveBeenCalled();
  });

  it('creates one Inbox task through the narrow watch action', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createInboxTask',
        summary: 'Capture from Apple Watch',
        clientMutationId: '9b000000-0000-4000-8000-000000000060',
        operationId: '9b000000-0000-4000-8000-000000000061',
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: 'accepted' });
    expect(rpc.createInboxTask).toHaveBeenCalledWith(expect.objectContaining({
      summary: 'Capture from Apple Watch',
    }));
  });

  it('reads aggregate Today progress without task content', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'todayProgress' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      type: 'todayProgress',
      completedCount: 3,
      totalCount: 5,
    });
    expect(rpc.todayProgress).toHaveBeenCalledOnce();
  });

  it('does not return content when a snapshot credential is rejected', async () => {
    const { handler } = setup({
      snapshot: vi.fn(async () => ({
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
      body: JSON.stringify({ action: 'snapshot' }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Widget could not be refreshed',
      code: 'invalid_credential',
    });
  });

  it('rejects an unbounded or malformed snapshot response', async () => {
    const { handler } = setup({
      snapshot: vi.fn(async () => ({
        data: {
          type: 'snapshot',
          schemaVersion: 2,
          ownerId: '9b000000-0000-4000-8000-000000000001',
          lists: [{ id: 'today', tasks: [] }],
        },
        error: null,
      })),
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'snapshot' }),
    }));
    expect(response.status).toBe(500);
  });

  it('returns a content-free failure when the snapshot RPC fails', async () => {
    const { handler } = setup({
      snapshot: vi.fn(async () => ({
        data: null,
        error: { message: 'private database detail' },
      })),
    });
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `Widget twc_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'snapshot' }),
    }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database detail');
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

  it('issues a distinct expiring native Quick Entry credential', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: { Authorization: 'Bearer access-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issueQuickEntry',
        installationId: '9b000000-0000-4000-8000-000000000040',
      }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      outcome: 'issued',
      type: 'nativeQuickEntryCredential',
      capability: 'native_quick_entry_v1',
      payloadSchemaVersion: 1,
      ownerId: '9b000000-0000-4000-8000-000000000001',
      installationId: '9b000000-0000-4000-8000-000000000040',
    });
    expect(rpc.issueQuickEntry).toHaveBeenCalledWith(expect.objectContaining({
      rawToken: expect.stringMatching(/^tqe_[A-Za-z0-9_-]{43}$/),
    }));
  });

  it('reads a bounded contract-compatible native Quick Entry bootstrap', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `QuickEntry tqe_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'quickEntryBootstrap' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      type: 'nativeQuickEntryBootstrap',
      planningDate: '2026-07-28',
      areas: [{ name: 'Home' }],
    });
    expect(rpc.quickEntryBootstrap).toHaveBeenCalledWith(`tqe_${'A'.repeat(43)}`);
  });

  it('forwards a bounded native draft to the atomic creation RPC', async () => {
    const { handler, rpc } = setup();
    const payload = {
      payloadSchemaVersion: 1,
      contractFingerprint: '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
      clientMutationID: '9b000000-0000-4000-8000-000000000080',
      operationID: '9b000000-0000-4000-8000-000000000081',
      summary: 'Native task',
      destination: 'anytime',
      todaySection: 'inbox',
      actionability: 'actionable',
      checklist: [],
    };
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: `QuickEntry tqe_${'A'.repeat(43)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'createQuickEntry', payload }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      outcome: 'accepted',
      taskId: '9b000000-0000-4000-8000-000000000080',
    });
    expect(rpc.createQuickEntry).toHaveBeenCalledWith({
      rawToken: `tqe_${'A'.repeat(43)}`,
      payload,
    });
  });

  it('rejects malformed native credentials before calling native RPCs', async () => {
    const { handler, rpc } = setup();
    const response = await handler(new Request('https://example.test', {
      method: 'POST',
      headers: {
        Authorization: 'Widget twc_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'quickEntryBootstrap' }),
    }));
    expect(response.status).toBe(401);
    expect(rpc.quickEntryBootstrap).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';

import type { Json } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import { createTask, createTaskData, type CreateTaskRequest } from './tasks-create';

type RpcError = { message: string } | null;

const ownerId = '10000000-0000-4000-8000-000000000001';
const mutationId = '20000000-0000-4000-8000-000000000001';
const areaId = '30000000-0000-4000-8000-000000000001';

function creationResult(overrides: Record<string, Json> = {}): Json {
  return {
    idempotency_outcome: 'created',
    receipt: {
      client_mutation_id: mutationId,
      actor_type: 'automation',
      mutation_channel: 'mcp',
      affected_ids: ['40000000-0000-4000-8000-000000000001'],
      base_revision: 0,
      result_revision: 1,
      transition: 'create',
      occurred_at: '2026-08-04T12:00:00.000Z',
      outcome: 'accepted',
      code: null,
    },
    task: {
      id: '40000000-0000-4000-8000-000000000001',
      title: 'Read the source',
      notes: '',
      destination: 'anytime',
      today_section: 'later',
      actionability: 'actionable',
      order_key: 'a0',
      hierarchy_order_key: null,
      start_date: null,
      deadline: null,
      area_id: null,
      source_kind: null,
      source_url: null,
      source_title: null,
      source_external_id: null,
      primary_link: null,
      entry_channel: 'mcp',
      last_mutation_channel: 'mcp',
      last_actor_type: 'automation',
      lifecycle: 'open',
      disposition: 'present',
      revision: 1,
    },
    ...overrides,
  };
}

class FakeTasksClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  constructor(
    private readonly data: Json = creationResult(),
    private readonly error: RpcError = null,
  ) {}

  async rpc(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    return { data: this.data, error: this.error };
  }
}

function authFor(client: FakeTasksClient): AuthenticatedMcpContext {
  return {
    userId: ownerId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

function request(overrides: Partial<CreateTaskRequest> = {}): CreateTaskRequest {
  return {
    idempotency_key: mutationId,
    title: 'Read the source',
    notes: '',
    destination: 'anytime',
    today_section: 'later',
    start_date: null,
    ...overrides,
  };
}

describe('Tasks MCP creation tool', () => {
  it('advertises an idempotent closed-world mutation', () => {
    expect(createTask.name).toBe('create_task');
    expect(createTask.annotations).toEqual({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(createTask.inputSchema.source.safeParse({ kind: 'selected_text' }).success)
      .toBe(false);
    expect(createTask.inputSchema.today_section.parse(undefined)).toBeUndefined();
  });

  it('normalizes one owner-scoped request into one transactional RPC', async () => {
    const client = new FakeTasksClient(creationResult({
      task: {
        id: '40000000-0000-4000-8000-000000000001',
        title: 'Read the source',
        source_kind: 'webpage',
        source_url: 'https://example.test/article',
        primary_link: 'https://example.test/read',
      },
    }));

    const result = await createTaskData(request({
      title: '  Read the source  ',
      actionability: 'waiting',
      entry_channel: 'browser_capture',
      area_id: areaId,
      source: {
        kind: 'webpage',
        url: ' https://example.test/article ',
        title: ' Example article ',
        external_id: ' article-1 ',
      },
      primary_link: ' https://example.test/read ',
    }), authFor(client));

    expect(client.calls).toEqual([{
      name: 'tasks_create_mcp_task',
      args: {
        _idempotency_key: mutationId,
        _title: 'Read the source',
        _notes: '',
        _destination: 'anytime',
        _requested_today_section: 'later',
        _actionability: 'waiting',
        _entry_channel: 'browser_capture',
        _requested_start_date: null,
        _placement_was_implicit: false,
        _deadline: null,
        _area_id: areaId,
        _source_kind: 'webpage',
        _source_url: 'https://example.test/article',
        _source_title: 'Example article',
        _source_external_id: 'article-1',
        _primary_link: 'https://example.test/read',
      },
    }]);
    expect(result.idempotency_outcome).toBe('created');
    expect(result.task).not.toHaveProperty('owner_id');
  });

  it('preserves implicit Today Next placement identity for the database', async () => {
    const client = new FakeTasksClient();

    await createTaskData({
      idempotency_key: mutationId,
      title: 'Capture this',
      notes: '',
    }, authFor(client));

    expect(client.calls[0]).toMatchObject({
      name: 'tasks_create_mcp_task',
      args: {
        _destination: 'anytime',
        _requested_today_section: null,
        _requested_start_date: null,
        _placement_was_implicit: true,
        _actionability: 'actionable',
        _entry_channel: 'mcp',
      },
    });
  });

  it('returns an exact-retry result supplied by the transactional authority', async () => {
    const client = new FakeTasksClient(creationResult({
      idempotency_outcome: 'already_applied',
    }));

    const result = await createTaskData(request(), authFor(client));

    expect(result.idempotency_outcome).toBe('already_applied');
    expect(client.calls).toHaveLength(1);
  });

  it('rejects invalid source and placement input before calling Supabase', async () => {
    const sourceClient = new FakeTasksClient();
    await expect(createTaskData(request({
      source: { kind: 'webpage' },
    }), authFor(sourceClient))).rejects.toThrow('sources require a URL');
    expect(sourceClient.calls).toHaveLength(0);

    const somedayClient = new FakeTasksClient();
    await expect(createTaskData(request({
      destination: 'someday',
      today_section: 'later',
    }), authFor(somedayClient))).rejects.toThrow('Someday work cannot retain');
    expect(somedayClient.calls).toHaveLength(0);
  });

  it('propagates an RPC rejection without issuing a fallback query', async () => {
    const client = new FakeTasksClient(
      null,
      { message: 'The idempotency key was already used for a different task creation request' },
    );

    await expect(createTaskData(request(), authFor(client)))
      .rejects.toThrow('idempotency key was already used');
    expect(client.calls).toHaveLength(1);
  });

  it('rejects a malformed transactional response', async () => {
    const client = new FakeTasksClient({
      idempotency_outcome: 'created',
      receipt: { transition: 'update' },
      task: { owner_id: ownerId },
    });

    await expect(createTaskData(request(), authFor(client)))
      .rejects.toThrow('transactional task creation response is invalid');
    expect(client.calls).toHaveLength(1);
  });
});

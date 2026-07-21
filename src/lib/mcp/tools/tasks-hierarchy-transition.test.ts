import { describe, expect, it } from 'vitest';

import type { Database, Json } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  transitionTaskHierarchy,
  transitionTaskHierarchyData,
} from './tasks-hierarchy-transition';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type RpcArgs = Database['public']['Functions']['tasks_request_mcp_hierarchy_operation']['Args'];

class FakeHierarchyTransitionClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  readonly rpcCalls: RpcArgs[] = [];
  onRpc: ((args: RpcArgs, client: FakeHierarchyTransitionClient) => Json) | null = null;

  constructor(tables: Partial<Record<TableName, StoredRow[]>> = {}) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, [...(rows ?? [])]]),
    ) as Partial<Record<TableName, StoredRow[]>>;
  }

  from(table: TableName) {
    return new FakeQuery(this, table);
  }

  rows(table: TableName): StoredRow[] {
    return this.tables[table] ??= [];
  }

  async rpc(name: string, args: RpcArgs) {
    if (name !== 'tasks_request_mcp_hierarchy_operation' || this.onRpc === null) {
      return { data: null, error: { message: 'Unexpected RPC call' } };
    }
    this.rpcCalls.push(args);
    return { data: this.onRpc(args, this), error: null };
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private single = false;

  constructor(
    private readonly client: FakeHierarchyTransitionClient,
    private readonly table: TableName,
  ) {}

  select() { return this; }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const rows = this.client.rows(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));
    return Promise.resolve({ data: this.single ? rows[0] ?? null : rows, error: null })
      .then(onfulfilled, onrejected);
  }
}

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const projectId = '20000000-0000-4000-8000-000000000001';
const taskId = '30000000-0000-4000-8000-000000000001';
const mutationId = '40000000-0000-4000-8000-000000000001';

function authFor(
  userId: string,
  client: FakeHierarchyTransitionClient,
): AuthenticatedMcpContext {
  return {
    userId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

function project(overrides: StoredRow = {}): StoredRow {
  return {
    id: projectId,
    owner_id: ownerA,
    title: 'Launch',
    lifecycle: 'open',
    disposition: 'present',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    last_actor_type: 'user',
    last_mutation_channel: 'web',
    ...overrides,
  };
}

function task(overrides: StoredRow = {}): StoredRow {
  return {
    id: taskId,
    owner_id: ownerA,
    project_id: projectId,
    lifecycle: 'open',
    disposition: 'present',
    revision: 1,
    ...overrides,
  };
}

function operation(overrides: StoredRow = {}): Json {
  return {
    id: mutationId,
    root_type: 'project',
    root_id: projectId,
    operation: 'complete_project',
    descendant_policy: 'reject',
    expected_revisions: { [projectId]: 1 },
    actor_type: 'automation',
    mutation_channel: 'mcp',
    requested_at: '2026-07-21T00:00:00.000Z',
    outcome: 'accepted',
    code: null,
    affected_ids: [projectId],
    result_revisions: { [projectId]: 2 },
    completed_at: '2026-07-21T00:00:00.010Z',
    ...overrides,
  } as Json;
}

describe('Tasks MCP hierarchy transition tool', () => {
  it('advertises one idempotent domain operation without permanent deletion or to-do roots', () => {
    expect(transitionTaskHierarchy.name).toBe('transition_task_hierarchy');
    expect(transitionTaskHierarchy.annotations).toEqual({
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
    expect(transitionTaskHierarchy.inputSchema.root_type.safeParse('todo').success).toBe(false);
    expect(transitionTaskHierarchy.inputSchema.transition.safeParse('permanent_delete').success)
      .toBe(false);
  });

  it('submits one server-derived project operation and returns its owner-safe receipt', async () => {
    const client = new FakeHierarchyTransitionClient({ tasks_projects: [project()] });
    client.onRpc = (args, fake) => {
      Object.assign(fake.rows('tasks_projects')[0], { lifecycle: 'completed', revision: 2 });
      return operation({ id: args._request_id });
    };

    const result = await transitionTaskHierarchyData({
      root_type: 'project',
      root_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      transition: 'complete',
    }, authFor(ownerA, client));

    expect(client.rpcCalls).toEqual([{
      _request_id: mutationId,
      _root_type: 'project',
      _root_id: projectId,
      _expected_revision: 1,
      _operation: 'complete_project',
      _descendant_policy: 'reject',
    }]);
    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: {
        actor_type: 'automation',
        mutation_channel: 'mcp',
        base_revision: 1,
        result_revision: 2,
        transition: 'complete',
        outcome: 'accepted',
      },
      record_type: 'project',
      record: { id: projectId, lifecycle: 'completed', revision: 2 },
    });
    expect(result.record).not.toHaveProperty('owner_id');
  });

  it('forwards an explicit cascade and reports every server-derived revision', async () => {
    const client = new FakeHierarchyTransitionClient({
      tasks_projects: [project()],
      tasks_todos: [task()],
    });
    client.onRpc = (_args, fake) => {
      Object.assign(fake.rows('tasks_projects')[0], { lifecycle: 'canceled', revision: 2 });
      Object.assign(fake.rows('tasks_todos')[0], { lifecycle: 'canceled', revision: 2 });
      return operation({
        operation: 'cancel_project',
        descendant_policy: 'cascade',
        expected_revisions: { [projectId]: 1, [taskId]: 1 },
        result_revisions: { [projectId]: 2, [taskId]: 2 },
        affected_ids: [projectId, taskId],
      });
    };

    const result = await transitionTaskHierarchyData({
      root_type: 'project', root_id: projectId, expected_revision: 1,
      client_mutation_id: mutationId, transition: 'cancel', descendant_policy: 'cascade',
    }, authFor(ownerA, client));

    expect(client.rpcCalls[0]._descendant_policy).toBe('cascade');
    expect(result.receipt.affected_revisions).toEqual({
      [projectId]: { base_revision: 1, result_revision: 2 },
      [taskId]: { base_revision: 1, result_revision: 2 },
    });
  });

  it('returns local conflict and no-op receipts without calling the operation service', async () => {
    const staleClient = new FakeHierarchyTransitionClient({
      tasks_projects: [project({ revision: 2 })],
    });
    const conflict = await transitionTaskHierarchyData({
      root_type: 'project', root_id: projectId, expected_revision: 1,
      client_mutation_id: mutationId, transition: 'complete',
    }, authFor(ownerA, staleClient));
    expect(conflict).toMatchObject({
      mutation_outcome: 'conflict',
      receipt: { outcome: 'conflict', code: 'revision_conflict', result_revision: 2 },
    });
    expect(staleClient.rpcCalls).toHaveLength(0);

    const currentClient = new FakeHierarchyTransitionClient({
      tasks_projects: [project({ lifecycle: 'completed' })],
    });
    const noop = await transitionTaskHierarchyData({
      root_type: 'project', root_id: projectId, expected_revision: 1,
      client_mutation_id: mutationId, transition: 'complete',
    }, authFor(ownerA, currentClient));
    expect(noop).toMatchObject({
      mutation_outcome: 'noop', receipt: { outcome: 'noop', code: 'already_current' },
    });
    expect(currentClient.rpcCalls).toHaveLength(0);
  });

  it('replays the immutable operation and rejects changed reuse', async () => {
    const stored = operation({ owner_id: ownerA });
    const client = new FakeHierarchyTransitionClient({
      tasks_projects: [project({ lifecycle: 'completed', revision: 2 })],
      tasks_hierarchy_operations: [stored as StoredRow],
    });
    const request = {
      root_type: 'project' as const,
      root_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      transition: 'complete' as const,
    };

    const replay = await transitionTaskHierarchyData(request, authFor(ownerA, client));
    expect(replay.mutation_outcome).toBe('already_applied');
    expect(client.rpcCalls).toHaveLength(0);
    await expect(transitionTaskHierarchyData(
      { ...request, transition: 'cancel' },
      authFor(ownerA, client),
    )).rejects.toThrow('different hierarchy operation');
  });

  it('preserves rejected server outcomes and the unchanged current root', async () => {
    const client = new FakeHierarchyTransitionClient({ tasks_projects: [project()] });
    client.onRpc = () => operation({
      outcome: 'rejected',
      code: 'open_descendants',
      affected_ids: [],
      result_revisions: {},
    });
    const result = await transitionTaskHierarchyData({
      root_type: 'project', root_id: projectId, expected_revision: 1,
      client_mutation_id: mutationId, transition: 'complete',
    }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'rejected',
      receipt: { outcome: 'rejected', code: 'open_descendants' },
      record: { lifecycle: 'open', revision: 1 },
    });
  });

  it('rejects a mutation UUID already used by another task operation before a no-op', async () => {
    const client = new FakeHierarchyTransitionClient({
      tasks_projects: [project({ lifecycle: 'completed' })],
      tasks_history_events: [{
        id: crypto.randomUUID(),
        owner_id: ownerA,
        client_mutation_id: mutationId,
      }],
    });
    await expect(transitionTaskHierarchyData({
      root_type: 'project', root_id: projectId, expected_revision: 1,
      client_mutation_id: mutationId, transition: 'complete',
    }, authFor(ownerA, client))).rejects.toThrow('mutation identifier is unavailable');
    expect(client.rpcCalls).toHaveLength(0);
  });

  it('rejects invalid lifecycle, policy, and ownership combinations before mutation', async () => {
    const client = new FakeHierarchyTransitionClient({
      tasks_projects: [project({ lifecycle: 'canceled' })],
    });
    const base = {
      root_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
    };
    await expect(transitionTaskHierarchyData({
      ...base, root_type: 'area', transition: 'complete',
    }, authFor(ownerA, client))).rejects.toThrow('Only projects');
    await expect(transitionTaskHierarchyData({
      ...base, root_type: 'project', transition: 'reopen', descendant_policy: 'cascade',
    }, authFor(ownerA, client))).rejects.toThrow('does not cascade');
    await expect(transitionTaskHierarchyData({
      ...base, root_type: 'project', transition: 'delete', descendant_policy: 'reject',
    }, authFor(ownerA, client))).rejects.toThrow('required atomic cascade');
    await expect(transitionTaskHierarchyData({
      ...base, root_type: 'project', transition: 'complete',
    }, authFor(ownerA, client))).rejects.toThrow('Reopen the project');
    Object.assign(client.rows('tasks_projects')[0], {
      disposition: 'deleted', lifecycle: 'open',
    });
    await expect(transitionTaskHierarchyData({
      ...base, root_type: 'project', transition: 'reopen',
    }, authFor(ownerA, client))).rejects.toThrow('Restore the project');
    await expect(transitionTaskHierarchyData({
      ...base, root_type: 'project', transition: 'delete',
    }, authFor(ownerB, client))).rejects.toThrow('root is unavailable');
    expect(client.rpcCalls).toHaveLength(0);
  });
});

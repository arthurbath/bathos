import { describe, expect, it } from 'vitest';

import type { Database, Json } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  moveTask,
  moveTaskData,
  scheduleTask,
  scheduleTaskData,
  transitionTask,
  transitionTaskData,
  updateTask,
  updateTaskData,
} from './tasks-mutate';
import { planningDateInTimeZone } from './tasks-read';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type QueryError = { code: string; message: string };

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const taskId = '20000000-0000-4000-8000-000000000001';
const checklistId = '30000000-0000-4000-8000-000000000001';
const areaId = '40000000-0000-4000-8000-000000000001';
const mutationId = '50000000-0000-4000-8000-000000000001';

const snapshotKeys = [
  'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at', 'disposition',
  'deleted_at', 'destination', 'today_section', 'order_key', 'start_date', 'deadline',
  'actionability',
  'source_kind', 'source_url', 'source_title', 'source_external_id', 'area_id',
  'project_id', 'heading_id', 'hierarchy_order_key', 'deletion_root_id',
] as const;

function snapshot(row: StoredRow): Json {
  return Object.fromEntries(snapshotKeys.map((key) => [key, row[key] as Json]));
}

function task(overrides: Partial<Tables['tasks_todos']['Row']> = {}): Tables['tasks_todos']['Row'] {
  return {
    id: taskId,
    owner_id: ownerA,
    area_id: null,
    project_id: null,
    heading_id: null,
    title: 'Synthetic task',
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: 'daytime',
    actionability: 'actionable',
    order_key: 'a0',
    hierarchy_order_key: null,
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    undo_source_event_id: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    revision: 1,
    client_mutation_id: '60000000-0000-4000-8000-000000000001',
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
    ...overrides,
  };
}

function checklist(): Tables['tasks_checklist_items']['Row'] {
  return {
    id: checklistId,
    owner_id: ownerA,
    task_id: taskId,
    title: 'Synthetic checklist item',
    completed: false,
    completed_at: null,
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: '70000000-0000-4000-8000-000000000001',
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
  };
}

function settings(): Tables['tasks_user_settings']['Row'] {
  return {
    id: ownerA,
    owner_id: ownerA,
    planning_timezone: 'America/Los_Angeles',
    revision: 1,
    client_mutation_id: '80000000-0000-4000-8000-000000000001',
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
  };
}

class FakeTasksClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  taskUpdateCount = 0;
  hierarchyInsertCount = 0;

  constructor(tables: Partial<Record<TableName, StoredRow[]>> = {}) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, [...(rows ?? [])]]),
    ) as Partial<Record<TableName, StoredRow[]>>;
  }

  from(table: TableName) { return new FakeQuery(this, table); }
  rows(table: TableName): StoredRow[] { return this.tables[table] ??= []; }

  updateTask(row: StoredRow, patch: StoredRow): { data: StoredRow | null; error: QueryError | null } {
    if (this.rows('tasks_history_events').some((event) => (
      event.owner_id === row.owner_id && event.client_mutation_id === patch.client_mutation_id
    ))) {
      return { data: null, error: { code: '23505', message: 'duplicate mutation' } };
    }
    this.taskUpdateCount += 1;
    const before = { ...row };
    Object.assign(row, patch, { updated_at: new Date().toISOString() });
    const transition = before.lifecycle !== row.lifecycle
      ? row.lifecycle === 'completed' ? 'complete' : row.lifecycle === 'canceled' ? 'cancel' : 'reopen'
      : before.actionability !== row.actionability ? 'set_actionability'
      : before.destination !== row.destination || before.today_section !== row.today_section
        || before.area_id !== row.area_id || before.project_id !== row.project_id
        || before.heading_id !== row.heading_id
        ? 'move' : before.order_key !== row.order_key ? 'reorder' : 'update';
    this.rows('tasks_history_events').push({
      id: crypto.randomUUID(),
      owner_id: row.owner_id,
      task_id: row.id,
      client_mutation_id: patch.client_mutation_id,
      actor_type: patch.last_actor_type,
      mutation_channel: patch.last_mutation_channel,
      affected_ids: [row.id],
      base_revision: before.revision,
      result_revision: row.revision,
      transition,
      occurred_at: row.updated_at,
      outcome: 'accepted',
      code: null,
      before_state: snapshot(before),
      after_state: snapshot(row),
    });
    return { data: { ...row }, error: null };
  }

  insertHierarchyOperation(value: StoredRow): { data: null; error: QueryError | null } {
    this.hierarchyInsertCount += 1;
    const operations = this.rows('tasks_hierarchy_operations');
    if (operations.some((row) => row.id === value.id)) {
      return { data: null, error: { code: '23505', message: 'duplicate operation' } };
    }
    const stored = { ...value };
    operations.push(stored);
    const root = this.rows('tasks_todos').find((row) => (
      row.owner_id === value.owner_id && row.id === value.root_id
    ));
    if (!root) {
      Object.assign(stored, { outcome: 'rejected', code: 'root_not_found', completed_at: new Date().toISOString() });
      return { data: null, error: null };
    }
    const descendants = this.rows('tasks_checklist_items').filter((row) => (
      row.owner_id === value.owner_id
      && (value.operation === 'delete'
        ? row.task_id === value.root_id && row.disposition === 'present'
        : row.deletion_root_id === value.root_id)
    ));
    const candidates = [root, ...descendants];
    const currentRevisions = Object.fromEntries(candidates.map((row) => [row.id, row.revision]));
    if (JSON.stringify(currentRevisions) !== JSON.stringify(value.expected_revisions)) {
      Object.assign(stored, { outcome: 'conflict', code: 'revision_set_changed', completed_at: new Date().toISOString() });
      return { data: null, error: null };
    }
    for (const row of candidates) {
      Object.assign(row, value.operation === 'delete' ? {
        disposition: 'deleted',
        deleted_at: value.requested_at,
        deletion_root_id: value.root_id,
        revision: Number(row.revision) + 1,
      } : {
        disposition: 'present',
        deleted_at: null,
        deletion_root_id: null,
        revision: Number(row.revision) + 1,
      });
    }
    Object.assign(stored, {
      outcome: 'accepted',
      code: null,
      affected_ids: candidates.map((row) => row.id),
      result_revisions: Object.fromEntries(candidates.map((row) => [row.id, row.revision])),
      completed_at: new Date().toISOString(),
    });
    return { data: null, error: null };
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | undefined;
  private single = false;
  private updatePatch: StoredRow | null = null;
  private insertValue: StoredRow | null = null;

  constructor(private readonly client: FakeTasksClient, private readonly table: TableName) {}

  select() { return this; }
  update(value: StoredRow) { this.updatePatch = value; return this; }
  insert(value: StoredRow) { this.insertValue = value; return this; }
  eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
  neq(column: string, value: unknown) { this.filters.push((row) => row[column] !== value); return this; }
  is(column: string, value: null) { this.filters.push((row) => row[column] === value); return this; }
  not(column: string, operator: string, value: null) {
    if (operator !== 'is' || value !== null) throw new Error('Unsupported fake NOT query');
    this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(value: number) { this.rowLimit = value; return this; }
  maybeSingle() { this.single = true; return this; }

  then<TResult1 = { data: unknown; error: QueryError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: QueryError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: QueryError | null } {
    if (this.insertValue !== null) {
      if (this.table !== 'tasks_hierarchy_operations') throw new Error('Unsupported fake insert');
      return this.client.insertHierarchyOperation(this.insertValue);
    }
    const rows = this.client.rows(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));
    if (this.updatePatch !== null) {
      if (this.table !== 'tasks_todos') throw new Error('Unsupported fake update');
      if (rows.length === 0) return { data: null, error: null };
      return this.client.updateTask(rows[0], this.updatePatch);
    }
    rows.sort((left, right) => {
      for (const { column, ascending } of this.orders) {
        const compared = String(left[column] ?? '').localeCompare(String(right[column] ?? ''));
        if (compared !== 0) return ascending ? compared : -compared;
      }
      return 0;
    });
    const bounded = this.rowLimit === undefined ? rows : rows.slice(0, this.rowLimit);
    return { data: this.single ? bounded[0] ?? null : bounded, error: null };
  }
}

function authFor(userId: string, client: FakeTasksClient): AuthenticatedMcpContext {
  return { userId, email: null, supabase: client as unknown as AuthenticatedMcpContext['supabase'] };
}

function base(overrides: Partial<{ task_id: string; expected_revision: number; client_mutation_id: string }> = {}) {
  return { task_id: taskId, expected_revision: 1, client_mutation_id: mutationId, ...overrides };
}

describe('Tasks MCP mutation tools', () => {
  it('advertises four explicit idempotent closed-world mutation tools', () => {
    for (const tool of [updateTask, moveTask, scheduleTask]) {
      expect(tool.annotations).toEqual({ readOnlyHint: false, idempotentHint: true, openWorldHint: false });
    }
    expect(transitionTask.annotations).toEqual({
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
  });

  it('requires an authenticated MCP context before mutation work begins', () => {
    expect(() => updateTask.handler(
      { ...base(), title: 'Unauthenticated edit' },
      { isAuthenticated: () => false } as never,
    )).toThrow('Not authenticated');
  });

  it('does not include permanent deletion in the transition schema', () => {
    expect(transitionTask.inputSchema.transition.safeParse('permanent_delete').success).toBe(false);
  });

  it('applies an owner-scoped edit and returns the authoritative history receipt', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task()] });
    const result = await updateTaskData({ ...base(), title: '  Revised task  ' }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: {
        client_mutation_id: mutationId,
        actor_type: 'automation',
        mutation_channel: 'mcp',
        base_revision: 1,
        result_revision: 2,
        transition: 'update',
        outcome: 'accepted',
      },
      task: { title: 'Revised task', revision: 2, last_mutation_channel: 'mcp' },
    });
    expect(result.task).not.toHaveProperty('owner_id');
    expect(client.rows('tasks_history_events')).toHaveLength(1);
  });

  it('resolves an exact edit retry through immutable history after a later change', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task()] });
    const input = { ...base(), title: 'Revised task' };
    await updateTaskData(input, authFor(ownerA, client));
    Object.assign(client.rows('tasks_todos')[0], {
      title: 'Later title', revision: 3, client_mutation_id: crypto.randomUUID(),
    });

    const replay = await updateTaskData(input, authFor(ownerA, client));
    expect(replay).toMatchObject({
      mutation_outcome: 'already_applied',
      receipt: { result_revision: 2 },
      task: { title: 'Later title', revision: 3 },
    });
    expect(client.taskUpdateCount).toBe(1);
  });

  it('sets structured actionability with a dedicated idempotent transition', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task()] });
    const input = { ...base(), actionability: 'waiting' as const };

    const first = await updateTaskData(input, authFor(ownerA, client));
    const replay = await updateTaskData(input, authFor(ownerA, client));

    expect(first).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'set_actionability', base_revision: 1, result_revision: 2 },
      task: { actionability: 'waiting', revision: 2 },
    });
    expect(replay.mutation_outcome).toBe('already_applied');
    expect(client.taskUpdateCount).toBe(1);
  });

  it('rejects actionability changes on terminal or deleted tasks', async () => {
    for (const current of [
      task({ lifecycle: 'completed', completed_at: '2026-07-20T09:00:00.000Z' }),
      task({ disposition: 'deleted', deleted_at: '2026-07-20T09:00:00.000Z' }),
    ]) {
      const client = new FakeTasksClient({ tasks_todos: [current] });
      await expect(updateTaskData(
        { ...base(), actionability: 'waiting' },
        authFor(ownerA, client),
      )).rejects.toThrow(/Reopen|Restore/);
      expect(client.taskUpdateCount).toBe(0);
    }
  });

  it('rejects mutation-key reuse with a different payload', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task()] });
    await updateTaskData({ ...base(), title: 'First title' }, authFor(ownerA, client));
    await expect(updateTaskData({ ...base(), title: 'Second title' }, authFor(ownerA, client)))
      .rejects.toThrow('mutation identifier was already used for a different task request');
    expect(client.taskUpdateCount).toBe(1);
  });

  it('returns a conflict receipt instead of overwriting a stale revision', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task({ revision: 2 })] });
    const result = await updateTaskData({ ...base(), title: 'Stale edit' }, authFor(ownerA, client));
    expect(result).toMatchObject({
      mutation_outcome: 'conflict',
      receipt: { outcome: 'conflict', code: 'revision_conflict', result_revision: 2 },
      task: { title: 'Synthetic task', revision: 2 },
    });
    expect(client.taskUpdateCount).toBe(0);
  });

  it('moves planning and complete container placement without accepting raw order keys', async () => {
    const client = new FakeTasksClient({
      tasks_todos: [task()],
      tasks_areas: [{ id: areaId, owner_id: ownerA, disposition: 'present' }],
      tasks_user_settings: [settings()],
    });
    const result = await moveTaskData({
      ...base(),
      destination: 'today',
      today_section: 'daytime',
      area_id: areaId,
      project_id: null,
      heading_id: null,
    }, authFor(ownerA, client));
    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'move' },
      task: { destination: 'today', area_id: areaId, revision: 2 },
    });
    expect(result.task.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.task.order_key).toMatch(/^a/);
  });

  it('activates Someday work when scheduling a start date', async () => {
    const client = new FakeTasksClient({
      tasks_todos: [task({ destination: 'someday' })],
      tasks_user_settings: [settings()],
    });
    const result = await scheduleTaskData({
      ...base(), start_date: '2026-07-25', deadline: '2026-07-31',
    }, authFor(ownerA, client));
    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'move' },
      task: { destination: 'anytime', start_date: '2026-07-25', deadline: '2026-07-31' },
    });
  });

  it('moves This Evening work to daytime when scheduling a different date', async () => {
    const client = new FakeTasksClient({
      tasks_todos: [task({
        destination: 'today',
        today_section: 'evening',
        start_date: planningDateInTimeZone('America/Los_Angeles'),
      })],
      tasks_user_settings: [settings()],
    });
    const result = await scheduleTaskData({
      ...base(), start_date: '2099-07-25',
    }, authFor(ownerA, client));
    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'move' },
      task: { destination: 'today', today_section: 'daytime', start_date: '2099-07-25' },
    });
  });

  it('returns a lifecycle no-op without creating history', async () => {
    const client = new FakeTasksClient({
      tasks_todos: [task({
        lifecycle: 'completed',
        completed_at: '2026-07-20T09:00:00.000Z',
      })],
    });
    const result = await transitionTaskData({ ...base(), transition: 'complete' }, authFor(ownerA, client));
    expect(result).toMatchObject({
      mutation_outcome: 'noop',
      receipt: { outcome: 'noop', code: 'already_current', base_revision: 1, result_revision: 1 },
    });
    expect(client.rows('tasks_history_events')).toHaveLength(0);
  });

  it('rejects an invalid lifecycle transition without a partial update', async () => {
    const client = new FakeTasksClient({
      tasks_todos: [task({
        lifecycle: 'completed',
        completed_at: '2026-07-20T09:00:00.000Z',
      })],
    });
    await expect(transitionTaskData(
      { ...base(), transition: 'cancel' },
      authFor(ownerA, client),
    )).rejects.toThrow('Completed tasks must be reopened before cancellation');
    expect(client.taskUpdateCount).toBe(0);
    expect(client.rows('tasks_history_events')).toHaveLength(0);
  });

  it('applies completion once and resolves the exact lifecycle retry', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task()] });
    const input = { ...base(), transition: 'complete' as const };
    const first = await transitionTaskData(input, authFor(ownerA, client));
    const replay = await transitionTaskData(input, authFor(ownerA, client));
    expect(first).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'complete', base_revision: 1, result_revision: 2 },
      task: { lifecycle: 'completed', revision: 2 },
    });
    expect(replay.mutation_outcome).toBe('already_applied');
    expect(client.taskUpdateCount).toBe(1);
    expect(client.rows('tasks_history_events')).toHaveLength(1);
  });

  it('recoverably deletes a to-do and checklist atomically and resolves a retry', async () => {
    const client = new FakeTasksClient({
      tasks_todos: [task()],
      tasks_checklist_items: [checklist()],
    });
    const input = { ...base(), transition: 'delete' as const };
    const first = await transitionTaskData(input, authFor(ownerA, client));
    expect(first).toMatchObject({
      mutation_outcome: 'applied',
      receipt: {
        outcome: 'accepted',
        transition: 'delete',
        affected_ids: expect.arrayContaining([taskId, checklistId]),
        base_revision: 1,
        result_revision: 2,
      },
      task: { disposition: 'deleted', deletion_root_id: taskId, revision: 2 },
    });
    expect(client.rows('tasks_checklist_items')[0]).toMatchObject({
      disposition: 'deleted', deletion_root_id: taskId, revision: 2,
    });

    const replay = await transitionTaskData(input, authFor(ownerA, client));
    expect(replay.mutation_outcome).toBe('already_applied');
    expect(client.hierarchyInsertCount).toBe(1);
  });

  it('does not reveal or mutate another owner task', async () => {
    const client = new FakeTasksClient({ tasks_todos: [task({ owner_id: ownerB })] });
    await expect(updateTaskData({ ...base(), title: 'Cross-owner edit' }, authFor(ownerA, client)))
      .rejects.toThrow('task is unavailable');
    expect(client.taskUpdateCount).toBe(0);
  });
});

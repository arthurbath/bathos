import { describe, expect, it } from 'vitest';

import type { Database, Json } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import { createTask, createTaskData, type CreateTaskRequest } from './tasks-create';
import { planningDateInTimeZone } from './tasks-read';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type QueryError = { code: string; message: string };

class FakeTasksClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  taskInsertCount = 0;

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

  insert(table: TableName, value: StoredRow): { data: null; error: QueryError | null } {
    if (table !== 'tasks_todos') throw new Error(`Unsupported fake insert: ${String(table)}`);
    this.taskInsertCount += 1;
    const tasks = this.rows('tasks_todos');
    const history = this.rows('tasks_history_events');
    const mutationId = value.client_mutation_id;
    const ownerId = value.owner_id;
    if (tasks.some((row) => row.id === value.id || row.client_mutation_id === mutationId)
      || history.some((row) => row.owner_id === ownerId && row.client_mutation_id === mutationId)) {
      return {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      };
    }
    tasks.push({ ...value });
    history.push({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      task_id: value.id,
      client_mutation_id: mutationId,
      actor_type: value.last_actor_type,
      mutation_channel: value.last_mutation_channel,
      affected_ids: [value.id],
      base_revision: 0,
      result_revision: 1,
      transition: 'create',
      occurred_at: value.updated_at,
      outcome: 'accepted',
      code: null,
      before_state: null,
      after_state: creationSnapshot(value),
    });
    return { data: null, error: null };
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | undefined;
  private single = false;
  private inserted: StoredRow | null = null;

  constructor(
    private readonly client: FakeTasksClient,
    private readonly table: TableName,
  ) {}

  select() { return this; }

  insert(value: StoredRow) {
    this.inserted = value;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: null) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  not(column: string, operator: string, value: null) {
    if (operator !== 'is' || value !== null) throw new Error('Unsupported fake NOT query');
    this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then<TResult1 = { data: unknown; error: QueryError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: QueryError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): { data: unknown; error: QueryError | null } {
    if (this.inserted !== null) return this.client.insert(this.table, this.inserted);
    const rows = this.client.rows(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));
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

function creationSnapshot(row: StoredRow): Json {
  return {
    title: row.title as string,
    notes: row.notes as string,
    lifecycle: row.lifecycle as string,
    completed_at: row.completed_at as string | null,
    canceled_at: row.canceled_at as string | null,
    disposition: row.disposition as string,
    deleted_at: row.deleted_at as string | null,
    destination: row.destination as string,
    today_section: row.today_section as string,
    entry_channel: row.entry_channel as string,
    order_key: row.order_key as string,
    start_date: row.start_date as string | null,
    deadline: row.deadline as string | null,
    source_kind: row.source_kind as string | null,
    source_url: row.source_url as string | null,
    source_title: row.source_title as string | null,
    source_external_id: row.source_external_id as string | null,
    area_id: row.area_id as string | null,
    project_id: row.project_id as string | null,
    heading_id: row.heading_id as string | null,
    hierarchy_order_key: row.hierarchy_order_key as string | null,
    deletion_root_id: row.deletion_root_id as string | null,
  };
}

function authFor(userId: string, client: FakeTasksClient): AuthenticatedMcpContext {
  return {
    userId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const mutationId = '20000000-0000-4000-8000-000000000001';
const areaId = '30000000-0000-4000-8000-000000000001';

function request(overrides: Partial<CreateTaskRequest> = {}): CreateTaskRequest {
  return {
    idempotency_key: mutationId,
    title: 'Read the source',
    notes: '',
    destination: 'inbox',
    today_section: 'daytime',
    ...overrides,
  };
}

function settings(ownerId = ownerA): Tables['tasks_user_settings']['Row'] {
  return {
    id: ownerId,
    owner_id: ownerId,
    planning_timezone: 'America/Los_Angeles',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
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
  });

  it('creates owner-scoped Today work with immutable MCP and typed-source provenance', async () => {
    const client = new FakeTasksClient({ tasks_user_settings: [settings()] });
    const result = await createTaskData(request({
      title: '  Read the source  ',
      destination: 'today',
      today_section: 'evening',
      source: {
        kind: 'webpage',
        url: 'https://example.test/article',
        title: 'Example article',
        external_id: 'article-1',
      },
    }), authFor(ownerA, client));

    expect(result.idempotency_outcome).toBe('created');
    expect(result.receipt).toMatchObject({
      client_mutation_id: mutationId,
      base_revision: 0,
      result_revision: 1,
      transition: 'create',
      outcome: 'accepted',
    });
    expect(result.task).toMatchObject({
      title: 'Read the source',
      destination: 'today',
      today_section: 'evening',
      start_date: planningDateInTimeZone('America/Los_Angeles'),
      entry_channel: 'mcp',
      last_mutation_channel: 'mcp',
      last_actor_type: 'automation',
      source_kind: 'webpage',
      source_url: 'https://example.test/article',
    });
    expect(result.task).not.toHaveProperty('owner_id');
    expect(client.rows('tasks_todos')[0]).toMatchObject({ owner_id: ownerA });
    expect(client.rows('tasks_history_events')).toHaveLength(1);
  });

  it('records a declared structured integration channel and includes it in idempotency', async () => {
    const client = new FakeTasksClient();
    const input = request({ entry_channel: 'raycast' });

    const result = await createTaskData(input, authFor(ownerA, client));

    expect(result.receipt).toMatchObject({ mutation_channel: 'raycast' });
    expect(result.task).toMatchObject({
      entry_channel: 'raycast',
      last_mutation_channel: 'raycast',
      last_actor_type: 'automation',
    });
    await expect(createTaskData(
      request({ entry_channel: 'browser_capture' }),
      authFor(ownerA, client),
    )).rejects.toThrow('idempotency key was already used for a different task creation request');
  });

  it('resolves an exact retry through creation history after later edits', async () => {
    const client = new FakeTasksClient();
    const input = request();
    const first = await createTaskData(input, authFor(ownerA, client));
    const stored = client.rows('tasks_todos')[0];
    stored.title = 'Edited after creation';
    stored.revision = 2;
    stored.client_mutation_id = '20000000-0000-4000-8000-000000000002';

    const replay = await createTaskData(input, authFor(ownerA, client));
    expect(replay.idempotency_outcome).toBe('already_applied');
    expect(replay.task).toMatchObject({ id: first.task.id, title: 'Edited after creation', revision: 2 });
    expect(replay.receipt).toMatchObject({ client_mutation_id: mutationId, result_revision: 1 });
    expect(client.taskInsertCount).toBe(1);
    expect(client.rows('tasks_history_events')).toHaveLength(1);
  });

  it('rejects reuse of a creation key with different normalized input', async () => {
    const client = new FakeTasksClient();
    await createTaskData(request(), authFor(ownerA, client));
    await expect(createTaskData(request({ title: 'Different task' }), authFor(ownerA, client)))
      .rejects.toThrow('idempotency key was already used for a different task creation request');
    expect(client.taskInsertCount).toBe(1);
    expect(client.rows('tasks_todos')).toHaveLength(1);
  });

  it('does not resolve another owner\'s matching mutation key', async () => {
    const otherClient = new FakeTasksClient();
    await createTaskData(request(), authFor(ownerB, otherClient));
    await expect(createTaskData(request(), authFor(ownerA, otherClient)))
      .rejects.toThrow('idempotency key is unavailable');
    expect(otherClient.rows('tasks_todos')).toHaveLength(1);
  });

  it('rejects inaccessible containers before insertion', async () => {
    const client = new FakeTasksClient({
      tasks_areas: [{ id: areaId, owner_id: ownerB, disposition: 'present' }],
    });
    await expect(createTaskData(request({ area_id: areaId }), authFor(ownerA, client)))
      .rejects.toThrow('task area is unavailable');
    expect(client.taskInsertCount).toBe(0);
  });

  it('rejects invalid structured-source and calendar combinations', async () => {
    const client = new FakeTasksClient();
    await expect(createTaskData(request({
      source: { kind: 'webpage' },
    }), authFor(ownerA, client))).rejects.toThrow('sources require a URL');
    await expect(createTaskData(request({
      destination: 'anytime',
      start_date: '2026-07-21',
      deadline: '2026-07-20',
    }), authFor(ownerA, client))).rejects.toThrow('Deadline cannot be earlier');
    expect(client.taskInsertCount).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import type { Database, Json } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  reorderTask,
  reorderTaskData,
  reorderTaskHierarchy,
  reorderTaskHierarchyData,
} from './tasks-reorder';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type QueryError = { code: string; message: string };

const ownerId = '10000000-0000-4000-8000-000000000001';
const taskA = '20000000-0000-4000-8000-000000000001';
const taskB = '20000000-0000-4000-8000-000000000002';
const areaA = '30000000-0000-4000-8000-000000000001';
const areaB = '30000000-0000-4000-8000-000000000002';
const projectA = '40000000-0000-4000-8000-000000000001';
const projectB = '40000000-0000-4000-8000-000000000002';
const headingA = '50000000-0000-4000-8000-000000000001';
const headingB = '50000000-0000-4000-8000-000000000002';
const checklistA = '60000000-0000-4000-8000-000000000001';
const checklistB = '60000000-0000-4000-8000-000000000002';

const taskSnapshotKeys = [
  'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at', 'disposition',
  'deleted_at', 'destination', 'today_section', 'order_key', 'start_date', 'deadline',
  'actionability', 'source_kind', 'source_url', 'source_title', 'source_external_id',
  'area_id', 'project_id', 'heading_id', 'hierarchy_order_key', 'deletion_root_id',
] as const;

function taskSnapshot(row: StoredRow): Json {
  return Object.fromEntries(taskSnapshotKeys.map((key) => [key, row[key] as Json]));
}

function hierarchySnapshot(row: StoredRow): Json {
  const { owner_id: _owner, ...snapshot } = row;
  return snapshot as Json;
}

class FakeReorderClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  updateCount = 0;
  rangeCount = 0;

  constructor(tables: Partial<Record<TableName, StoredRow[]>>) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, [...(rows ?? [])]]),
    ) as Partial<Record<TableName, StoredRow[]>>;
  }

  from(table: TableName) { return new FakeQuery(this, table); }
  rows(table: TableName): StoredRow[] { return this.tables[table] ??= []; }

  update(
    table: TableName,
    patch: StoredRow,
    filters: Array<(row: StoredRow) => boolean>,
  ): { data: StoredRow | null; error: QueryError | null } {
    const existingEvent = [
      ...this.rows('tasks_history_events'),
      ...this.rows('tasks_hierarchy_history_events'),
    ].find((event) => event.owner_id === ownerId
      && event.client_mutation_id === patch.client_mutation_id);
    if (existingEvent) {
      return { data: null, error: { code: '23505', message: 'duplicate mutation' } };
    }
    const row = this.rows(table).find((candidate) => filters.every((filter) => filter(candidate)));
    if (!row) return { data: null, error: null };
    this.updateCount += 1;
    const before = { ...row };
    Object.assign(row, patch, { updated_at: '2026-07-20T20:00:00.000Z' });
    if (table === 'tasks_todos') {
      this.rows('tasks_history_events').push({
        id: crypto.randomUUID(),
        owner_id: row.owner_id,
        task_id: row.id,
        client_mutation_id: row.client_mutation_id,
        actor_type: row.last_actor_type,
        mutation_channel: row.last_mutation_channel,
        affected_ids: [row.id],
        base_revision: before.revision,
        result_revision: row.revision,
        transition: 'reorder',
        occurred_at: row.updated_at,
        outcome: 'accepted',
        code: null,
        before_state: taskSnapshot(before),
        after_state: taskSnapshot(row),
      });
    } else {
      const entityType = table === 'tasks_areas' ? 'area'
        : table === 'tasks_projects' ? 'project'
          : table === 'tasks_headings' ? 'heading' : 'checklist_item';
      this.rows('tasks_hierarchy_history_events').push({
        id: crypto.randomUUID(),
        owner_id: row.owner_id,
        entity_type: entityType,
        entity_id: row.id,
        client_mutation_id: row.client_mutation_id,
        operation_id: null,
        actor_type: row.last_actor_type,
        mutation_channel: row.last_mutation_channel,
        affected_ids: [row.id],
        base_revision: before.revision,
        result_revision: row.revision,
        transition: 'reorder',
        occurred_at: row.updated_at,
        before_state: hierarchySnapshot(before),
        after_state: hierarchySnapshot(row),
      });
    }
    return { data: { ...row }, error: null };
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private orderings: Array<{ column: string; ascending: boolean }> = [];
  private selectedRange: [number, number] | null = null;
  private single = false;
  private patch: StoredRow | null = null;

  constructor(
    private readonly client: FakeReorderClient,
    private readonly table: TableName,
  ) {}

  select() { return this; }
  update(value: StoredRow) { this.patch = value; return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderings.push({ column, ascending: options.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.client.rangeCount += 1;
    this.selectedRange = [from, to];
    return this;
  }
  maybeSingle() { this.single = true; return this; }
  then<TResult1 = { data: unknown; error: QueryError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: QueryError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
  private execute(): { data: unknown; error: QueryError | null } {
    if (this.patch) return this.client.update(this.table, this.patch, this.filters);
    let rows = this.client.rows(this.table).filter((row) => (
      this.filters.every((filter) => filter(row))
    ));
    rows = [...rows].sort((left, right) => {
      for (const ordering of this.orderings) {
        const comparison = String(left[ordering.column] ?? '')
          .localeCompare(String(right[ordering.column] ?? ''));
        if (comparison !== 0) return ordering.ascending ? comparison : -comparison;
      }
      return 0;
    });
    if (this.selectedRange) rows = rows.slice(this.selectedRange[0], this.selectedRange[1] + 1);
    return { data: this.single ? rows[0] ?? null : rows, error: null };
  }
}

function auth(client: FakeReorderClient): AuthenticatedMcpContext {
  return {
    userId: ownerId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

function todo(id: string, orderKey: string, overrides: StoredRow = {}): StoredRow {
  return {
    id,
    owner_id: ownerId,
    area_id: null,
    project_id: null,
    heading_id: null,
    title: `Task ${id}`,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: 'next',
    actionability: 'actionable',
    order_key: orderKey,
    hierarchy_order_key: orderKey,
    start_date: '2026-07-20',
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
    client_mutation_id: crypto.randomUUID(),
    created_at: '2026-07-20T17:00:00.000Z',
    updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

function area(id: string, orderKey: string): StoredRow {
  return {
    id, owner_id: ownerId, title: `Area ${id}`, order_key: orderKey,
    disposition: 'present', deleted_at: null, deletion_root_id: null,
    entry_channel: 'web', last_mutation_channel: 'web', last_actor_type: 'user',
    revision: 1, client_mutation_id: crypto.randomUUID(),
    created_at: '2026-07-20T17:00:00.000Z', updated_at: '2026-07-20T17:00:00.000Z',
  };
}

function project(id: string, orderKey: string, overrides: StoredRow = {}): StoredRow {
  return {
    id, owner_id: ownerId, area_id: areaA, title: `Project ${id}`, notes: '',
    lifecycle: 'open', completed_at: null, canceled_at: null,
    disposition: 'present', deleted_at: null, deletion_root_id: null,
    destination: 'anytime', today_section: 'none', start_date: null, deadline: null,
    order_key: orderKey, planning_order_key: orderKey,
    entry_channel: 'web', last_mutation_channel: 'web', last_actor_type: 'user',
    revision: 1, client_mutation_id: crypto.randomUUID(),
    created_at: '2026-07-20T17:00:00.000Z', updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

function heading(id: string, orderKey: string): StoredRow {
  return {
    id, owner_id: ownerId, project_id: projectA, title: `Heading ${id}`,
    order_key: orderKey, disposition: 'present', deleted_at: null, deletion_root_id: null,
    entry_channel: 'web', last_mutation_channel: 'web', last_actor_type: 'user',
    revision: 1, client_mutation_id: crypto.randomUUID(),
    created_at: '2026-07-20T17:00:00.000Z', updated_at: '2026-07-20T17:00:00.000Z',
  };
}

function checklist(id: string, orderKey: string): StoredRow {
  return {
    id, owner_id: ownerId, task_id: taskA, title: `Checklist ${id}`,
    completed: false, completed_at: null, order_key: orderKey,
    disposition: 'present', deleted_at: null, deletion_root_id: null,
    entry_channel: 'web', last_mutation_channel: 'web', last_actor_type: 'user',
    revision: 1, client_mutation_id: crypto.randomUUID(),
    created_at: '2026-07-20T17:00:00.000Z', updated_at: '2026-07-20T17:00:00.000Z',
  };
}

describe('Tasks MCP reorder tools', () => {
  it('registers closed direction-based tools', () => {
    expect(reorderTask.name).toBe('reorder_task');
    expect(reorderTaskHierarchy.name).toBe('reorder_task_hierarchy');
  });

  it('reorders a Today to-do only within its section and preserves hierarchy order', async () => {
    const first = todo(taskA, 'a0');
    const second = todo(taskB, 'a1');
    const later = todo(crypto.randomUUID(), 'a0', { today_section: 'later' });
    const client = new FakeReorderClient({ tasks_todos: [first, second, later] });
    const result = await reorderTaskData({
      task_id: taskB,
      scope: 'planning',
      view: 'today',
      planning_date: '2026-07-20',
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));

    expect(result.mutation_outcome).toBe('applied');
    expect((result.task as StoredRow).order_key < 'a0').toBe(true);
    expect((result.task as StoredRow).hierarchy_order_key).toBe('a1');
    expect(client.updateCount).toBe(1);
  });

  it('reorders a to-do within exact hierarchy peers without changing planning order', async () => {
    const first = todo(taskA, 'a0', { project_id: projectA });
    const second = todo(taskB, 'a1', { project_id: projectA });
    const other = todo(crypto.randomUUID(), 'a0', { project_id: projectB });
    const client = new FakeReorderClient({ tasks_todos: [first, second, other] });
    const result = await reorderTaskData({
      task_id: taskB,
      scope: 'hierarchy',
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));

    expect(result.mutation_outcome).toBe('applied');
    expect((result.task as StoredRow).hierarchy_order_key < 'a0').toBe(true);
    expect((result.task as StoredRow).order_key).toBe('a1');
  });

  it('paginates the complete planning collection before moving a to-do', async () => {
    const tasks = Array.from({ length: 501 }, (_, index) => todo(
      `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      `a${String(index).padStart(4, '0')}`,
    ));
    const moving = tasks[500];
    const client = new FakeReorderClient({ tasks_todos: tasks });
    const result = await reorderTaskData({
      task_id: String(moving.id),
      scope: 'planning',
      view: 'today',
      planning_date: '2026-07-20',
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));

    expect(result.mutation_outcome).toBe('applied');
    expect(client.rangeCount).toBeGreaterThanOrEqual(2);
  });

  it('reorders project planning independently from structural order', async () => {
    const client = new FakeReorderClient({
      tasks_projects: [project(projectA, 'a0'), project(projectB, 'a1')],
    });
    const result = await reorderTaskHierarchyData({
      record_type: 'project',
      record_id: projectB,
      scope: 'planning',
      view: 'anytime',
      planning_date: '2026-07-20',
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));

    expect(result.mutation_outcome).toBe('applied');
    expect((result.record as StoredRow).planning_order_key < 'a0').toBe(true);
    expect((result.record as StoredRow).order_key).toBe('a1');
  });

  it.each([
    ['area', areaB, 'tasks_areas', [area(areaA, 'a0'), area(areaB, 'a1')]],
    ['project', projectB, 'tasks_projects', [project(projectA, 'a0'), project(projectB, 'a1')]],
    ['heading', headingB, 'tasks_headings', [heading(headingA, 'a0'), heading(headingB, 'a1')]],
    ['checklist_item', checklistB, 'tasks_checklist_items', [checklist(checklistA, 'a0'), checklist(checklistB, 'a1')]],
  ] as const)('reorders one %s within its structural peers', async (recordType, recordId, table, rows) => {
    const tables: Partial<Record<TableName, StoredRow[]>> = { [table]: [...rows] };
    if (recordType === 'heading') tables.tasks_projects = [project(projectA, 'a0')];
    if (recordType === 'checklist_item') tables.tasks_todos = [todo(taskA, 'a0')];
    const client = new FakeReorderClient(tables);
    const result = await reorderTaskHierarchyData({
      record_type: recordType,
      record_id: recordId,
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));

    expect(result.mutation_outcome).toBe('applied');
    expect((result.record as StoredRow).order_key < 'a0').toBe(true);
  });

  it('returns content-free boundary and stale outcomes without writing', async () => {
    const only = todo(taskA, 'a0');
    const client = new FakeReorderClient({ tasks_todos: [only] });
    const boundary = await reorderTaskData({
      task_id: taskA,
      scope: 'planning',
      view: 'today',
      planning_date: '2026-07-20',
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));
    const stale = await reorderTaskData({
      task_id: taskA,
      scope: 'hierarchy',
      direction: 'down',
      expected_revision: 2,
      client_mutation_id: crypto.randomUUID(),
    }, auth(client));

    expect(boundary).toMatchObject({
      mutation_outcome: 'noop', receipt: { code: 'collection_boundary' },
    });
    expect(stale).toMatchObject({
      mutation_outcome: 'conflict', receipt: { code: 'revision_conflict' },
    });
    expect(client.updateCount).toBe(0);
  });

  it('resolves an exact accepted retry after later record changes and rejects changed reuse', async () => {
    const client = new FakeReorderClient({
      tasks_todos: [todo(taskA, 'a0'), todo(taskB, 'a1')],
    });
    const mutationId = crypto.randomUUID();
    const request = {
      task_id: taskB,
      scope: 'planning' as const,
      view: 'today' as const,
      planning_date: '2026-07-20',
      direction: 'up' as const,
      expected_revision: 1,
      client_mutation_id: mutationId,
    };
    await reorderTaskData(request, auth(client));
    Object.assign(client.rows('tasks_todos').find((row) => row.id === taskB)!, {
      title: 'Later edit', revision: 3,
    });

    const retry = await reorderTaskData(request, auth(client));
    expect(retry).toMatchObject({
      mutation_outcome: 'already_applied',
      task: { title: 'Later edit', revision: 3 },
    });
    await expect(reorderTaskData({ ...request, direction: 'down' }, auth(client)))
      .rejects.toThrow('different reorder direction');
    expect(client.updateCount).toBe(1);
  });

  it('rejects a mutation UUID already used by the other history surface', async () => {
    const mutationId = crypto.randomUUID();
    const client = new FakeReorderClient({
      tasks_todos: [todo(taskA, 'a0')],
      tasks_hierarchy_history_events: [{
        id: crypto.randomUUID(), owner_id: ownerId, client_mutation_id: mutationId,
      }],
    });
    await expect(reorderTaskData({
      task_id: taskA,
      scope: 'hierarchy',
      direction: 'up',
      expected_revision: 1,
      client_mutation_id: mutationId,
    }, auth(client))).rejects.toThrow('another task operation');
  });
});

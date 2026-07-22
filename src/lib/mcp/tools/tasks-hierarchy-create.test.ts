import { describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  createTaskArea,
  createTaskAreaData,
  createTaskChecklistItem,
  createTaskChecklistItemData,
  createTaskHeading,
  createTaskHeadingData,
  createTaskProject,
  createTaskProjectData,
} from './tasks-hierarchy-create';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type QueryError = { code: string; message: string };

class FakeHierarchyClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  insertCount = 0;

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
    const supported = [
      'tasks_areas',
      'tasks_projects',
      'tasks_headings',
      'tasks_checklist_items',
    ];
    if (!supported.includes(table)) throw new Error(`Unsupported fake insert: ${String(table)}`);
    this.insertCount += 1;
    const rows = this.rows(table);
    const history = this.rows('tasks_hierarchy_history_events');
    if (rows.some((row) => row.id === value.id || (
      row.owner_id === value.owner_id && row.client_mutation_id === value.client_mutation_id
    )) || history.some((row) => (
      row.owner_id === value.owner_id && row.client_mutation_id === value.client_mutation_id
    ))) {
      return {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      };
    }
    rows.push({ ...value });
    const entityType = table === 'tasks_areas'
      ? 'area'
      : table === 'tasks_projects'
        ? 'project'
        : table === 'tasks_headings' ? 'heading' : 'checklist_item';
    const { owner_id: _ownerId, ...afterState } = value;
    history.push({
      id: crypto.randomUUID(),
      owner_id: value.owner_id,
      entity_type: entityType,
      entity_id: value.id,
      client_mutation_id: value.client_mutation_id,
      operation_id: null,
      actor_type: value.last_actor_type,
      mutation_channel: value.last_mutation_channel,
      affected_ids: [value.id],
      base_revision: 0,
      result_revision: 1,
      transition: 'create',
      occurred_at: value.updated_at,
      before_state: null,
      after_state: afterState,
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
    private readonly client: FakeHierarchyClient,
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

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const areaId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const taskId = '40000000-0000-4000-8000-000000000001';

function authFor(userId: string, client: FakeHierarchyClient): AuthenticatedMcpContext {
  return {
    userId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

function parentArea(ownerId = ownerA): StoredRow {
  return { id: areaId, owner_id: ownerId, disposition: 'present', order_key: 'a0' };
}

function parentProject(ownerId = ownerA): StoredRow {
  return {
    id: projectId,
    owner_id: ownerId,
    area_id: areaId,
    disposition: 'present',
    lifecycle: 'open',
    order_key: 'a0',
    planning_order_key: 'a0',
  };
}

function parentTask(ownerId = ownerA): StoredRow {
  return {
    id: taskId,
    owner_id: ownerId,
    disposition: 'present',
    lifecycle: 'open',
  };
}

describe('Tasks MCP hierarchy creation tools', () => {
  it('advertises four explicit idempotent closed-world mutations', () => {
    expect([
      createTaskArea.name,
      createTaskProject.name,
      createTaskHeading.name,
      createTaskChecklistItem.name,
    ]).toEqual([
      'create_task_area',
      'create_task_project',
      'create_task_heading',
      'create_task_checklist_item',
    ]);
    for (const tool of [
      createTaskArea,
      createTaskProject,
      createTaskHeading,
      createTaskChecklistItem,
    ]) {
      expect(tool.annotations).toEqual({
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it('creates an owner-scoped area with MCP automation provenance and safe ordering', async () => {
    const client = new FakeHierarchyClient({
      tasks_areas: [{ ...parentArea(), id: crypto.randomUUID(), order_key: 'a1' }],
    });
    const result = await createTaskAreaData({
      idempotency_key: '50000000-0000-4000-8000-000000000001',
      title: '  Personal  ',
    }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'created',
      record_type: 'area',
      receipt: {
        actor_type: 'automation',
        mutation_channel: 'mcp',
        transition: 'create',
        base_revision: 0,
        result_revision: 1,
      },
      record: { title: 'Personal', entry_channel: 'mcp', revision: 1 },
    });
    expect(result.record).not.toHaveProperty('owner_id');
    expect(String(result.record.order_key) > 'a1').toBe(true);
  });

  it('creates a structured project only beneath an owned present area', async () => {
    const client = new FakeHierarchyClient({ tasks_areas: [parentArea()] });
    const result = await createTaskProjectData({
      idempotency_key: '50000000-0000-4000-8000-000000000002',
      title: 'Launch',
      notes: 'Keep this bounded',
      area_id: areaId,
      destination: 'anytime',
      today_section: 'later',
      start_date: '2026-07-20',
      deadline: '2026-07-21',
    }, authFor(ownerA, client));

    expect(result.record).toMatchObject({
      area_id: areaId,
      title: 'Launch',
      notes: 'Keep this bounded',
      lifecycle: 'open',
      destination: 'anytime',
      today_section: 'later',
      start_date: '2026-07-20',
      deadline: '2026-07-21',
    });

    const inaccessible = new FakeHierarchyClient({ tasks_areas: [parentArea(ownerB)] });
    await expect(createTaskProjectData({
      idempotency_key: '50000000-0000-4000-8000-000000000003',
      title: 'No access',
      notes: '',
      area_id: areaId,
      destination: 'anytime',
      today_section: 'next',
    }, authFor(ownerA, inaccessible))).rejects.toThrow('area is unavailable');
    expect(inaccessible.insertCount).toBe(0);
  });

  it('creates headings and checklist items only beneath owned open parents', async () => {
    const client = new FakeHierarchyClient({
      tasks_projects: [parentProject()],
      tasks_todos: [parentTask()],
    });
    const heading = await createTaskHeadingData({
      idempotency_key: '50000000-0000-4000-8000-000000000004',
      project_id: projectId,
      title: 'First phase',
    }, authFor(ownerA, client));
    const item = await createTaskChecklistItemData({
      idempotency_key: '50000000-0000-4000-8000-000000000005',
      task_id: taskId,
      title: 'Confirm details',
    }, authFor(ownerA, client));

    expect(heading.record).toMatchObject({ project_id: projectId, title: 'First phase' });
    expect(item.record).toMatchObject({
      task_id: taskId,
      title: 'Confirm details',
      completed: false,
      completed_at: null,
    });
  });

  it('returns the immutable creation receipt on an exact retry after later edits', async () => {
    const client = new FakeHierarchyClient();
    const request = {
      idempotency_key: '50000000-0000-4000-8000-000000000006',
      title: 'Original area',
    };
    const first = await createTaskAreaData(request, authFor(ownerA, client));
    const stored = client.rows('tasks_areas')[0];
    stored.title = 'Later title';
    stored.revision = 2;

    const replay = await createTaskAreaData(request, authFor(ownerA, client));

    expect(replay).toMatchObject({
      mutation_outcome: 'already_applied',
      receipt: first.receipt,
      record: { title: 'Later title', revision: 2 },
    });
    expect(client.insertCount).toBe(1);
  });

  it('replays a child creation after its parent is no longer open', async () => {
    const client = new FakeHierarchyClient({ tasks_projects: [parentProject()] });
    const request = {
      idempotency_key: '50000000-0000-4000-8000-000000000009',
      project_id: projectId,
      title: 'First phase',
    };
    await createTaskHeadingData(request, authFor(ownerA, client));
    client.rows('tasks_projects')[0].lifecycle = 'completed';

    await expect(createTaskHeadingData(request, authFor(ownerA, client))).resolves.toMatchObject({
      mutation_outcome: 'already_applied',
      record_type: 'heading',
    });
    expect(client.insertCount).toBe(1);
  });

  it('rejects changed data for a used idempotency key without another write', async () => {
    const client = new FakeHierarchyClient();
    const idempotencyKey = '50000000-0000-4000-8000-000000000007';
    await createTaskAreaData({
      idempotency_key: idempotencyKey,
      title: 'Personal',
    }, authFor(ownerA, client));

    await expect(createTaskAreaData({
      idempotency_key: idempotencyKey,
      title: 'Work',
    }, authFor(ownerA, client))).rejects.toThrow('different hierarchy data');
    expect(client.insertCount).toBe(1);
  });

  it('rejects invalid project planning without writing', async () => {
    const client = new FakeHierarchyClient();
    await expect(createTaskProjectData({
      idempotency_key: '50000000-0000-4000-8000-000000000008',
      title: 'Invalid planning',
      notes: '',
      destination: 'someday',
      today_section: 'next',
      start_date: '2026-07-20',
    }, authFor(ownerA, client))).rejects.toThrow('Someday projects');
    expect(client.insertCount).toBe(0);
  });

  it('rejects an idempotency key already used by a to-do mutation', async () => {
    const idempotencyKey = '50000000-0000-4000-8000-000000000010';
    const client = new FakeHierarchyClient({
      tasks_history_events: [{
        id: crypto.randomUUID(),
        owner_id: ownerA,
        client_mutation_id: idempotencyKey,
      }],
    });

    await expect(createTaskAreaData({
      idempotency_key: idempotencyKey,
      title: 'Personal',
    }, authFor(ownerA, client))).rejects.toThrow('different task mutation');
    expect(client.insertCount).toBe(0);
  });

  it('rejects an idempotency key already used by a hierarchy operation', async () => {
    const idempotencyKey = '50000000-0000-4000-8000-000000000011';
    const client = new FakeHierarchyClient({
      tasks_hierarchy_operations: [{ id: idempotencyKey, owner_id: ownerA }],
    });

    await expect(createTaskAreaData({
      idempotency_key: idempotencyKey,
      title: 'Personal',
    }, authFor(ownerA, client))).rejects.toThrow('different hierarchy operation');
    expect(client.insertCount).toBe(0);
  });
});

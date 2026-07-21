import { describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  updateTaskArea,
  updateTaskAreaData,
  updateTaskChecklistItem,
  updateTaskChecklistItemData,
  updateTaskHeading,
  updateTaskHeadingData,
  updateTaskProject,
  updateTaskProjectData,
} from './tasks-hierarchy-update';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type QueryError = { code: string; message: string };

class FakeHierarchyUpdateClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  updateCount = 0;

  constructor(tables: Partial<Record<TableName, StoredRow[]>> = {}) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, [...(rows ?? [])]]),
    ) as Partial<Record<TableName, StoredRow[]>>;
  }

  from(table: TableName) {
    return new FakeUpdateQuery(this, table);
  }

  rows(table: TableName): StoredRow[] {
    return this.tables[table] ??= [];
  }

  update(
    table: TableName,
    patch: StoredRow,
    filters: Array<(row: StoredRow) => boolean>,
  ): { data: StoredRow | null; error: QueryError | null } {
    const row = this.rows(table).find((candidate) => filters.every((filter) => filter(candidate)));
    if (!row) return { data: null, error: null };
    const history = this.rows('tasks_hierarchy_history_events');
    if (history.some((event) => (
      event.owner_id === row.owner_id && event.client_mutation_id === patch.client_mutation_id
    ))) {
      return {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      };
    }
    this.updateCount += 1;
    const before = { ...row };
    Object.assign(row, patch, { updated_at: '2026-07-20T18:00:00.000Z' });
    const entityType = table === 'tasks_areas'
      ? 'area'
      : table === 'tasks_projects'
        ? 'project'
        : table === 'tasks_headings' ? 'heading' : 'checklist_item';
    const { owner_id: _beforeOwner, ...beforeState } = before;
    const { owner_id: _afterOwner, ...afterState } = row;
    history.push({
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
      transition: 'update',
      occurred_at: row.updated_at,
      before_state: beforeState,
      after_state: afterState,
    });
    return { data: { ...row }, error: null };
  }
}

class FakeUpdateQuery implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private single = false;
  private patch: StoredRow | null = null;

  constructor(
    private readonly client: FakeHierarchyUpdateClient,
    private readonly table: TableName,
  ) {}

  select() { return this; }

  update(value: StoredRow) {
    this.patch = value;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
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
    if (this.patch !== null) return this.client.update(this.table, this.patch, this.filters);
    const rows = this.client.rows(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));
    return { data: this.single ? rows[0] ?? null : rows, error: null };
  }
}

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const areaId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const headingId = '40000000-0000-4000-8000-000000000001';
const taskId = '50000000-0000-4000-8000-000000000001';
const checklistId = '60000000-0000-4000-8000-000000000001';

function authFor(userId: string, client: FakeHierarchyUpdateClient): AuthenticatedMcpContext {
  return {
    userId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

function area(overrides: StoredRow = {}): StoredRow {
  return {
    id: areaId,
    owner_id: ownerA,
    title: 'Personal',
    order_key: 'a0',
    disposition: 'present',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

function project(overrides: StoredRow = {}): StoredRow {
  return {
    id: projectId,
    owner_id: ownerA,
    title: 'Launch',
    notes: '',
    disposition: 'present',
    lifecycle: 'open',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

function heading(overrides: StoredRow = {}): StoredRow {
  return {
    id: headingId,
    owner_id: ownerA,
    project_id: projectId,
    title: 'First phase',
    disposition: 'present',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

function task(overrides: StoredRow = {}): StoredRow {
  return {
    id: taskId,
    owner_id: ownerA,
    disposition: 'present',
    lifecycle: 'open',
    ...overrides,
  };
}

function checklist(overrides: StoredRow = {}): StoredRow {
  return {
    id: checklistId,
    owner_id: ownerA,
    task_id: taskId,
    title: 'Confirm details',
    completed: false,
    completed_at: null,
    disposition: 'present',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

describe('Tasks MCP hierarchy update tools', () => {
  it('advertises four explicit idempotent closed-world mutations', () => {
    expect([
      updateTaskArea.name,
      updateTaskProject.name,
      updateTaskHeading.name,
      updateTaskChecklistItem.name,
    ]).toEqual([
      'update_task_area',
      'update_task_project',
      'update_task_heading',
      'update_task_checklist_item',
    ]);
    for (const tool of [
      updateTaskArea,
      updateTaskProject,
      updateTaskHeading,
      updateTaskChecklistItem,
    ]) {
      expect(tool.annotations).toEqual({
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it('updates an owned area through the expected revision and returns an audit receipt', async () => {
    const client = new FakeHierarchyUpdateClient({ tasks_areas: [area()] });
    const result = await updateTaskAreaData({
      area_id: areaId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000001',
      title: '  Home  ',
    }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      record_type: 'area',
      receipt: {
        actor_type: 'automation',
        mutation_channel: 'mcp',
        base_revision: 1,
        result_revision: 2,
        transition: 'update',
        outcome: 'accepted',
      },
      record: { title: 'Home', revision: 2 },
    });
    expect(result.record).not.toHaveProperty('owner_id');
  });

  it('returns content-free conflict and no-op outcomes without writing history', async () => {
    const client = new FakeHierarchyUpdateClient({ tasks_areas: [area({ revision: 2 })] });
    const conflict = await updateTaskAreaData({
      area_id: areaId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000002',
      title: 'Home',
    }, authFor(ownerA, client));
    const noop = await updateTaskAreaData({
      area_id: areaId,
      expected_revision: 2,
      client_mutation_id: '70000000-0000-4000-8000-000000000003',
      title: 'Personal',
    }, authFor(ownerA, client));

    expect(conflict).toMatchObject({
      mutation_outcome: 'conflict',
      receipt: { outcome: 'conflict', code: 'revision_conflict', result_revision: 2 },
    });
    expect(noop).toMatchObject({
      mutation_outcome: 'noop',
      receipt: { outcome: 'noop', code: 'already_current', result_revision: 2 },
    });
    expect(client.updateCount).toBe(0);
    expect(client.rows('tasks_hierarchy_history_events')).toHaveLength(0);
  });

  it('replays an exact project update from immutable history after later edits', async () => {
    const client = new FakeHierarchyUpdateClient({ tasks_projects: [project()] });
    const request = {
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000004',
      notes: 'Ready for review',
    };
    const first = await updateTaskProjectData(request, authFor(ownerA, client));
    Object.assign(client.rows('tasks_projects')[0], {
      title: 'Later title',
      revision: 3,
      lifecycle: 'completed',
    });

    const replay = await updateTaskProjectData(request, authFor(ownerA, client));

    expect(replay).toMatchObject({
      mutation_outcome: 'already_applied',
      receipt: first.receipt,
      record: { title: 'Later title', notes: 'Ready for review', revision: 3 },
    });
    expect(client.updateCount).toBe(1);
  });

  it('rejects changed data for an accepted mutation identifier', async () => {
    const client = new FakeHierarchyUpdateClient({ tasks_projects: [project()] });
    const mutationId = '70000000-0000-4000-8000-000000000005';
    await updateTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      notes: 'First value',
    }, authFor(ownerA, client));

    await expect(updateTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      notes: 'Changed value',
    }, authFor(ownerA, client))).rejects.toThrow('different hierarchy data');
    expect(client.updateCount).toBe(1);
  });

  it('requires an open owned parent before editing a heading', async () => {
    const client = new FakeHierarchyUpdateClient({
      tasks_headings: [heading()],
      tasks_projects: [project({ lifecycle: 'completed' })],
    });
    await expect(updateTaskHeadingData({
      heading_id: headingId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000006',
      title: 'Changed phase',
    }, authFor(ownerA, client))).rejects.toThrow('parent project');
    expect(client.updateCount).toBe(0);

    const inaccessible = new FakeHierarchyUpdateClient({
      tasks_headings: [heading({ owner_id: ownerB })],
    });
    await expect(updateTaskHeadingData({
      heading_id: headingId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000007',
      title: 'Changed phase',
    }, authFor(ownerA, inaccessible))).rejects.toThrow('heading is unavailable');
  });

  it('completes a checklist item with coupled completion state', async () => {
    const client = new FakeHierarchyUpdateClient({
      tasks_checklist_items: [checklist()],
      tasks_todos: [task()],
    });
    const result = await updateTaskChecklistItemData({
      checklist_item_id: checklistId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000008',
      completed: true,
    }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      record: { completed: true, completed_at: expect.any(String), revision: 2 },
    });

    const noop = await updateTaskChecklistItemData({
      checklist_item_id: checklistId,
      expected_revision: 2,
      client_mutation_id: '70000000-0000-4000-8000-000000000010',
      completed: true,
    }, authFor(ownerA, client));
    expect(noop).toMatchObject({
      mutation_outcome: 'noop',
      record: { completed: true, revision: 2 },
    });
    expect(client.updateCount).toBe(1);
  });

  it('rejects a mutation identifier already used by a to-do mutation', async () => {
    const mutationId = '70000000-0000-4000-8000-000000000009';
    const client = new FakeHierarchyUpdateClient({
      tasks_areas: [area()],
      tasks_history_events: [{
        id: crypto.randomUUID(),
        owner_id: ownerA,
        client_mutation_id: mutationId,
      }],
    });
    await expect(updateTaskAreaData({
      area_id: areaId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      title: 'Home',
    }, authFor(ownerA, client))).rejects.toThrow('different task request');
    expect(client.updateCount).toBe(0);
  });

  it('rejects a mutation identifier already used by a hierarchy operation', async () => {
    const mutationId = '70000000-0000-4000-8000-000000000011';
    const client = new FakeHierarchyUpdateClient({
      tasks_areas: [area()],
      tasks_hierarchy_operations: [{ id: mutationId, owner_id: ownerA }],
    });
    await expect(updateTaskAreaData({
      area_id: areaId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      title: 'Home',
    }, authFor(ownerA, client))).rejects.toThrow('different hierarchy operation');
    expect(client.updateCount).toBe(0);
  });
});

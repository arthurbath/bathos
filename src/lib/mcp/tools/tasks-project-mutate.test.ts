import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  moveTaskProject,
  moveTaskProjectData,
  scheduleTaskProject,
  scheduleTaskProjectData,
} from './tasks-project-mutate';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;
type QueryError = { code: string; message: string };

class FakeProjectMutationClient {
  readonly tables: Partial<Record<TableName, StoredRow[]>>;
  updateCount = 0;

  constructor(tables: Partial<Record<TableName, StoredRow[]>> = {}) {
    this.tables = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, [...(rows ?? [])]]),
    ) as Partial<Record<TableName, StoredRow[]>>;
  }

  from(table: TableName) {
    return new FakeProjectQuery(this, table);
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
    Object.assign(row, patch, { updated_at: '2026-07-20T20:00:00.000Z' });
    const transition = before.area_id !== row.area_id
      ? 'move'
      : before.order_key !== row.order_key
        || before.planning_order_key !== row.planning_order_key
        ? 'reorder'
        : 'update';
    const { owner_id: _beforeOwner, ...beforeState } = before;
    const { owner_id: _afterOwner, ...afterState } = row;
    history.push({
      id: crypto.randomUUID(),
      owner_id: row.owner_id,
      entity_type: 'project',
      entity_id: row.id,
      client_mutation_id: row.client_mutation_id,
      operation_id: null,
      actor_type: row.last_actor_type,
      mutation_channel: row.last_mutation_channel,
      affected_ids: [row.id],
      base_revision: before.revision,
      result_revision: row.revision,
      transition,
      occurred_at: row.updated_at,
      before_state: beforeState,
      after_state: afterState,
    });
    return { data: { ...row }, error: null };
  }
}

class FakeProjectQuery implements PromiseLike<{ data: unknown; error: QueryError | null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private orderings: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | null = null;
  private single = false;
  private patch: StoredRow | null = null;

  constructor(
    private readonly client: FakeProjectMutationClient,
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

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderings.push({ column, ascending: options.ascending !== false });
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
    if (this.patch !== null) return this.client.update(this.table, this.patch, this.filters);
    let rows = this.client.rows(this.table)
      .filter((row) => this.filters.every((filter) => filter(row)));
    if (this.orderings.length > 0) {
      rows = [...rows].sort((left, right) => {
        for (const { column, ascending } of this.orderings) {
          const comparison = String(left[column] ?? '').localeCompare(String(right[column] ?? ''));
          if (comparison !== 0) return ascending ? comparison : -comparison;
        }
        return 0;
      });
    }
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    return { data: this.single ? rows[0] ?? null : rows, error: null };
  }
}

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const areaA = '20000000-0000-4000-8000-000000000001';
const areaB = '20000000-0000-4000-8000-000000000002';
const projectId = '30000000-0000-4000-8000-000000000001';

function authFor(
  userId: string,
  client: FakeProjectMutationClient,
): AuthenticatedMcpContext {
  return {
    userId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

function area(id: string, ownerId = ownerA): StoredRow {
  return {
    id,
    owner_id: ownerId,
    title: 'Area',
    disposition: 'present',
    order_key: 'a0',
  };
}

function settings(ownerId = ownerA): StoredRow {
  return {
    owner_id: ownerId,
    planning_timezone: 'America/Los_Angeles',
  };
}

function project(overrides: StoredRow = {}): StoredRow {
  return {
    id: projectId,
    owner_id: ownerA,
    area_id: areaA,
    title: 'Launch',
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: 'daytime',
    order_key: 'a0',
    planning_order_key: 'a0',
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    created_at: '2026-07-20T17:00:00.000Z',
    updated_at: '2026-07-20T17:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T20:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Tasks MCP project movement and scheduling tools', () => {
  it('advertises two explicit idempotent closed-world mutations', () => {
    expect([moveTaskProject.name, scheduleTaskProject.name]).toEqual([
      'move_task_project',
      'schedule_task_project',
    ]);
    expect(moveTaskProject.annotations).toEqual({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(scheduleTaskProject.annotations).toEqual(moveTaskProject.annotations);
  });

  it('moves an owned project to another area and Today with generated order keys', async () => {
    const client = new FakeProjectMutationClient({
      tasks_areas: [area(areaA), area(areaB)],
      tasks_projects: [
        project(),
        project({
          id: '30000000-0000-4000-8000-000000000002',
          area_id: areaB,
          order_key: 'a1',
          destination: 'today',
          today_section: 'evening',
          start_date: '2026-07-20',
          planning_order_key: 'a1',
        }),
      ],
      tasks_user_settings: [settings()],
    });
    const result = await moveTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000001',
      area_id: areaB,
      destination: 'today',
      today_section: 'evening',
    }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: {
        actor_type: 'automation',
        mutation_channel: 'mcp',
        base_revision: 1,
        result_revision: 2,
        transition: 'move',
        outcome: 'accepted',
      },
      project: {
        area_id: areaB,
        destination: 'today',
        today_section: 'evening',
        start_date: '2026-07-20',
        revision: 2,
      },
    });
    expect(result.project.order_key).not.toBe('a0');
    expect(result.project.planning_order_key).not.toBe('a0');
    expect(result.project).not.toHaveProperty('owner_id');
  });

  it('activates a Someday project when a start date is assigned', async () => {
    const client = new FakeProjectMutationClient({
      tasks_projects: [
        project({ destination: 'someday' }),
        project({
          id: '30000000-0000-4000-8000-000000000002',
          planning_order_key: 'a1',
        }),
      ],
      tasks_user_settings: [settings()],
    });
    const result = await scheduleTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000002',
      start_date: '2026-07-24',
      deadline: '2026-07-25',
    }, authFor(ownerA, client));

    expect(result).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'reorder', outcome: 'accepted' },
      project: {
        destination: 'anytime',
        today_section: 'daytime',
        start_date: '2026-07-24',
        deadline: '2026-07-25',
        revision: 2,
      },
    });
  });

  it('replays an exact project movement from immutable history after later edits', async () => {
    const client = new FakeProjectMutationClient({
      tasks_areas: [area(areaA), area(areaB)],
      tasks_projects: [project()],
      tasks_user_settings: [settings()],
    });
    const request = {
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000003',
      area_id: areaB,
    };
    const first = await moveTaskProjectData(request, authFor(ownerA, client));
    Object.assign(client.rows('tasks_projects')[0], {
      title: 'Later title',
      revision: 3,
      destination: 'someday',
    });

    const replay = await moveTaskProjectData(request, authFor(ownerA, client));

    expect(replay).toMatchObject({
      mutation_outcome: 'already_applied',
      receipt: first.receipt,
      project: { title: 'Later title', area_id: areaB, revision: 3 },
    });
    expect(client.updateCount).toBe(1);
  });

  it('returns content-free conflict and no-op outcomes without writing history', async () => {
    const client = new FakeProjectMutationClient({
      tasks_projects: [project({ revision: 2 })],
      tasks_user_settings: [settings()],
    });
    const conflict = await scheduleTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: '70000000-0000-4000-8000-000000000004',
      deadline: '2026-07-30',
    }, authFor(ownerA, client));
    const noop = await scheduleTaskProjectData({
      project_id: projectId,
      expected_revision: 2,
      client_mutation_id: '70000000-0000-4000-8000-000000000005',
      deadline: null,
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

  it('rejects changed retry data, inaccessible areas, and non-open projects', async () => {
    const client = new FakeProjectMutationClient({
      tasks_areas: [area(areaA), area(areaB, ownerB)],
      tasks_projects: [project()],
      tasks_user_settings: [settings()],
    });
    const mutationId = '70000000-0000-4000-8000-000000000006';
    await scheduleTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      deadline: '2026-07-30',
    }, authFor(ownerA, client));
    await expect(scheduleTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      deadline: '2026-07-31',
    }, authFor(ownerA, client))).rejects.toThrow('different project data');

    Object.assign(client.rows('tasks_projects')[0], { lifecycle: 'completed', revision: 3 });
    await expect(moveTaskProjectData({
      project_id: projectId,
      expected_revision: 3,
      client_mutation_id: '70000000-0000-4000-8000-000000000007',
      area_id: null,
    }, authFor(ownerA, client))).rejects.toThrow('Reopen the project');

    Object.assign(client.rows('tasks_projects')[0], { lifecycle: 'open' });
    await expect(moveTaskProjectData({
      project_id: projectId,
      expected_revision: 3,
      client_mutation_id: '70000000-0000-4000-8000-000000000008',
      area_id: areaB,
    }, authFor(ownerA, client))).rejects.toThrow('area is unavailable');
  });

  it('rejects a mutation UUID already used by a to-do mutation', async () => {
    const mutationId = '70000000-0000-4000-8000-000000000009';
    const client = new FakeProjectMutationClient({
      tasks_projects: [project()],
      tasks_history_events: [{
        id: crypto.randomUUID(),
        owner_id: ownerA,
        client_mutation_id: mutationId,
      }],
    });

    await expect(moveTaskProjectData({
      project_id: projectId,
      expected_revision: 1,
      client_mutation_id: mutationId,
      area_id: null,
    }, authFor(ownerA, client))).rejects.toThrow('different task request');
    expect(client.updateCount).toBe(0);
  });
});

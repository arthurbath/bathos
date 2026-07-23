import { describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  getTaskHierarchy,
  getTaskHierarchyData,
  getTaskRecord,
  getTaskRecordData,
  getTaskView,
  getTaskViewData,
  planningDateInTimeZone,
} from './tasks-read';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type StoredRow = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<(row: StoredRow) => boolean> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | undefined;
  private single = false;

  constructor(private readonly source: StoredRow[]) {}

  select() { return this; }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  lt(column: string, value: string) {
    this.filters.push((row) => typeof row[column] === 'string' && row[column] < value);
    return this;
  }

  gt(column: string, value: string) {
    this.filters.push((row) => typeof row[column] === 'string' && row[column] > value);
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push((row) => typeof row[column] === 'string' && row[column] <= value);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) {
      this.filters.push((row) => row[column] !== null);
      return this;
    }
    throw new Error(`Unsupported fake NOT clause: ${column}.${operator}.${String(value)}`);
  }

  or(expression: string) {
    const clauses = expression.split(',').map((clause) => {
      const [column, operator, ...rawValue] = clause.split('.');
      const value = rawValue.join('.');
      if (operator === 'is' && value === 'null') return (row: StoredRow) => row[column] === null;
      if (operator === 'eq') return (row: StoredRow) => row[column] === value;
      if (operator === 'lte') {
        return (row: StoredRow) => typeof row[column] === 'string' && row[column] <= value;
      }
      throw new Error(`Unsupported fake OR clause: ${clause}`);
    });
    this.filters.push((row) => clauses.some((clause) => clause(row)));
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

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const rows = this.source.filter((row) => this.filters.every((filter) => filter(row)));
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

function authFor(
  userId: string,
  tables: Partial<Record<TableName, StoredRow[]>>,
): AuthenticatedMcpContext {
  const supabase = {
    from: (table: TableName) => new FakeQuery(tables[table] ?? []),
  };
  return { userId, email: null, supabase: supabase as unknown as AuthenticatedMcpContext['supabase'] };
}

const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const areaId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const todoId = '50000000-0000-4000-8000-000000000001';
const checklistId = '60000000-0000-4000-8000-000000000001';

function metadata(ownerId: string, id: string, title: string) {
  return {
    id,
    owner_id: ownerId,
    title,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: id,
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
  };
}

function area(ownerId = ownerA, id = areaId): Tables['tasks_areas']['Row'] {
  return {
    ...metadata(ownerId, id, 'Area'),
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
  };
}

function project(
  overrides: Partial<Tables['tasks_projects']['Row']> = {},
): Tables['tasks_projects']['Row'] {
  return {
    ...metadata(ownerA, projectId, 'Project'),
    area_id: areaId,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: null,
    order_key: 'a0',
    planning_order_key: 'a0',
    start_date: null,
    deadline: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    ...overrides,
  };
}

function todo(
  overrides: Partial<Tables['tasks_todos']['Row']> = {},
): Tables['tasks_todos']['Row'] {
  return {
    ...metadata(ownerA, todoId, 'To-do'),
    area_id: null,
    project_id: projectId,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: null,
    order_key: 'a0',
    hierarchy_order_key: 'a0',
    start_date: null,
    deadline: null,
    actionability: 'actionable',
    undo_source_event_id: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    primary_link: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    ...overrides,
  };
}

function checklistItem(): Tables['tasks_checklist_items']['Row'] {
  return {
    ...metadata(ownerA, checklistId, 'Checklist item'),
    task_id: todoId,
    completed: false,
    completed_at: null,
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
  };
}

function settings(): Tables['tasks_user_settings']['Row'] {
  return {
    id: ownerA,
    owner_id: ownerA,
    planning_timezone: 'America/Los_Angeles',
    revision: 1,
    client_mutation_id: ownerA,
    created_at: '2026-07-20T08:00:00.000Z',
    updated_at: '2026-07-20T08:00:00.000Z',
  };
}

describe('Tasks MCP read tools', () => {
  it('advertises three closed-world read-only tools', () => {
    for (const tool of [getTaskHierarchy, getTaskRecord, getTaskView]) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
    expect([getTaskHierarchy.name, getTaskRecord.name, getTaskView.name]).toEqual([
      'get_task_hierarchy',
      'get_task_record',
      'get_task_view',
    ]);
  });

  it('reads one owner-scoped record and omits the owner identifier', async () => {
    const auth = authFor(ownerA, {
      tasks_todos: [todo(), todo({ id: '50000000-0000-4000-8000-000000000002', owner_id: ownerB })],
    });
    const result = await getTaskRecordData({ record_type: 'todo', id: todoId }, auth);
    expect(result.record).toMatchObject({ id: todoId, title: 'To-do' });
    expect(result.record).not.toHaveProperty('owner_id');
    await expect(getTaskRecordData({
      record_type: 'todo',
      id: '50000000-0000-4000-8000-000000000002',
    }, auth)).rejects.toThrow('Task todo not found.');
  });

  it('returns a project-scoped normalized hierarchy without unrelated records', async () => {
    const unrelatedProjectId = '30000000-0000-4000-8000-000000000002';
    const result = await getTaskHierarchyData({
      root_type: 'project',
      root_id: projectId,
      include_terminal: false,
      limit: 50,
    }, authFor(ownerA, {
      tasks_areas: [area(), area(ownerB, '20000000-0000-4000-8000-000000000002')],
      tasks_projects: [project(), project({ id: unrelatedProjectId, area_id: null })],
      tasks_todos: [todo(), todo({ id: '50000000-0000-4000-8000-000000000003', project_id: unrelatedProjectId })],
      tasks_checklist_items: [checklistItem()],
    }));

    expect(result.collections.projects.map(({ id }) => id)).toEqual([projectId]);
    expect(result.collections.todos.map(({ id }) => id)).toEqual([todoId]);
    expect(result.collections.checklist_items.map(({ id }) => id)).toEqual([checklistId]);
    expect(result.collections.todos[0]).not.toHaveProperty('owner_id');
  });

  it('does not expose descendants of terminal projects in the open hierarchy', async () => {
    const terminalProjectId = '30000000-0000-4000-8000-000000000010';
    const terminalTodoId = '50000000-0000-4000-8000-000000000010';
    const terminalChecklistId = '60000000-0000-4000-8000-000000000010';
    const result = await getTaskHierarchyData({
      root_type: 'all',
      include_terminal: false,
      limit: 50,
    }, authFor(ownerA, {
      tasks_areas: [area()],
      tasks_projects: [project(), project({ id: terminalProjectId, lifecycle: 'completed' })],
      tasks_todos: [
        todo(),
        todo({
          id: terminalTodoId,
          project_id: terminalProjectId,
        }),
      ],
      tasks_checklist_items: [
        checklistItem(),
        { ...checklistItem(), id: terminalChecklistId, task_id: terminalTodoId },
      ],
    }));

    expect(result.collections.projects.map(({ id }) => id)).toEqual([projectId]);
    expect(result.collections.todos.map(({ id }) => id)).toEqual([todoId]);
    expect(result.collections.checklist_items.map(({ id }) => id)).toEqual([checklistId]);
  });

  it('derives and orders Today sections while excluding future and other-owner work', async () => {
    const inboxId = '50000000-0000-4000-8000-000000000009';
    const nowId = '50000000-0000-4000-8000-000000000010';
    const nextId = '50000000-0000-4000-8000-000000000011';
    const laterId = '50000000-0000-4000-8000-000000000012';
    const futureId = '50000000-0000-4000-8000-000000000013';
    const result = await getTaskViewData({
      view: 'today',
      planning_date: '2026-07-20',
      limit: 50,
    }, authFor(ownerA, {
      tasks_user_settings: [settings()],
      tasks_todos: [
        todo({ id: inboxId, destination: 'anytime', today_section: 'inbox', start_date: '2026-07-20', order_key: 'a3' }),
        todo({ id: nowId, destination: 'anytime', today_section: 'now', start_date: '2026-07-19', order_key: 'a2' }),
        todo({ id: nextId, destination: 'anytime', today_section: 'next', start_date: '2026-07-20', order_key: 'a1' }),
        todo({ id: laterId, destination: 'anytime', today_section: 'later', start_date: '2026-07-20', order_key: 'a0' }),
        todo({ id: futureId, destination: 'anytime', today_section: 'now', start_date: '2026-07-21' }),
        todo({ id: '50000000-0000-4000-8000-000000000014', owner_id: ownerB, destination: 'anytime', today_section: 'next', start_date: '2026-07-20' }),
      ],
      tasks_projects: [],
    }));

    if (!('todos' in result)) throw new Error('Expected a planning view result.');
    expect(result.todos.map(({ id }) => id)).toEqual([inboxId, nowId, nextId, laterId]);
    expect(result.todos.map((row) => row.derived_section)).toEqual([
      'inbox', 'now', 'next', 'later',
    ]);
    expect(result.todos.every((row) => !('owner_id' in row))).toBe(true);
  });

  it('does not let undated rows consume a bounded dated section', async () => {
    const dueTodoId = '50000000-0000-4000-8000-000000000019';
    const dueProjectId = '30000000-0000-4000-8000-000000000019';
    const result = await getTaskViewData({
      view: 'today',
      planning_date: '2026-07-20',
      limit: 1,
    }, authFor(ownerA, {
      tasks_user_settings: [settings()],
      tasks_todos: [
        todo({ id: '50000000-0000-4000-8000-000000000017', project_id: null, order_key: 'a0' }),
        todo({ id: '50000000-0000-4000-8000-000000000018', project_id: null, order_key: 'a1' }),
        todo({ id: dueTodoId, project_id: null, start_date: '2026-07-20', today_section: 'next', order_key: 'z0' }),
      ],
      tasks_projects: [
        project({ id: '30000000-0000-4000-8000-000000000017', planning_order_key: 'a0' }),
        project({ id: '30000000-0000-4000-8000-000000000018', planning_order_key: 'a1' }),
        project({ id: dueProjectId, start_date: '2026-07-20', today_section: 'next', planning_order_key: 'z0' }),
      ],
    }));

    if (!('todos' in result)) throw new Error('Expected a planning view result.');
    expect(result.todos.map(({ id }) => id)).toEqual([dueTodoId]);
    expect(result.projects.map(({ id }) => id)).toEqual([dueProjectId]);
    expect(result.todos[0].derived_section).toBe('next');
    expect(result.projects[0].derived_section).toBe('next');
  });

  it('returns independent deleted roots in Done with deterministic planning context', async () => {
    const deletedRoot = todo({
      id: '50000000-0000-4000-8000-000000000020',
      disposition: 'deleted',
      deleted_at: '2026-07-20T09:00:00.000Z',
      deletion_root_id: '50000000-0000-4000-8000-000000000020',
    });
    const deletedChild = checklistItem();
    deletedChild.disposition = 'deleted';
    deletedChild.deleted_at = '2026-07-20T09:00:00.000Z';
    deletedChild.deletion_root_id = deletedRoot.id;
    const result = await getTaskViewData({
      view: 'done',
      planning_date: '2026-07-20',
      limit: 50,
    }, authFor(ownerA, {
      tasks_user_settings: [settings()],
      tasks_areas: [],
      tasks_projects: [],
      tasks_todos: [deletedRoot],
      tasks_checklist_items: [deletedChild],
    }));

    expect(result.planning_date).toBe('2026-07-20');
    if (!('roots' in result)) throw new Error('Expected a Done view result.');
    expect(result.roots).toHaveLength(1);
    expect(result.roots[0]).toMatchObject({ root_type: 'todo', record: { id: deletedRoot.id } });
  });

  it('converts an instant to the owner-local calendar date', () => {
    const instant = new Date('2026-07-20T06:30:00.000Z');
    expect(planningDateInTimeZone('America/Los_Angeles', instant)).toBe('2026-07-19');
    expect(planningDateInTimeZone('Asia/Tokyo', instant)).toBe('2026-07-20');
  });
});

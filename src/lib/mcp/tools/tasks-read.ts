import type { Database } from '@/integrations/supabase/types';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

const taskRecordTypeSchema = z.enum([
  'area',
  'todo',
  'checklist_item',
]);
const taskHierarchyRootTypeSchema = z.enum([
  'all',
  'area',
  'todo',
]);
const taskViewSchema = z.enum([
  'today',
  'upcoming',
  'anytime',
  'someday',
  'done',
]);
const planningDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type TaskRecordType = z.infer<typeof taskRecordTypeSchema>;
type TaskHierarchyRootType = z.infer<typeof taskHierarchyRootTypeSchema>;
type TaskView = z.infer<typeof taskViewSchema>;
type TaskTables = Database['public']['Tables'];
type TaskAreaRow = TaskTables['tasks_areas']['Row'];
type TaskTodoRow = TaskTables['tasks_todos']['Row'];
type TaskChecklistItemRow = TaskTables['tasks_checklist_items']['Row'];
type TaskUserSettingsRow = TaskTables['tasks_user_settings']['Row'];
type TaskHierarchyRows = {
  areas: TaskAreaRow[];
  todos: TaskTodoRow[];
  checklist_items: TaskChecklistItemRow[];
};
type BoundedRows<T> = { rows: T[]; truncated: boolean };
type TaskPlannableRow = TaskTodoRow;

const defaultLimit = 250;

function emptyHierarchyRows(): TaskHierarchyRows {
  return { areas: [], todos: [], checklist_items: [] };
}

async function readMany<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  limit: number,
): Promise<BoundedRows<T>> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

async function getOwnedTaskRecord(
  auth: AuthenticatedMcpContext,
  recordType: TaskRecordType,
  id: string,
): Promise<TaskAreaRow | TaskTodoRow | TaskChecklistItemRow | null> {
  if (recordType === 'area') {
    return readOne(auth.supabase.from('tasks_areas').select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  if (recordType === 'todo') {
    return readOne(auth.supabase.from('tasks_todos').select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  return readOne(auth.supabase.from('tasks_checklist_items').select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
}

export async function getTaskRecordData(
  input: { record_type: TaskRecordType; id: string },
  auth: AuthenticatedMcpContext,
) {
  const record = await getOwnedTaskRecord(auth, input.record_type, input.id);
  if (record === null) throw new Error(`Task ${input.record_type.replace('_', ' ')} not found.`);
  return { record_type: input.record_type, record: stripOwner(record) };
}

async function loadAllHierarchy(
  auth: AuthenticatedMcpContext,
  includeTerminal: boolean,
  limit: number,
) {
  let todosQuery = auth.supabase
    .from('tasks_todos')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('disposition', 'present');
  if (!includeTerminal) {
    todosQuery = todosQuery.eq('lifecycle', 'open');
  }

  const [areas, todos, checklistItems] = await Promise.all([
    readMany<TaskAreaRow>(auth.supabase.from('tasks_areas').select('*').eq('owner_id', auth.userId).eq('disposition', 'present').order('order_key').order('id').limit(limit + 1), limit),
    readMany<TaskTodoRow>(todosQuery.order('area_id').order('hierarchy_order_key').order('id').limit(limit + 1), limit),
    readMany<TaskChecklistItemRow>(auth.supabase.from('tasks_checklist_items').select('*').eq('owner_id', auth.userId).eq('disposition', 'present').order('task_id').order('order_key').order('id').limit(limit + 1), limit),
  ]);
  const visibleTodoIds = new Set(todos.rows.map(({ id }) => id));

  return {
    rows: {
      areas: areas.rows,
      todos: todos.rows,
      checklist_items: checklistItems.rows.filter(({ task_id }) => visibleTodoIds.has(task_id)),
    },
    truncatedCollections: [
      areas.truncated && 'areas',
      todos.truncated && 'todos',
      checklistItems.truncated && 'checklist_items',
    ].filter((name): name is string => Boolean(name)),
  };
}

function scopeHierarchyRows(
  rows: TaskHierarchyRows,
  rootType: TaskHierarchyRootType,
  rootId?: string,
): TaskHierarchyRows {
  if (rootType === 'all') return rows;
  if (!rootId) throw new Error(`${rootType} hierarchy requires root_id.`);

  const result = emptyHierarchyRows();
  if (rootType === 'area') {
    const area = rows.areas.find(({ id }) => id === rootId);
    if (!area) throw new Error('Task area not found within the bounded hierarchy result.');
    result.areas = [area];
    result.todos = rows.todos.filter(({ area_id }) => area_id === rootId);
  } else {
    const todo = rows.todos.find(({ id }) => id === rootId);
    if (!todo) throw new Error('Task to-do not found within the bounded hierarchy result.');
    result.todos = [todo];
    result.areas = rows.areas.filter(({ id }) => id === todo.area_id);
  }

  const todoIds = new Set(result.todos.map(({ id }) => id));
  result.checklist_items = rows.checklist_items.filter(({ task_id }) => todoIds.has(task_id));
  return result;
}

export async function getTaskHierarchyData(
  input: {
    root_type: TaskHierarchyRootType;
    root_id?: string;
    include_terminal: boolean;
    limit: number;
  },
  auth: AuthenticatedMcpContext,
) {
  if (input.root_type !== 'all' && !input.root_id) {
    throw new Error(`${input.root_type} hierarchy requires root_id.`);
  }
  const loaded = await loadAllHierarchy(auth, input.include_terminal, input.limit);
  const scoped = scopeHierarchyRows(loaded.rows, input.root_type, input.root_id);
  return {
    scope: { root_type: input.root_type, root_id: input.root_id ?? null },
    include_terminal: input.include_terminal,
    limit_per_collection: input.limit,
    truncated_collections: loaded.truncatedCollections,
    collections: {
      areas: scoped.areas.map(stripOwner),
      todos: scoped.todos.map(stripOwner),
      checklist_items: scoped.checklist_items.map(stripOwner),
    },
  };
}

async function getPlanningContext(
  auth: AuthenticatedMcpContext,
  requestedDate?: string,
) {
  const settings = await readOne<TaskUserSettingsRow>(auth.supabase
    .from('tasks_user_settings')
    .select('*')
    .eq('owner_id', auth.userId)
    .maybeSingle());
  if (requestedDate) {
    return {
      planning_date: requestedDate,
      planning_timezone: settings?.planning_timezone ?? null,
      date_source: 'requested' as const,
    };
  }
  if (!settings) {
    throw new Error('Task planning settings are not initialized. Open the Tasks module once or provide planning_date.');
  }
  return {
    planning_date: planningDateInTimeZone(settings.planning_timezone),
    planning_timezone: settings.planning_timezone,
    date_source: 'owner_timezone' as const,
  };
}

export function planningDateInTimeZone(timeZone: string, instant = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function visibleInTaskView(row: TaskPlannableRow, view: TaskView, planningDate: string) {
  if (view === 'done') return row.disposition === 'present' && row.lifecycle !== 'open';
  if (row.disposition !== 'present' || row.lifecycle !== 'open') return false;
  if (view === 'upcoming') {
    return row.destination === 'anytime'
      && row.start_date !== null
      && row.start_date > planningDate;
  }
  if (view === 'today') {
    return row.destination === 'anytime'
      && row.today_section !== null
      && (row.start_date === null || row.start_date <= planningDate);
  }
  return row.destination === view
    && (view !== 'anytime'
      || row.start_date === null
      || row.start_date <= planningDate);
}

function todaySection(row: TaskPlannableRow, _planningDate: string) {
  return row.today_section;
}

function comparePlanningRows(
  left: TaskPlannableRow,
  right: TaskPlannableRow,
  view: TaskView,
  planningDate: string,
) {
  if (view === 'done') {
    return (right.deleted_at ?? right.completed_at ?? right.canceled_at ?? '').localeCompare(
      left.deleted_at ?? left.completed_at ?? left.canceled_at ?? '',
    ) || left.id.localeCompare(right.id);
  }
  if (view === 'upcoming') {
    return (left.start_date ?? '').localeCompare(right.start_date ?? '')
      || planningOrder(left).localeCompare(planningOrder(right))
      || left.id.localeCompare(right.id);
  }
  if (view === 'today') {
    const ranks = { inbox: 0, now: 1, next: 2, later: 3 } as const;
    return ranks[todaySection(left, planningDate) as keyof typeof ranks]
      - ranks[todaySection(right, planningDate) as keyof typeof ranks]
      || planningOrder(left).localeCompare(planningOrder(right))
      || left.id.localeCompare(right.id);
  }
  return planningOrder(left).localeCompare(planningOrder(right))
    || left.id.localeCompare(right.id);
}

function planningOrder(row: TaskPlannableRow) {
  return row.order_key;
}

async function loadPlanningRows(
  auth: AuthenticatedMcpContext,
  view: TaskView,
  planningDate: string,
  limit: number,
) {
  const todos = await loadTodoPlanningRows(auth, view, planningDate, limit);
  return {
    todos: todos.rows,
    truncatedCollections: [
      todos.truncated && 'todos',
    ].filter((name): name is string => Boolean(name)),
  };
}

async function loadTodoPlanningRows(
  auth: AuthenticatedMcpContext,
  view: TaskView,
  planningDate: string,
  limit: number,
): Promise<BoundedRows<TaskTodoRow>> {
  const base = () => auth.supabase.from('tasks_todos').select('*').eq('owner_id', auth.userId);
  if (view === 'today') {
    const todayBase = () => base()
      .eq('destination', 'anytime')
      .eq('lifecycle', 'open')
      .eq('disposition', 'present')
      .or(`start_date.is.null,start_date.lte.${planningDate}`);
    const segments = await Promise.all([
      readMany<TaskTodoRow>(todayBase().eq('today_section', 'inbox').order('order_key').order('id').limit(limit + 1), limit),
      readMany<TaskTodoRow>(todayBase().eq('today_section', 'now').order('order_key').order('id').limit(limit + 1), limit),
      readMany<TaskTodoRow>(todayBase().eq('today_section', 'next').order('order_key').order('id').limit(limit + 1), limit),
      readMany<TaskTodoRow>(todayBase().eq('today_section', 'later').order('order_key').order('id').limit(limit + 1), limit),
    ]);
    return mergePlanningSegments(segments, view, planningDate, limit);
  }

  let query = base();
  if (view === 'done') {
    query = query.eq('disposition', 'present').in('lifecycle', ['completed', 'canceled'])
      .order('updated_at', { ascending: false }).order('id');
  } else {
    query = query.eq('lifecycle', 'open').eq('disposition', 'present');
    if (view === 'upcoming') {
      query = query.eq('destination', 'anytime').gt('start_date', planningDate)
        .order('start_date').order('order_key').order('id');
    } else {
      query = query.eq('destination', view);
      if (view === 'anytime') query = query.or(`start_date.is.null,start_date.lte.${planningDate}`);
      query = query.order('order_key').order('id');
    }
  }
  return readMany<TaskTodoRow>(query.limit(limit + 1), limit);
}

function mergePlanningSegments<T extends TaskPlannableRow>(
  segments: BoundedRows<T>[],
  view: TaskView,
  planningDate: string,
  limit: number,
): BoundedRows<T> {
  const unique = new Map<string, T>();
  for (const segment of segments) {
    for (const row of segment.rows) unique.set(row.id, row);
  }
  const rows = Array.from(unique.values())
    .filter((row) => visibleInTaskView(row, view, planningDate))
    .sort((left, right) => comparePlanningRows(left, right, view, planningDate));
  return {
    rows: rows.slice(0, limit),
    truncated: rows.length > limit || segments.some((segment) => segment.truncated),
  };
}

async function loadDoneRoots(auth: AuthenticatedMcpContext, limit: number) {
  const [areas, todos, checklistItems] = await Promise.all([
    readMany<TaskAreaRow>(auth.supabase.from('tasks_areas').select('*').eq('owner_id', auth.userId).eq('disposition', 'deleted').order('deleted_at', { ascending: false }).limit(limit + 1), limit),
    readMany<TaskTodoRow>(auth.supabase.from('tasks_todos').select('*').eq('owner_id', auth.userId).eq('disposition', 'deleted').order('deleted_at', { ascending: false }).limit(limit + 1), limit),
    readMany<TaskChecklistItemRow>(auth.supabase.from('tasks_checklist_items').select('*').eq('owner_id', auth.userId).eq('disposition', 'deleted').order('deleted_at', { ascending: false }).limit(limit + 1), limit),
  ]);
  const roots = [
    ...areas.rows.filter(({ id, deletion_root_id }) => deletion_root_id === id)
      .map((record) => ({ root_type: 'area' as const, record })),
    ...todos.rows.filter(({ id, deletion_root_id }) => deletion_root_id === id)
      .map((record) => ({ root_type: 'todo' as const, record })),
    ...checklistItems.rows.filter(({ id, deletion_root_id }) => deletion_root_id === id)
      .map((record) => ({ root_type: 'checklist_item' as const, record })),
  ].sort((left, right) => (
    (right.record.deleted_at ?? '').localeCompare(left.record.deleted_at ?? '')
      || left.record.id.localeCompare(right.record.id)
  ));
  return {
    roots: roots.slice(0, limit).map(({ root_type, record }) => ({
      root_type,
      record: stripOwner(record),
    })),
    truncated: roots.length > limit || [areas, todos, checklistItems]
      .some((collection) => collection.truncated),
  };
}

export async function getTaskViewData(
  input: { view: TaskView; planning_date?: string; limit: number },
  auth: AuthenticatedMcpContext,
) {
  const planning = await getPlanningContext(auth, input.planning_date);
  const loaded = await loadPlanningRows(auth, input.view, planning.planning_date, input.limit);
  const done = input.view === 'done' ? await loadDoneRoots(auth, input.limit) : null;
  return {
    view: input.view,
    ...planning,
    limit_per_collection: input.limit,
    truncated_collections: loaded.truncatedCollections,
    ...(done === null ? {} : { roots: done.roots, roots_truncated: done.truncated }),
    todos: loaded.todos.map((record) => ({
      ...stripOwner(record),
      ...(input.view === 'today' ? { derived_section: todaySection(record, planning.planning_date) } : {}),
    })),
  };
}

export const getTaskHierarchy = defineTool({
  name: 'get_task_hierarchy',
  title: 'Get Task Hierarchy',
  description: 'Read the signed-in user\'s normalized task Areas, tasks, and checklist items. Returns stable ids and relationship fields without mutating data.',
  inputSchema: {
    root_type: taskHierarchyRootTypeSchema.default('all').describe('Read the complete bounded hierarchy or scope it to one Area or task.'),
    root_id: uuidSchema.optional().describe('Required when root_type is not all.'),
    include_terminal: z.boolean().default(false).describe('Include completed and canceled tasks.'),
    limit: z.number().int().min(1).max(500).default(defaultLimit).describe('Maximum rows returned per hierarchy collection.'),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getTaskHierarchyData(input, requireAuthenticated(ctx))),
});

export const getTaskRecord = defineTool({
  name: 'get_task_record',
  title: 'Get Task Record',
  description: 'Read one task Area, task, or checklist item by stable id for the signed-in user.',
  inputSchema: {
    record_type: taskRecordTypeSchema,
    id: uuidSchema.describe('Stable record id.'),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getTaskRecordData(input, requireAuthenticated(ctx))),
});

export const getTaskView = defineTool({
  name: 'get_task_view',
  title: 'Get Task Planning View',
  description: 'Read the signed-in user\'s Today, Upcoming, Anytime, Someday, or Done view using the Tasks domain rules.',
  inputSchema: {
    view: taskViewSchema,
    planning_date: planningDateSchema.optional().describe('Optional ISO calendar date for deterministic planning review. Defaults to today in the owner\'s stored planning time zone.'),
    limit: z.number().int().min(1).max(500).default(defaultLimit).describe('Maximum tasks or Done roots returned.'),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getTaskViewData(input, requireAuthenticated(ctx))),
});

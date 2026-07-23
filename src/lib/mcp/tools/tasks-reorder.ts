import type { Database, Json } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '../../../modules/tasks/domain/taskDates';
import {
  compareTaskOrder,
  generateTaskMoveOrderKey,
  type OrderedTask,
} from '../../../modules/tasks/domain/taskOrder';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

const directionSchema = z.enum(['up', 'down']);
const taskScopeSchema = z.enum(['planning', 'hierarchy']);
const hierarchyScopeSchema = z.enum(['structural', 'planning']);
const taskPlanningViewSchema = z.enum(['today', 'upcoming', 'anytime', 'someday']);
const projectPlanningViewSchema = z.enum(['today', 'upcoming', 'anytime', 'someday']);
const hierarchyTypeSchema = z.enum(['area', 'project', 'checklist_item']);
const calendarDateSchema = z.string().refine(isTaskCalendarDate, {
  message: 'Use an ISO calendar date in YYYY-MM-DD format.',
});

type Tables = Database['public']['Tables'];
type TaskTodoRow = Tables['tasks_todos']['Row'];
type TaskAreaRow = Tables['tasks_areas']['Row'];
type TaskProjectRow = Tables['tasks_projects']['Row'];
type TaskChecklistRow = Tables['tasks_checklist_items']['Row'];
type TaskHistoryRow = Tables['tasks_history_events']['Row'];
type HierarchyHistoryRow = Tables['tasks_hierarchy_history_events']['Row'];
type HierarchyOperationRow = Tables['tasks_hierarchy_operations']['Row'];
type HierarchyType = z.infer<typeof hierarchyTypeSchema>;
type Direction = z.infer<typeof directionSchema>;
type TaskPlanningView = z.infer<typeof taskPlanningViewSchema>;
type ProjectPlanningView = z.infer<typeof projectPlanningViewSchema>;
type HierarchyRow = TaskAreaRow | TaskProjectRow | TaskChecklistRow;
type Snapshot = Record<string, Json | undefined>;

type MutationBase = {
  expected_revision: number;
  client_mutation_id: string;
  direction: Direction;
};

export type ReorderTaskRequest = MutationBase & {
  task_id: string;
  scope: 'planning' | 'hierarchy';
  view?: TaskPlanningView;
  planning_date?: string;
};

export type ReorderTaskHierarchyRequest = MutationBase & {
  record_type: HierarchyType;
  record_id: string;
  scope?: 'structural' | 'planning';
  view?: ProjectPlanningView;
  planning_date?: string;
};

type MutationReceipt = {
  client_mutation_id: string;
  actor_type: string;
  mutation_channel: string;
  affected_ids: string[];
  base_revision: number;
  result_revision: number;
  transition: string;
  occurred_at: string;
  outcome: 'accepted' | 'noop' | 'conflict';
  code: string | null;
};

const PAGE_SIZE = 500;
const MAX_PEERS = 100_000;

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

function jsonRecord(value: Json | null): Snapshot {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The reorder history receipt is invalid.');
  }
  return value;
}

function jsonEqual(left: Json | undefined, right: Json | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    const failure = new Error(error.message) as Error & { code?: string };
    failure.code = error.code;
    throw failure;
  }
  return data;
}

async function readAll<T>(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    if (rows.length === MAX_PEERS) {
      const probe = await loadPage(MAX_PEERS, MAX_PEERS);
      if (probe.error) throw new Error(probe.error.message);
      if ((probe.data ?? []).length === 0) return rows;
      throw new Error(`The reorder peer collection exceeds the ${MAX_PEERS}-record safety limit.`);
    }
  }
}

async function readTask(auth: AuthenticatedMcpContext, id: string): Promise<TaskTodoRow | null> {
  return readOne<TaskTodoRow>(auth.supabase.from('tasks_todos').select('*')
    .eq('owner_id', auth.userId).eq('id', id).maybeSingle());
}

async function readHierarchyRecord(
  auth: AuthenticatedMcpContext,
  type: HierarchyType,
  id: string,
): Promise<HierarchyRow | null> {
  if (type === 'area') {
    return readOne<TaskAreaRow>(auth.supabase.from('tasks_areas').select('*')
      .eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  if (type === 'project') {
    return readOne<TaskProjectRow>(auth.supabase.from('tasks_projects').select('*')
      .eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  return readOne<TaskChecklistRow>(auth.supabase.from('tasks_checklist_items').select('*')
    .eq('owner_id', auth.userId).eq('id', id).maybeSingle());
}

async function readTaskHistory(auth: AuthenticatedMcpContext, mutationId: string) {
  return readOne<TaskHistoryRow>(auth.supabase.from('tasks_history_events').select('*')
    .eq('owner_id', auth.userId).eq('client_mutation_id', mutationId).maybeSingle());
}

async function readHierarchyHistory(auth: AuthenticatedMcpContext, mutationId: string) {
  return readOne<HierarchyHistoryRow>(auth.supabase
    .from('tasks_hierarchy_history_events').select('*')
    .eq('owner_id', auth.userId).eq('client_mutation_id', mutationId).maybeSingle());
}

async function readHierarchyOperation(auth: AuthenticatedMcpContext, mutationId: string) {
  return readOne<HierarchyOperationRow>(auth.supabase.from('tasks_hierarchy_operations')
    .select('*').eq('owner_id', auth.userId).eq('id', mutationId).maybeSingle());
}

function historyReceipt(event: TaskHistoryRow | HierarchyHistoryRow): MutationReceipt {
  return {
    client_mutation_id: event.client_mutation_id,
    actor_type: event.actor_type,
    mutation_channel: event.mutation_channel,
    affected_ids: event.affected_ids,
    base_revision: event.base_revision,
    result_revision: event.result_revision,
    transition: event.transition,
    occurred_at: event.occurred_at,
    outcome: 'accepted',
    code: null,
  };
}

function ephemeralReceipt(
  input: MutationBase,
  id: string,
  revision: number,
  outcome: 'noop' | 'conflict',
  code: 'collection_boundary' | 'revision_conflict',
): MutationReceipt {
  return {
    client_mutation_id: input.client_mutation_id,
    actor_type: 'automation',
    mutation_channel: 'mcp',
    affected_ids: [id],
    base_revision: input.expected_revision,
    result_revision: revision,
    transition: 'reorder',
    occurred_at: new Date().toISOString(),
    outcome,
    code,
  };
}

function taskResult(
  mutationOutcome: 'applied' | 'already_applied' | 'noop' | 'conflict',
  receipt: MutationReceipt,
  task: TaskTodoRow,
) {
  return {
    mutation_outcome: mutationOutcome,
    receipt,
    task: stripOwner(task),
  };
}

function hierarchyResult(
  mutationOutcome: 'applied' | 'already_applied' | 'noop' | 'conflict',
  receipt: MutationReceipt,
  type: HierarchyType,
  record: HierarchyRow,
) {
  return {
    mutation_outcome: mutationOutcome,
    receipt,
    record_type: type,
    record: stripOwner(record),
  };
}

function assertOpenPresent(record: { disposition: string; lifecycle?: string }): void {
  if (record.disposition !== 'present') throw new Error('Only present task records can be reordered.');
  if (record.lifecycle !== undefined && record.lifecycle !== 'open') {
    throw new Error('Only open task records can be reordered.');
  }
}

function orderSection(
  record: Snapshot | TaskTodoRow | TaskProjectRow,
  view: TaskPlanningView | ProjectPlanningView,
  planningDate: string,
): string {
  if (view === 'today') {
    return String(record.today_section);
  }
  if (view === 'upcoming') return `upcoming:${String(record.start_date ?? '')}`;
  return view;
}

function visibleInPlanning(
  record: Snapshot | TaskTodoRow | TaskProjectRow,
  view: TaskPlanningView | ProjectPlanningView,
  planningDate: string,
): boolean {
  if (record.disposition !== 'present' || record.lifecycle !== 'open') return false;
  if (view === 'upcoming') {
    return record.destination === 'anytime'
      && typeof record.start_date === 'string'
      && record.start_date > planningDate;
  }
  if (view === 'today') {
    return record.destination === 'anytime'
      && typeof record.start_date === 'string'
      && record.today_section !== null
      && record.start_date <= planningDate;
  }
  return record.destination === view
    && (view !== 'anytime'
      || record.start_date === null
      || (typeof record.start_date === 'string' && record.start_date <= planningDate));
}

function requireTaskPlanning(input: ReorderTaskRequest) {
  if (!input.view || !input.planning_date) {
    throw new Error('Planning reorder requires a view and explicit planning date.');
  }
  return { view: input.view, planningDate: input.planning_date };
}

function requireProjectPlanning(input: ReorderTaskHierarchyRequest) {
  if (input.record_type !== 'project' || !input.view || !input.planning_date) {
    throw new Error('Project planning reorder requires a project, view, and explicit planning date.');
  }
  return { view: input.view, planningDate: input.planning_date };
}

function assertOnlyOrderChanged(
  before: Snapshot,
  after: Snapshot,
  orderKey: 'order_key' | 'hierarchy_order_key' | 'planning_order_key',
  direction: Direction,
): void {
  const mutationMetadata = new Set([
    'revision',
    'client_mutation_id',
    'last_actor_type',
    'last_mutation_channel',
    'updated_at',
  ]);
  const beforeKey = before[orderKey];
  const afterKey = after[orderKey];
  if (typeof beforeKey !== 'string' || typeof afterKey !== 'string'
    || (direction === 'up' ? afterKey >= beforeKey : afterKey <= beforeKey)) {
    throw new Error('The mutation identifier was already used with a different reorder direction.');
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (key !== orderKey && !mutationMetadata.has(key) && !jsonEqual(before[key], after[key])) {
      throw new Error('The mutation identifier was already used for a different record change.');
    }
  }
}

function targetIndex(rows: readonly OrderedTask[], id: string, direction: Direction): number | null {
  const ordered = [...rows].sort(compareTaskOrder);
  const index = ordered.findIndex((row) => row.id === id);
  const destination = index + (direction === 'up' ? -1 : 1);
  return index < 0 || destination < 0 || destination >= ordered.length ? null : destination;
}

async function taskPeers(
  input: ReorderTaskRequest,
  current: TaskTodoRow,
  auth: AuthenticatedMcpContext,
): Promise<OrderedTask[]> {
  const rows = await readAll<TaskTodoRow>((from, to) => auth.supabase
    .from('tasks_todos').select('*')
    .eq('owner_id', auth.userId).eq('disposition', 'present').eq('lifecycle', 'open')
    .order(input.scope === 'planning' ? 'order_key' : 'hierarchy_order_key')
    .order('id').range(from, to));
  if (input.scope === 'planning') {
    const { view, planningDate } = requireTaskPlanning(input);
    if (!visibleInPlanning(current, view, planningDate)) {
      throw new Error('The to-do is not in the requested planning view.');
    }
    const section = orderSection(current, view, planningDate);
    return rows.filter((row) => visibleInPlanning(row, view, planningDate)
      && orderSection(row, view, planningDate) === section)
      .map((row) => ({ id: row.id, orderKey: row.order_key }));
  }
  return rows.filter((row) => row.area_id === current.area_id
      && row.project_id === current.project_id
      && row.hierarchy_order_key !== null)
    .map((row) => ({ id: row.id, orderKey: row.hierarchy_order_key as string }));
}

async function hierarchyPeers(
  input: ReorderTaskHierarchyRequest,
  current: HierarchyRow,
  auth: AuthenticatedMcpContext,
): Promise<OrderedTask[]> {
  const scope = input.scope ?? 'structural';
  if (scope === 'planning') {
    const project = current as TaskProjectRow;
    const { view, planningDate } = requireProjectPlanning(input);
    if (!visibleInPlanning(project, view, planningDate)) {
      throw new Error('The project is not in the requested planning view.');
    }
    const section = orderSection(project, view, planningDate);
    const rows = await readAll<TaskProjectRow>((from, to) => auth.supabase
      .from('tasks_projects').select('*')
      .eq('owner_id', auth.userId).eq('disposition', 'present').eq('lifecycle', 'open')
      .order('planning_order_key').order('id').range(from, to));
    return rows.filter((row) => visibleInPlanning(row, view, planningDate)
      && orderSection(row, view, planningDate) === section)
      .map((row) => ({ id: row.id, orderKey: row.planning_order_key }));
  }
  if (input.view || input.planning_date) {
    throw new Error('Structural reorder does not accept a planning view or date.');
  }
  if (input.record_type === 'area') {
    const rows = await readAll<TaskAreaRow>((from, to) => auth.supabase
      .from('tasks_areas').select('*').eq('owner_id', auth.userId).eq('disposition', 'present')
      .order('order_key').order('id').range(from, to));
    return rows.map((row) => ({ id: row.id, orderKey: row.order_key }));
  }
  if (input.record_type === 'project') {
    const project = current as TaskProjectRow;
    const rows = await readAll<TaskProjectRow>((from, to) => auth.supabase
      .from('tasks_projects').select('*')
      .eq('owner_id', auth.userId).eq('disposition', 'present').eq('lifecycle', 'open')
      .order('order_key').order('id').range(from, to));
    return rows.filter((row) => row.area_id === project.area_id)
      .map((row) => ({ id: row.id, orderKey: row.order_key }));
  }
  const item = current as TaskChecklistRow;
  const task = await readTask(auth, item.task_id);
  if (task === null) throw new Error('The checklist parent is unavailable.');
  assertOpenPresent(task);
  const rows = await readAll<TaskChecklistRow>((from, to) => auth.supabase
    .from('tasks_checklist_items').select('*')
    .eq('owner_id', auth.userId).eq('disposition', 'present')
    .order('order_key').order('id').range(from, to));
  return rows.filter((row) => row.task_id === item.task_id)
    .map((row) => ({ id: row.id, orderKey: row.order_key }));
}

function assertTaskRetry(input: ReorderTaskRequest, event: TaskHistoryRow): void {
  if (event.task_id !== input.task_id || event.base_revision !== input.expected_revision
    || event.transition !== 'reorder' || event.actor_type !== 'automation'
    || event.mutation_channel !== 'mcp') {
    throw new Error('The mutation identifier was already used for a different to-do request.');
  }
  const before = jsonRecord(event.before_state);
  const after = jsonRecord(event.after_state);
  const orderKey = input.scope === 'planning' ? 'order_key' : 'hierarchy_order_key';
  assertOnlyOrderChanged(before, after, orderKey, input.direction);
  if (input.scope === 'planning') {
    const { view, planningDate } = requireTaskPlanning(input);
    if (!visibleInPlanning(before, view, planningDate)
      || orderSection(before, view, planningDate) !== orderSection(after, view, planningDate)) {
      throw new Error('The mutation identifier was already used in a different planning scope.');
    }
  } else if (input.view || input.planning_date) {
    throw new Error('Hierarchy reorder does not accept a planning view or date.');
  }
}

function assertHierarchyRetry(
  input: ReorderTaskHierarchyRequest,
  event: HierarchyHistoryRow,
): void {
  if (event.entity_type !== input.record_type || event.entity_id !== input.record_id
    || event.base_revision !== input.expected_revision || event.transition !== 'reorder'
    || event.actor_type !== 'automation' || event.mutation_channel !== 'mcp') {
    throw new Error('The mutation identifier was already used for a different hierarchy request.');
  }
  const before = jsonRecord(event.before_state);
  const after = jsonRecord(event.after_state);
  const scope = input.scope ?? 'structural';
  assertOnlyOrderChanged(
    before,
    after,
    scope === 'planning' ? 'planning_order_key' : 'order_key',
    input.direction,
  );
  if (scope === 'planning') {
    const { view, planningDate } = requireProjectPlanning(input);
    if (!visibleInPlanning(before, view, planningDate)
      || orderSection(before, view, planningDate) !== orderSection(after, view, planningDate)) {
      throw new Error('The mutation identifier was already used in a different planning scope.');
    }
  } else if (input.view || input.planning_date) {
    throw new Error('Structural reorder does not accept a planning view or date.');
  }
}

async function resolveTaskRetry(input: ReorderTaskRequest, auth: AuthenticatedMcpContext) {
  const [event, hierarchyEvent, operation] = await Promise.all([
    readTaskHistory(auth, input.client_mutation_id),
    readHierarchyHistory(auth, input.client_mutation_id),
    readHierarchyOperation(auth, input.client_mutation_id),
  ]);
  if (hierarchyEvent || operation) {
    throw new Error('The mutation identifier was already used by another task operation.');
  }
  if (!event) return null;
  assertTaskRetry(input, event);
  const task = await readTask(auth, input.task_id);
  if (!task) throw new Error('The accepted to-do reorder no longer has a current record.');
  return taskResult('already_applied', historyReceipt(event), task);
}

async function resolveHierarchyRetry(
  input: ReorderTaskHierarchyRequest,
  auth: AuthenticatedMcpContext,
) {
  const [event, taskEvent, operation] = await Promise.all([
    readHierarchyHistory(auth, input.client_mutation_id),
    readTaskHistory(auth, input.client_mutation_id),
    readHierarchyOperation(auth, input.client_mutation_id),
  ]);
  if (taskEvent || operation) {
    throw new Error('The mutation identifier was already used by another task operation.');
  }
  if (!event) return null;
  assertHierarchyRetry(input, event);
  const record = await readHierarchyRecord(auth, input.record_type, input.record_id);
  if (!record) throw new Error('The accepted hierarchy reorder no longer has a current record.');
  return hierarchyResult('already_applied', historyReceipt(event), input.record_type, record);
}

async function updateTaskOrder(
  input: ReorderTaskRequest,
  current: TaskTodoRow,
  orderKey: string,
  auth: AuthenticatedMcpContext,
): Promise<TaskTodoRow | null> {
  const patch: Tables['tasks_todos']['Update'] = {
    [input.scope === 'planning' ? 'order_key' : 'hierarchy_order_key']: orderKey,
    revision: current.revision + 1,
    client_mutation_id: input.client_mutation_id,
    last_actor_type: 'automation',
    last_mutation_channel: 'mcp',
    undo_source_event_id: null,
  };
  return readOne<TaskTodoRow>(auth.supabase.from('tasks_todos').update(patch)
    .eq('owner_id', auth.userId).eq('id', input.task_id)
    .eq('revision', input.expected_revision).eq('disposition', 'present').eq('lifecycle', 'open')
    .select('*').maybeSingle());
}

async function updateHierarchyOrder(
  input: ReorderTaskHierarchyRequest,
  current: HierarchyRow,
  orderKey: string,
  auth: AuthenticatedMcpContext,
): Promise<HierarchyRow | null> {
  const scope = input.scope ?? 'structural';
  const patch = {
    [scope === 'planning' ? 'planning_order_key' : 'order_key']: orderKey,
    revision: current.revision + 1,
    client_mutation_id: input.client_mutation_id,
    last_actor_type: 'automation',
    last_mutation_channel: 'mcp',
  };
  if (input.record_type === 'area') {
    return readOne<TaskAreaRow>(auth.supabase.from('tasks_areas').update(patch)
      .eq('owner_id', auth.userId).eq('id', input.record_id)
      .eq('revision', input.expected_revision).eq('disposition', 'present')
      .select('*').maybeSingle());
  }
  if (input.record_type === 'project') {
    return readOne<TaskProjectRow>(auth.supabase.from('tasks_projects').update(patch)
      .eq('owner_id', auth.userId).eq('id', input.record_id)
      .eq('revision', input.expected_revision).eq('disposition', 'present').eq('lifecycle', 'open')
      .select('*').maybeSingle());
  }
  return readOne<TaskChecklistRow>(auth.supabase.from('tasks_checklist_items').update(patch)
    .eq('owner_id', auth.userId).eq('id', input.record_id)
    .eq('revision', input.expected_revision).eq('disposition', 'present')
    .select('*').maybeSingle());
}

export async function reorderTaskData(
  input: ReorderTaskRequest,
  auth: AuthenticatedMcpContext,
) {
  const retry = await resolveTaskRetry(input, auth);
  if (retry) return retry;
  if (input.scope === 'hierarchy' && (input.view || input.planning_date)) {
    throw new Error('Hierarchy reorder does not accept a planning view or date.');
  }
  const current = await readTask(auth, input.task_id);
  if (!current) throw new Error('The to-do is unavailable.');
  assertOpenPresent(current);
  if (current.revision !== input.expected_revision) {
    return taskResult('conflict', ephemeralReceipt(
      input, current.id, current.revision, 'conflict', 'revision_conflict',
    ), current);
  }
  const peers = await taskPeers(input, current, auth);
  const destination = targetIndex(peers, current.id, input.direction);
  if (destination === null) {
    return taskResult('noop', ephemeralReceipt(
      input, current.id, current.revision, 'noop', 'collection_boundary',
    ), current);
  }
  const orderKey = generateTaskMoveOrderKey(peers, current.id, destination);
  try {
    const updated = await updateTaskOrder(input, current, orderKey, auth);
    if (updated) {
      const event = await readTaskHistory(auth, input.client_mutation_id);
      if (!event) throw new Error('The accepted to-do reorder receipt is unavailable.');
      assertTaskRetry(input, event);
      return taskResult('applied', historyReceipt(event), updated);
    }
  } catch (error) {
    const accepted = await resolveTaskRetry(input, auth);
    if (accepted) return accepted;
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
    }
    throw error;
  }
  const latest = await readTask(auth, input.task_id);
  if (!latest) throw new Error('The to-do is unavailable.');
  return taskResult('conflict', ephemeralReceipt(
    input, latest.id, latest.revision, 'conflict', 'revision_conflict',
  ), latest);
}

export async function reorderTaskHierarchyData(
  input: ReorderTaskHierarchyRequest,
  auth: AuthenticatedMcpContext,
) {
  const retry = await resolveHierarchyRetry(input, auth);
  if (retry) return retry;
  const scope = input.scope ?? 'structural';
  if (scope === 'planning' && input.record_type !== 'project') {
    throw new Error('Planning reorder is available only for projects.');
  }
  const current = await readHierarchyRecord(auth, input.record_type, input.record_id);
  if (!current) throw new Error(`The task ${input.record_type.replace('_', ' ')} is unavailable.`);
  assertOpenPresent(current);
  if (current.revision !== input.expected_revision) {
    return hierarchyResult('conflict', ephemeralReceipt(
      input, current.id, current.revision, 'conflict', 'revision_conflict',
    ), input.record_type, current);
  }
  const peers = await hierarchyPeers(input, current, auth);
  const destination = targetIndex(peers, current.id, input.direction);
  if (destination === null) {
    return hierarchyResult('noop', ephemeralReceipt(
      input, current.id, current.revision, 'noop', 'collection_boundary',
    ), input.record_type, current);
  }
  const orderKey = generateTaskMoveOrderKey(peers, current.id, destination);
  try {
    const updated = await updateHierarchyOrder(input, current, orderKey, auth);
    if (updated) {
      const event = await readHierarchyHistory(auth, input.client_mutation_id);
      if (!event) throw new Error('The accepted hierarchy reorder receipt is unavailable.');
      assertHierarchyRetry(input, event);
      return hierarchyResult('applied', historyReceipt(event), input.record_type, updated);
    }
  } catch (error) {
    const accepted = await resolveHierarchyRetry(input, auth);
    if (accepted) return accepted;
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
    }
    throw error;
  }
  const latest = await readHierarchyRecord(auth, input.record_type, input.record_id);
  if (!latest) throw new Error(`The task ${input.record_type.replace('_', ' ')} is unavailable.`);
  return hierarchyResult('conflict', ephemeralReceipt(
    input, latest.id, latest.revision, 'conflict', 'revision_conflict',
  ), input.record_type, latest);
}

const mutationBaseSchema = {
  expected_revision: z.number().int().positive().describe('Current positive record revision.'),
  client_mutation_id: uuidSchema.describe(
    'Stable UUID for this exact logical reorder. Reuse it only for an exact retry.',
  ),
  direction: directionSchema.describe('Move one position up or down within the exact peer scope.'),
};

const mutationAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const reorderTask = defineTool({
  name: 'reorder_task',
  title: 'Reorder Task',
  description: 'Move one open to-do up or down within its planning section or exact hierarchy peers without accepting a raw order key.',
  inputSchema: {
    ...mutationBaseSchema,
    task_id: uuidSchema.describe('Stable to-do identifier.'),
    scope: taskScopeSchema,
    view: taskPlanningViewSchema.optional().describe('Required for planning order and omitted for hierarchy order.'),
    planning_date: calendarDateSchema.optional().describe('Explicit deterministic planning date required for planning order.'),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(reorderTaskData(input, requireAuthenticated(ctx))),
});

export const reorderTaskHierarchy = defineTool({
  name: 'reorder_task_hierarchy',
  title: 'Reorder Task Hierarchy',
  description: 'Move one area, project, or checklist item up or down within its exact structural peers, or reorder a project within one planning section.',
  inputSchema: {
    ...mutationBaseSchema,
    record_type: hierarchyTypeSchema,
    record_id: uuidSchema.describe('Stable hierarchy record identifier.'),
    scope: hierarchyScopeSchema.optional().describe('Defaults to structural. Planning is available only for projects.'),
    view: projectPlanningViewSchema.optional().describe('Required only for project planning order.'),
    planning_date: calendarDateSchema.optional().describe('Explicit deterministic date required only for project planning order.'),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(
    reorderTaskHierarchyData(input, requireAuthenticated(ctx)),
  ),
});

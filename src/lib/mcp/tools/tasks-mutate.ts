import type { Database, Json } from '@/integrations/supabase/types';
import { assertTaskCalendarRange, isTaskCalendarDate } from '../../../modules/tasks/domain/taskDates';
import { generateTaskOrderKey } from '../../../modules/tasks/domain/taskOrder';
import {
  applyTaskStateTransition,
  type TaskStateTransition,
} from '../../../modules/tasks/domain/taskState';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';
import { planningDateInTimeZone } from './tasks-read';

const destinationSchema = z.enum(['anytime', 'someday']);
const todaySectionSchema = z.enum(['none', 'now', 'next', 'later']);
const actionabilitySchema = z.enum(['actionable', 'waiting']);
const sourceKindSchema = z.enum([
  'webpage',
  'mail_message',
  'file',
  'reading_item',
  'other',
]);
const calendarDateSchema = z.string().refine(isTaskCalendarDate, {
  message: 'Expected a valid ISO calendar date.',
});
const sourceSchema = z.object({
  kind: sourceKindSchema,
  url: z.string().max(8_000).optional(),
  title: z.string().max(1_000).optional(),
  external_id: z.string().max(2_000).optional(),
});

type Tables = Database['public']['Tables'];
type TaskTodoRow = Tables['tasks_todos']['Row'];
type TaskHistoryRow = Tables['tasks_history_events']['Row'];
type HierarchyOperationRow = Tables['tasks_hierarchy_operations']['Row'];
type TaskDestination = z.infer<typeof destinationSchema>;
type TaskTodaySection = z.infer<typeof todaySectionSchema>;
type TaskActionability = z.infer<typeof actionabilitySchema>;
type TaskSource = z.infer<typeof sourceSchema>;

type MutationBase = {
  task_id: string;
  expected_revision: number;
  client_mutation_id: string;
};

export type UpdateTaskRequest = MutationBase & {
  title?: string;
  notes?: string;
  actionability?: TaskActionability;
  source?: TaskSource | null;
};

export type MoveTaskRequest = MutationBase & {
  destination?: TaskDestination;
  today_section?: TaskTodaySection;
  start_date?: string | null;
  area_id?: string | null;
  project_id?: string | null;
  heading_id?: string | null;
};

export type ScheduleTaskRequest = MutationBase & {
  start_date?: string | null;
  deadline?: string | null;
};

export type TransitionTaskRequest = MutationBase & {
  transition: TaskStateTransition;
};

type TaskPatch = Tables['tasks_todos']['Update'];
type Snapshot = Record<string, Json | undefined>;
type MutationKind = 'update' | 'move' | 'schedule' | 'transition';
type DirectMutationRequest =
  | { kind: 'update'; input: UpdateTaskRequest }
  | { kind: 'move'; input: MoveTaskRequest }
  | { kind: 'schedule'; input: ScheduleTaskRequest }
  | { kind: 'transition'; input: TransitionTaskRequest };

type MutationReceipt = {
  client_mutation_id: string;
  actor_type: 'automation';
  mutation_channel: 'mcp';
  affected_ids: string[];
  base_revision: number;
  result_revision: number;
  affected_revisions?: Record<string, { base_revision: number; result_revision: number }>;
  transition: string;
  occurred_at: string;
  outcome: 'accepted' | 'noop' | 'rejected' | 'conflict';
  code: string | null;
};

const snapshotKeys = [
  'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at', 'disposition',
  'deleted_at', 'destination', 'today_section', 'order_key', 'start_date', 'deadline',
  'actionability',
  'source_kind', 'source_url', 'source_title', 'source_external_id', 'area_id',
  'project_id', 'heading_id', 'hierarchy_order_key', 'deletion_root_id',
] as const;

function trimRequired(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (Array.from(normalized).length > maxLength) {
    throw new Error(`${label} cannot exceed ${maxLength} characters.`);
  }
  return normalized;
}

function trimOptional(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function withoutOwner(row: TaskTodoRow) {
  const { owner_id: _ownerId, ...task } = row;
  return task;
}

function jsonRecord(value: Json | null): Snapshot {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The accepted task mutation record is invalid.');
  }
  return value;
}

function rowSnapshot(row: TaskTodoRow): Snapshot {
  return Object.fromEntries(snapshotKeys.map((key) => [key, row[key]]));
}

function snapshotsMatch(
  actual: Snapshot,
  expected: Snapshot,
  ignored: ReadonlySet<string> = new Set(),
): boolean {
  return snapshotKeys.every((key) => ignored.has(key) || actual[key] === expected[key]);
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function readMany<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function readTask(
  auth: AuthenticatedMcpContext,
  taskId: string,
): Promise<TaskTodoRow | null> {
  return readOne<TaskTodoRow>(auth.supabase
    .from('tasks_todos')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('id', taskId)
    .maybeSingle());
}

async function requireTask(
  auth: AuthenticatedMcpContext,
  taskId: string,
): Promise<TaskTodoRow> {
  const task = await readTask(auth, taskId);
  if (task === null) throw new Error('The task is unavailable.');
  return task;
}

async function readHistoryByMutation(
  auth: AuthenticatedMcpContext,
  mutationId: string,
): Promise<TaskHistoryRow | null> {
  return readOne<TaskHistoryRow>(auth.supabase
    .from('tasks_history_events')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('client_mutation_id', mutationId)
    .maybeSingle());
}

async function readHierarchyOperation(
  auth: AuthenticatedMcpContext,
  mutationId: string,
): Promise<HierarchyOperationRow | null> {
  return readOne<HierarchyOperationRow>(auth.supabase
    .from('tasks_hierarchy_operations')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('id', mutationId)
    .maybeSingle());
}

function historyReceipt(event: TaskHistoryRow): MutationReceipt {
  return {
    client_mutation_id: event.client_mutation_id,
    actor_type: 'automation',
    mutation_channel: 'mcp',
    affected_ids: event.affected_ids,
    base_revision: event.base_revision,
    result_revision: event.result_revision,
    transition: event.transition,
    occurred_at: event.occurred_at,
    outcome: 'accepted',
    code: event.code,
  };
}

function ephemeralReceipt(
  input: MutationBase,
  transition: string,
  task: TaskTodoRow,
  outcome: 'noop' | 'rejected' | 'conflict',
  code: string,
): MutationReceipt {
  return {
    client_mutation_id: input.client_mutation_id,
    actor_type: 'automation',
    mutation_channel: 'mcp',
    affected_ids: [task.id],
    base_revision: input.expected_revision,
    result_revision: task.revision,
    transition,
    occurred_at: new Date().toISOString(),
    outcome,
    code,
  };
}

function mutationResult(
  status: 'applied' | 'already_applied' | 'noop' | 'rejected' | 'conflict',
  receipt: MutationReceipt,
  task: TaskTodoRow,
) {
  return { mutation_outcome: status, receipt, task: withoutOwner(task) };
}

function assertCurrentMutationBoundary(input: MutationBase, task: TaskTodoRow, transition: string) {
  if (task.revision !== input.expected_revision) {
    return mutationResult(
      'conflict',
      ephemeralReceipt(input, transition, task, 'conflict', 'revision_conflict'),
      task,
    );
  }
  return null;
}

function assertMutable(task: TaskTodoRow): void {
  if (task.disposition !== 'present') {
    throw new Error('Restore the task before editing, moving, or scheduling it.');
  }
  if (task.lifecycle !== 'open') {
    throw new Error('Reopen the task before editing, moving, or scheduling it.');
  }
}

function normalizeSource(source: TaskSource | null): Pick<
  TaskPatch,
  'source_kind' | 'source_url' | 'source_title' | 'source_external_id'
> {
  if (source === null) {
    return {
      source_kind: null,
      source_url: null,
      source_title: null,
      source_external_id: null,
    };
  }
  const sourceUrl = trimOptional(source.url);
  if ((source.kind === 'webpage' || source.kind === 'reading_item') && sourceUrl === null) {
    throw new Error('Webpage and reading-item sources require a URL.');
  }
  if (sourceUrl !== null && (source.kind === 'webpage' || source.kind === 'reading_item')) {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new Error('Webpage and reading-item sources require a valid HTTP or HTTPS URL.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Webpage and reading-item sources require a valid HTTP or HTTPS URL.');
    }
  }
  return {
    source_kind: source.kind,
    source_url: sourceUrl,
    source_title: trimOptional(source.title),
    source_external_id: trimOptional(source.external_id),
  };
}

function updatePatch(input: UpdateTaskRequest): TaskPatch {
  if (input.title === undefined && input.notes === undefined
    && input.actionability === undefined && input.source === undefined) {
    throw new Error('Update at least one of title, notes, actionability, or source.');
  }
  return {
    ...(input.title === undefined ? {} : { title: trimRequired(input.title, 'Task title', 500) }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.actionability === undefined ? {} : { actionability: input.actionability }),
    ...(input.source === undefined ? {} : normalizeSource(input.source)),
  };
}

function updateTransition(input: UpdateTaskRequest, current: Snapshot): 'update' | 'set_actionability' {
  return input.actionability !== undefined && input.actionability !== current.actionability
    ? 'set_actionability'
    : 'update';
}

function changedPatch(current: Snapshot, patch: TaskPatch): TaskPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => current[key] !== value),
  );
}

async function planningDateForOwner(
  auth: AuthenticatedMcpContext,
  instant = new Date(),
): Promise<string> {
  const settings = await readOne<Tables['tasks_user_settings']['Row']>(auth.supabase
    .from('tasks_user_settings')
    .select('*')
    .eq('owner_id', auth.userId)
    .maybeSingle());
  if (settings === null) {
    throw new Error('Task planning settings are not initialized. Open the Tasks module first.');
  }
  return planningDateInTimeZone(settings.planning_timezone, instant);
}

function validatePlanningPlacement(
  destination: TaskDestination,
  todaySection: TaskTodaySection,
  startDate: string | null,
  planningDate: string | null,
): void {
  if (destination === 'someday' && todaySection !== 'none') {
    throw new Error('Someday work cannot appear in Today.');
  }
  if (destination === 'someday' && startDate !== null) {
    throw new Error('Someday work cannot retain a start date.');
  }
  if (destination === 'anytime' && todaySection !== 'none'
    && startDate !== null && planningDate !== null && startDate > planningDate) {
    throw new Error('Future work cannot appear in Today.');
  }
}

async function nextPlanningOrderKey(
  auth: AuthenticatedMcpContext,
  taskId: string,
  destination: TaskDestination,
  todaySection: TaskTodaySection,
): Promise<string> {
  const last = await readOne<{ order_key: string }>(auth.supabase
    .from('tasks_todos')
    .select('order_key')
    .eq('owner_id', auth.userId)
    .eq('destination', destination)
    .eq('today_section', todaySection)
    .eq('lifecycle', 'open')
    .eq('disposition', 'present')
    .neq('id', taskId)
    .order('order_key', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

async function validateContainer(
  auth: AuthenticatedMcpContext,
  areaId: string | null,
  projectId: string | null,
  headingId: string | null,
): Promise<void> {
  if (areaId !== null && projectId !== null) {
    throw new Error('A task cannot belong directly to both an area and a project.');
  }
  if (headingId !== null && projectId === null) {
    throw new Error('A task heading requires project membership.');
  }
  const [area, project, heading] = await Promise.all([
    areaId === null ? null : readOne<{ id: string }>(auth.supabase
      .from('tasks_areas').select('id').eq('owner_id', auth.userId).eq('id', areaId)
      .eq('disposition', 'present').maybeSingle()),
    projectId === null ? null : readOne<{ id: string }>(auth.supabase
      .from('tasks_projects').select('id').eq('owner_id', auth.userId).eq('id', projectId)
      .eq('disposition', 'present').eq('lifecycle', 'open').maybeSingle()),
    headingId === null ? null : readOne<{ id: string; project_id: string }>(auth.supabase
      .from('tasks_headings').select('id, project_id').eq('owner_id', auth.userId)
      .eq('id', headingId).eq('disposition', 'present').maybeSingle()),
  ]);
  if (areaId !== null && area === null) throw new Error('The task area is unavailable.');
  if (projectId !== null && project === null) throw new Error('The task project is unavailable.');
  if (headingId !== null && (heading === null || heading.project_id !== projectId)) {
    throw new Error('The task heading does not belong to the selected project.');
  }
}

async function nextHierarchyOrderKey(
  auth: AuthenticatedMcpContext,
  taskId: string,
  areaId: string | null,
  projectId: string | null,
  headingId: string | null,
): Promise<string | null> {
  if (areaId === null && projectId === null && headingId === null) return null;
  let query = auth.supabase
    .from('tasks_todos')
    .select('hierarchy_order_key')
    .eq('owner_id', auth.userId)
    .eq('lifecycle', 'open')
    .eq('disposition', 'present')
    .neq('id', taskId);
  query = areaId === null ? query.is('area_id', null) : query.eq('area_id', areaId);
  query = projectId === null ? query.is('project_id', null) : query.eq('project_id', projectId);
  query = headingId === null ? query.is('heading_id', null) : query.eq('heading_id', headingId);
  const last = await readOne<{ hierarchy_order_key: string | null }>(query
    .not('hierarchy_order_key', 'is', null)
    .order('hierarchy_order_key', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle());
  return generateTaskOrderKey(last?.hierarchy_order_key ?? null, null);
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

async function movePatch(
  input: MoveTaskRequest,
  current: TaskTodoRow,
  auth: AuthenticatedMcpContext,
): Promise<TaskPatch> {
  const planningRequested = input.destination !== undefined;
  if (!planningRequested && (input.today_section !== undefined || input.start_date !== undefined)) {
    throw new Error('today_section and start_date require a destination.');
  }
  const containerKeys = ['area_id', 'project_id', 'heading_id'] as const;
  const suppliedContainerKeys = containerKeys.filter((key) => hasOwn(input, key));
  if (suppliedContainerKeys.length > 0 && suppliedContainerKeys.length !== containerKeys.length) {
    throw new Error('Container moves require area_id, project_id, and heading_id together; use null to clear a value.');
  }
  if (!planningRequested && suppliedContainerKeys.length === 0) {
    throw new Error('Move either planning placement or the complete task container.');
  }

  const patch: TaskPatch = {};
  if (planningRequested) {
    const destination = input.destination!;
    const planningDate = await planningDateForOwner(auth);
    const todaySection = destination === 'someday' ? 'none' : input.today_section ?? 'none';
    const startDate = input.start_date ?? null;
    validatePlanningPlacement(destination, todaySection, startDate, planningDate);
    assertTaskCalendarRange(startDate, current.deadline);
    if (destination === current.destination
      && todaySection === current.today_section
      && startDate !== current.start_date) {
      throw new Error('Use schedule_task to change dates without moving planning placement.');
    }
    patch.destination = destination;
    patch.today_section = todaySection;
    patch.start_date = startDate;
    if (destination !== current.destination
      || todaySection !== current.today_section
      || startDate !== current.start_date) {
      patch.order_key = await nextPlanningOrderKey(
        auth, current.id, destination, todaySection,
      );
    }
  }

  if (suppliedContainerKeys.length === containerKeys.length) {
    const areaId = input.area_id ?? null;
    const projectId = input.project_id ?? null;
    const headingId = input.heading_id ?? null;
    await validateContainer(auth, areaId, projectId, headingId);
    patch.area_id = areaId;
    patch.project_id = projectId;
    patch.heading_id = headingId;
    if (areaId !== current.area_id || projectId !== current.project_id || headingId !== current.heading_id) {
      patch.hierarchy_order_key = await nextHierarchyOrderKey(
        auth, current.id, areaId, projectId, headingId,
      );
    }
  }
  return patch;
}

async function schedulePatch(
  input: ScheduleTaskRequest,
  current: TaskTodoRow,
  auth: AuthenticatedMcpContext,
): Promise<TaskPatch> {
  if (!hasOwn(input, 'start_date') && !hasOwn(input, 'deadline')) {
    throw new Error('Schedule at least one of start_date or deadline.');
  }
  const startDate = hasOwn(input, 'start_date') ? input.start_date ?? null : current.start_date;
  const deadline = hasOwn(input, 'deadline') ? input.deadline ?? null : current.deadline;
  if (startDate !== null && !isTaskCalendarDate(startDate)) {
    throw new Error('Start date must be a valid ISO calendar date.');
  }
  if (deadline !== null && !isTaskCalendarDate(deadline)) {
    throw new Error('Deadline must be a valid ISO calendar date.');
  }
  assertTaskCalendarRange(startDate, deadline);

  const planningDate = await planningDateForOwner(auth);
  let destination = current.destination as TaskDestination;
  let todaySection = current.today_section as TaskTodaySection;
  if (destination === 'someday' && startDate !== null) {
    destination = 'anytime';
    todaySection = 'none';
  }
  if (startDate !== null && startDate > planningDate) todaySection = 'none';
  validatePlanningPlacement(destination, todaySection, startDate, planningDate);

  const patch: TaskPatch = { start_date: startDate, deadline };
  if (destination !== current.destination) {
    patch.destination = destination;
    patch.today_section = todaySection;
    patch.order_key = await nextPlanningOrderKey(auth, current.id, destination, todaySection);
  } else if (todaySection !== current.today_section) {
    patch.today_section = todaySection;
  }
  return patch;
}

function transitionPatch(
  input: TransitionTaskRequest,
  current: TaskTodoRow,
  occurredAt: string,
): { patch: TaskPatch; noop: boolean } {
  const result = applyTaskStateTransition({
    lifecycle: current.lifecycle as 'open' | 'completed' | 'canceled',
    completedAt: current.completed_at,
    canceledAt: current.canceled_at,
    disposition: current.disposition as 'present' | 'deleted',
    deletedAt: current.deleted_at,
  }, input.transition, occurredAt);
  return {
    noop: result.outcome === 'noop',
    patch: {
      lifecycle: result.state.lifecycle,
      completed_at: result.state.completedAt,
      canceled_at: result.state.canceledAt,
    },
  };
}

function expectedAfterForRetry(
  request: DirectMutationRequest,
  before: Snapshot,
  after: Snapshot,
): { expected: Snapshot; ignored: Set<string>; transition: string } {
  const expected = { ...before };
  const ignored = new Set<string>();
  if (request.kind === 'update') {
    Object.assign(expected, updatePatch(request.input));
    return { expected, ignored, transition: updateTransition(request.input, before) };
  }
  if (request.kind === 'move') {
    const input = request.input;
    if (input.destination !== undefined) {
      expected.destination = input.destination;
      expected.today_section = input.destination === 'someday'
        ? 'none'
        : input.today_section ?? 'none';
      expected.start_date = input.start_date ?? null;
      ignored.add('order_key');
    }
    if (hasOwn(input, 'area_id') && hasOwn(input, 'project_id') && hasOwn(input, 'heading_id')) {
      expected.area_id = input.area_id ?? null;
      expected.project_id = input.project_id ?? null;
      expected.heading_id = input.heading_id ?? null;
      ignored.add('hierarchy_order_key');
    }
    return { expected, ignored, transition: 'move' };
  }
  if (request.kind === 'schedule') {
    const input = request.input;
    if (hasOwn(input, 'start_date')) expected.start_date = input.start_date ?? null;
    if (hasOwn(input, 'deadline')) expected.deadline = input.deadline ?? null;
    if (before.destination === 'someday' && expected.start_date !== null) {
      expected.destination = 'anytime';
      expected.today_section = 'none';
      ignored.add('order_key');
    }
    if (before.today_section !== 'none' && after.today_section === 'none') {
      expected.today_section = 'none';
    }
    return {
      expected,
      ignored,
      transition: expected.destination === before.destination
        && expected.today_section === before.today_section ? 'update' : 'move',
    };
  }
  const transition = request.input.transition;
  if (transition === 'complete') {
    expected.lifecycle = 'completed';
    expected.completed_at = after.completed_at;
    expected.canceled_at = null;
  } else if (transition === 'cancel') {
    expected.lifecycle = 'canceled';
    expected.completed_at = null;
    expected.canceled_at = after.canceled_at;
  } else {
    expected.lifecycle = 'open';
    expected.completed_at = null;
    expected.canceled_at = null;
  }
  return { expected, ignored, transition };
}

function assertExactHistoryRetry(request: DirectMutationRequest, event: TaskHistoryRow): void {
  if (event.task_id !== request.input.task_id
    || event.base_revision !== request.input.expected_revision
    || event.actor_type !== 'automation'
    || event.mutation_channel !== 'mcp'
    || event.before_state === null) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
  const before = jsonRecord(event.before_state);
  const after = jsonRecord(event.after_state);
  const expected = expectedAfterForRetry(request, before, after);
  if (event.transition !== expected.transition
    || !snapshotsMatch(after, expected.expected, expected.ignored)) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
}

async function resolveDirectRetry(
  request: DirectMutationRequest,
  auth: AuthenticatedMcpContext,
): Promise<ReturnType<typeof mutationResult> | null> {
  const event = await readHistoryByMutation(auth, request.input.client_mutation_id);
  if (event === null) return null;
  assertExactHistoryRetry(request, event);
  const task = await requireTask(auth, event.task_id);
  return mutationResult('already_applied', historyReceipt(event), task);
}

async function writeDirectMutation(
  request: DirectMutationRequest,
  current: TaskTodoRow,
  patch: TaskPatch,
  transition: string,
  auth: AuthenticatedMcpContext,
) {
  const logicalPatch = changedPatch(rowSnapshot(current), patch);
  if (Object.keys(logicalPatch).length === 0) {
    return mutationResult(
      'noop',
      ephemeralReceipt(request.input, transition, current, 'noop', 'already_current'),
      current,
    );
  }
  const { data, error } = await auth.supabase
    .from('tasks_todos')
    .update({
      ...logicalPatch,
      revision: current.revision + 1,
      client_mutation_id: request.input.client_mutation_id,
      last_mutation_channel: 'mcp',
      last_actor_type: 'automation',
      undo_source_event_id: null,
    })
    .eq('owner_id', auth.userId)
    .eq('id', current.id)
    .eq('revision', current.revision)
    .select('*')
    .maybeSingle();
  if (error) {
    const retry = await resolveDirectRetry(request, auth);
    if (retry !== null) return retry;
    if (error.code === '23505') {
      throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
    }
    throw new Error(error.message);
  }
  if (data === null) {
    const retry = await resolveDirectRetry(request, auth);
    if (retry !== null) return retry;
    const authoritative = await requireTask(auth, current.id);
    return mutationResult(
      'conflict',
      ephemeralReceipt(request.input, transition, authoritative, 'conflict', 'revision_conflict'),
      authoritative,
    );
  }
  const event = await readHistoryByMutation(auth, request.input.client_mutation_id);
  if (event === null) throw new Error('The accepted task mutation receipt is unavailable.');
  assertExactHistoryRetry(request, event);
  return mutationResult('applied', historyReceipt(event), data);
}

async function runDirectMutation(
  request: DirectMutationRequest,
  auth: AuthenticatedMcpContext,
) {
  const retry = await resolveDirectRetry(request, auth);
  if (retry !== null) return retry;
  if (await readHierarchyOperation(auth, request.input.client_mutation_id) !== null) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
  const current = await requireTask(auth, request.input.task_id);
  const transition = request.kind === 'transition'
    ? request.input.transition
    : request.kind === 'move' ? 'move' : 'update';
  const conflict = assertCurrentMutationBoundary(request.input, current, transition);
  if (conflict !== null) return conflict;

  if (request.kind === 'update') {
    assertMutable(current);
    const patch = updatePatch(request.input);
    return writeDirectMutation(
      request,
      current,
      patch,
      updateTransition(request.input, rowSnapshot(current)),
      auth,
    );
  }
  if (request.kind === 'move') {
    assertMutable(current);
    return writeDirectMutation(
      request, current, await movePatch(request.input, current, auth), 'move', auth,
    );
  }
  if (request.kind === 'schedule') {
    assertMutable(current);
    return writeDirectMutation(
      request, current, await schedulePatch(request.input, current, auth), 'update', auth,
    );
  }
  if (request.input.transition === 'delete' || request.input.transition === 'restore') {
    throw new Error('Recovery transitions require the hierarchy mutation path.');
  }
  const transitionResult = transitionPatch(request.input, current, new Date().toISOString());
  if (transitionResult.noop) {
    return mutationResult(
      'noop',
      ephemeralReceipt(
        request.input,
        request.input.transition,
        current,
        'noop',
        'already_current',
      ),
      current,
    );
  }
  return writeDirectMutation(
    request, current, transitionResult.patch, request.input.transition, auth,
  );
}

function parseRevisionMap(value: Json): Record<string, number> {
  const record = jsonRecord(value);
  const parsed: Record<string, number> = {};
  for (const [id, revision] of Object.entries(record)) {
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) {
      throw new Error('The hierarchy mutation receipt is invalid.');
    }
    parsed[id] = revision;
  }
  return parsed;
}

function hierarchyReceipt(operation: HierarchyOperationRow): MutationReceipt {
  const base = parseRevisionMap(operation.expected_revisions);
  const result = parseRevisionMap(operation.result_revisions);
  const affectedIds = operation.affected_ids.length > 0
    ? operation.affected_ids
    : Object.keys(base);
  return {
    client_mutation_id: operation.id,
    actor_type: 'automation',
    mutation_channel: 'mcp',
    affected_ids: affectedIds,
    base_revision: base[operation.root_id] ?? 0,
    result_revision: result[operation.root_id] ?? base[operation.root_id] ?? 0,
    affected_revisions: Object.fromEntries(affectedIds.map((id) => [id, {
      base_revision: base[id] ?? 0,
      result_revision: result[id] ?? base[id] ?? 0,
    }])),
    transition: operation.operation,
    occurred_at: operation.completed_at ?? operation.requested_at,
    outcome: parseHierarchyMutationOutcome(operation.outcome),
    code: operation.outcome === 'pending' ? 'operation_pending' : operation.code,
  };
}

function parseHierarchyMutationOutcome(value: string): MutationReceipt['outcome'] {
  if (value === 'pending') return 'rejected';
  if (value === 'accepted' || value === 'noop' || value === 'rejected' || value === 'conflict') {
    return value;
  }
  throw new Error('The hierarchy mutation receipt has an invalid outcome.');
}

function assertExactHierarchyRetry(
  input: TransitionTaskRequest,
  operation: HierarchyOperationRow,
): void {
  const base = parseRevisionMap(operation.expected_revisions);
  if (operation.root_type !== 'todo'
    || operation.root_id !== input.task_id
    || operation.operation !== input.transition
    || operation.descendant_policy !== 'cascade'
    || operation.actor_type !== 'automation'
    || operation.mutation_channel !== 'mcp'
    || base[input.task_id] !== input.expected_revision) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
}

async function hierarchyResult(
  input: TransitionTaskRequest,
  operation: HierarchyOperationRow,
  auth: AuthenticatedMcpContext,
  retry: boolean,
) {
  assertExactHierarchyRetry(input, operation);
  const task = await requireTask(auth, input.task_id);
  const receipt = hierarchyReceipt(operation);
  const status = retry && (operation.outcome === 'accepted' || operation.outcome === 'noop')
    ? 'already_applied'
    : operation.outcome === 'accepted' ? 'applied'
      : operation.outcome === 'noop' ? 'noop'
        : operation.outcome === 'conflict' ? 'conflict' : 'rejected';
  return mutationResult(status, receipt, task);
}

async function expectedHierarchyRevisions(
  input: TransitionTaskRequest,
  current: TaskTodoRow,
  auth: AuthenticatedMcpContext,
): Promise<Record<string, number>> {
  let query = auth.supabase
    .from('tasks_checklist_items')
    .select('id, revision')
    .eq('owner_id', auth.userId);
  query = input.transition === 'delete'
    ? query.eq('task_id', current.id).eq('disposition', 'present')
    : query.eq('deletion_root_id', current.id);
  const descendants = await readMany<{ id: string; revision: number }>(query);
  return Object.fromEntries([
    [current.id, current.revision],
    ...descendants.map((row) => [row.id, row.revision] as const),
  ]);
}

async function runRecoveryTransition(
  input: TransitionTaskRequest,
  auth: AuthenticatedMcpContext,
) {
  const existing = await readHierarchyOperation(auth, input.client_mutation_id);
  if (existing !== null) return hierarchyResult(input, existing, auth, true);
  if (await readHistoryByMutation(auth, input.client_mutation_id) !== null) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
  const current = await requireTask(auth, input.task_id);
  const conflict = assertCurrentMutationBoundary(input, current, input.transition);
  if (conflict !== null) return conflict;
  const alreadyCurrent = (input.transition === 'delete' && current.disposition === 'deleted')
    || (input.transition === 'restore' && current.disposition === 'present');
  if (alreadyCurrent) {
    return mutationResult(
      'noop',
      ephemeralReceipt(input, input.transition, current, 'noop', 'already_current'),
      current,
    );
  }

  const requestedAt = new Date().toISOString();
  const operation: Tables['tasks_hierarchy_operations']['Insert'] = {
    id: input.client_mutation_id,
    owner_id: auth.userId,
    root_type: 'todo',
    root_id: current.id,
    operation: input.transition,
    descendant_policy: 'cascade',
    expected_revisions: await expectedHierarchyRevisions(input, current, auth),
    actor_type: 'automation',
    mutation_channel: 'mcp',
    requested_at: requestedAt,
    outcome: 'pending',
    code: null,
    affected_ids: [],
    result_revisions: {},
    completed_at: null,
  };
  const { error } = await auth.supabase.from('tasks_hierarchy_operations').insert(operation);
  if (error) {
    const replay = await readHierarchyOperation(auth, input.client_mutation_id);
    if (replay !== null) return hierarchyResult(input, replay, auth, true);
    if (error.code === '23505') {
      throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
    }
    throw new Error(error.message);
  }
  const accepted = await readHierarchyOperation(auth, input.client_mutation_id);
  if (accepted === null) throw new Error('The hierarchy mutation receipt is unavailable.');
  return hierarchyResult(input, accepted, auth, false);
}

export function updateTaskData(input: UpdateTaskRequest, auth: AuthenticatedMcpContext) {
  return runDirectMutation({ kind: 'update', input }, auth);
}

export function moveTaskData(input: MoveTaskRequest, auth: AuthenticatedMcpContext) {
  return runDirectMutation({ kind: 'move', input }, auth);
}

export function scheduleTaskData(input: ScheduleTaskRequest, auth: AuthenticatedMcpContext) {
  return runDirectMutation({ kind: 'schedule', input }, auth);
}

export function transitionTaskData(
  input: TransitionTaskRequest,
  auth: AuthenticatedMcpContext,
) {
  return input.transition === 'delete' || input.transition === 'restore'
    ? runRecoveryTransition(input, auth)
    : runDirectMutation({ kind: 'transition', input }, auth);
}

const mutationBaseSchema = {
  task_id: uuidSchema.describe('Stable to-do identifier.'),
  expected_revision: z.number().int().positive().describe('Current revision returned by a task read.'),
  client_mutation_id: uuidSchema.describe('Stable UUID for this logical mutation. Reuse it only to retry the exact same request.'),
};

export const updateTask = defineTool({
  name: 'update_task',
  title: 'Update Task',
  description: 'Edit one current to-do title, notes, actionability, or complete typed source reference with an optimistic revision guard.',
  inputSchema: {
    ...mutationBaseSchema,
    title: z.string().max(500).optional(),
    notes: z.string().max(100_000).optional(),
    actionability: actionabilitySchema.optional().describe('Mark the task actionable now or waiting on something external.'),
    source: sourceSchema.nullable().optional().describe('Complete replacement source, null to clear, or omit to preserve.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(updateTaskData(input, requireAuthenticated(ctx))),
});

export const moveTask = defineTool({
  name: 'move_task',
  title: 'Move Task',
  description: 'Move one open to-do between planning placements, hierarchy containers, or both. Container changes require all three container IDs, using null to clear.',
  inputSchema: {
    ...mutationBaseSchema,
    destination: destinationSchema.optional(),
    today_section: todaySectionSchema.optional(),
    start_date: calendarDateSchema.nullable().optional(),
    area_id: uuidSchema.nullable().optional(),
    project_id: uuidSchema.nullable().optional(),
    heading_id: uuidSchema.nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(moveTaskData(input, requireAuthenticated(ctx))),
});

export const scheduleTask = defineTool({
  name: 'schedule_task',
  title: 'Schedule Task',
  description: 'Set or clear one open to-do start date or deadline without accepting timestamps or time-zone offsets.',
  inputSchema: {
    ...mutationBaseSchema,
    start_date: calendarDateSchema.nullable().optional(),
    deadline: calendarDateSchema.nullable().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(scheduleTaskData(input, requireAuthenticated(ctx))),
});

export const transitionTask = defineTool({
  name: 'transition_task',
  title: 'Transition Task',
  description: 'Complete, cancel, reopen, recoverably delete, or restore one to-do. Permanent deletion is not available.',
  inputSchema: {
    ...mutationBaseSchema,
    transition: z.enum(['complete', 'cancel', 'reopen', 'delete', 'restore']),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(transitionTaskData(input, requireAuthenticated(ctx))),
});

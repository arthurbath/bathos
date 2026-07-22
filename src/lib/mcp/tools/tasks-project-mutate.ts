import type { Database, Json } from '@/integrations/supabase/types';
import { assertTaskCalendarRange, isTaskCalendarDate } from '../../../modules/tasks/domain/taskDates';
import { generateTaskOrderKey } from '../../../modules/tasks/domain/taskOrder';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

const destinationSchema = z.enum(['anytime', 'someday']);
const todaySectionSchema = z.enum(['none', 'inbox', 'now', 'next', 'later']);
const calendarDateSchema = z.string().refine(isTaskCalendarDate, {
  message: 'Expected a valid ISO calendar date.',
});

type Tables = Database['public']['Tables'];
type TaskProjectRow = Tables['tasks_projects']['Row'];
type TaskProjectPatch = Tables['tasks_projects']['Update'];
type TaskHierarchyHistoryRow = Tables['tasks_hierarchy_history_events']['Row'];
type ProjectDestination = z.infer<typeof destinationSchema>;
type ProjectTodaySection = z.infer<typeof todaySectionSchema>;
type Snapshot = Record<string, Json | undefined>;

type MutationBase = {
  project_id: string;
  expected_revision: number;
  client_mutation_id: string;
};

export type MoveTaskProjectRequest = MutationBase & {
  area_id?: string | null;
  destination?: ProjectDestination;
  today_section?: ProjectTodaySection;
  start_date?: string | null;
};

export type ScheduleTaskProjectRequest = MutationBase & {
  start_date?: string | null;
  deadline?: string | null;
};

type MutationRequest =
  | { kind: 'move'; input: MoveTaskProjectRequest }
  | { kind: 'schedule'; input: ScheduleTaskProjectRequest };

type MutationReceipt = {
  client_mutation_id: string;
  actor_type: 'automation';
  mutation_channel: 'mcp';
  affected_ids: string[];
  base_revision: number;
  result_revision: number;
  transition: string;
  occurred_at: string;
  outcome: 'accepted' | 'noop' | 'conflict';
  code: string | null;
};

const snapshotKeys = [
  'area_id', 'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at',
  'disposition', 'deleted_at', 'deletion_root_id', 'destination', 'today_section',
  'order_key', 'planning_order_key', 'start_date', 'deadline', 'entry_channel',
  'template_definition_id', 'template_revision', 'template_instantiation_id',
  'template_node_id', 'recurrence_definition_id', 'recurrence_revision',
  'recurrence_occurrence_id', 'recurrence_logical_key',
] as const;

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function withoutOwner(row: TaskProjectRow) {
  const { owner_id: _ownerId, ...project } = row;
  return project;
}

function jsonRecord(value: Json | null): Snapshot {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The accepted project mutation record is invalid.');
  }
  return value;
}

function rowSnapshot(row: TaskProjectRow): Snapshot {
  return Object.fromEntries(snapshotKeys.map((key) => [key, row[key]]));
}

function snapshotsMatch(
  actual: Snapshot,
  expected: Snapshot,
  ignored: ReadonlySet<string>,
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

async function readProject(
  auth: AuthenticatedMcpContext,
  projectId: string,
): Promise<TaskProjectRow | null> {
  return readOne<TaskProjectRow>(auth.supabase.from('tasks_projects')
    .select('*').eq('owner_id', auth.userId).eq('id', projectId).maybeSingle());
}

async function requireProject(
  auth: AuthenticatedMcpContext,
  projectId: string,
): Promise<TaskProjectRow> {
  const project = await readProject(auth, projectId);
  if (project === null) throw new Error('The task project is unavailable.');
  return project;
}

async function readHierarchyMutation(
  auth: AuthenticatedMcpContext,
  mutationId: string,
): Promise<TaskHierarchyHistoryRow | null> {
  return readOne<TaskHierarchyHistoryRow>(auth.supabase
    .from('tasks_hierarchy_history_events').select('*')
    .eq('owner_id', auth.userId).eq('client_mutation_id', mutationId).maybeSingle());
}

function historyReceipt(event: TaskHierarchyHistoryRow): MutationReceipt {
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
    code: null,
  };
}

function ephemeralReceipt(
  input: MutationBase,
  project: TaskProjectRow,
  transition: string,
  outcome: 'noop' | 'conflict',
  code: 'already_current' | 'revision_conflict',
): MutationReceipt {
  return {
    client_mutation_id: input.client_mutation_id,
    actor_type: 'automation',
    mutation_channel: 'mcp',
    affected_ids: [project.id],
    base_revision: input.expected_revision,
    result_revision: project.revision,
    transition,
    occurred_at: new Date().toISOString(),
    outcome,
    code,
  };
}

function mutationResult(
  outcome: 'applied' | 'already_applied' | 'noop' | 'conflict',
  receipt: MutationReceipt,
  project: TaskProjectRow,
) {
  return { mutation_outcome: outcome, receipt, project: withoutOwner(project) };
}

function assertMutable(project: TaskProjectRow): void {
  if (project.disposition !== 'present') {
    throw new Error('Restore the project before moving or scheduling it.');
  }
  if (project.lifecycle !== 'open') {
    throw new Error('Reopen the project before moving or scheduling it.');
  }
}

function validatePlanningPlacement(
  destination: ProjectDestination,
  todaySection: ProjectTodaySection,
  startDate: string | null,
): void {
  if (destination === 'someday' && todaySection !== 'none') {
    throw new Error('Someday projects cannot appear in Today.');
  }
  if (destination === 'someday' && startDate !== null) {
    throw new Error('Someday projects cannot retain a start date.');
  }
}

async function validateArea(
  auth: AuthenticatedMcpContext,
  areaId: string | null,
): Promise<void> {
  if (areaId === null) return;
  const area = await readOne<{ id: string }>(auth.supabase.from('tasks_areas')
    .select('id').eq('owner_id', auth.userId).eq('id', areaId)
    .eq('disposition', 'present').maybeSingle());
  if (area === null) throw new Error('The task area is unavailable.');
}

async function nextStructuralOrderKey(
  auth: AuthenticatedMcpContext,
  projectId: string,
  areaId: string | null,
): Promise<string> {
  let query = auth.supabase.from('tasks_projects').select('order_key')
    .eq('owner_id', auth.userId).eq('disposition', 'present').neq('id', projectId);
  query = areaId === null ? query.is('area_id', null) : query.eq('area_id', areaId);
  const last = await readOne<{ order_key: string }>(query
    .order('order_key', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

async function nextPlanningOrderKey(
  auth: AuthenticatedMcpContext,
  projectId: string,
  destination: ProjectDestination,
  todaySection: ProjectTodaySection,
): Promise<string> {
  const last = await readOne<{ planning_order_key: string }>(auth.supabase
    .from('tasks_projects').select('planning_order_key')
    .eq('owner_id', auth.userId).eq('destination', destination)
    .eq('today_section', todaySection).eq('lifecycle', 'open')
    .eq('disposition', 'present').neq('id', projectId)
    .order('planning_order_key', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle());
  return generateTaskOrderKey(last?.planning_order_key ?? null, null);
}

async function movePatch(
  input: MoveTaskProjectRequest,
  current: TaskProjectRow,
  auth: AuthenticatedMcpContext,
): Promise<TaskProjectPatch> {
  const areaRequested = hasOwn(input, 'area_id');
  const planningRequested = input.destination !== undefined;
  if (!planningRequested && (input.today_section !== undefined || input.start_date !== undefined)) {
    throw new Error('today_section and start_date require a destination.');
  }
  if (!areaRequested && !planningRequested) {
    throw new Error('Move the project to an area, a planning placement, or both.');
  }

  const patch: TaskProjectPatch = {};
  if (areaRequested) {
    const areaId = input.area_id ?? null;
    await validateArea(auth, areaId);
    patch.area_id = areaId;
    if (areaId !== current.area_id) {
      patch.order_key = await nextStructuralOrderKey(auth, current.id, areaId);
    }
  }

  if (planningRequested) {
    const destination = input.destination!;
    const todaySection = destination === 'someday' ? 'none' : input.today_section ?? 'none';
    const startDate = input.start_date ?? null;
    validatePlanningPlacement(destination, todaySection, startDate);
    assertTaskCalendarRange(startDate, current.deadline);
    if (destination === current.destination
      && todaySection === current.today_section
      && startDate !== current.start_date) {
      throw new Error('Use schedule_task_project to change dates without moving planning placement.');
    }
    patch.destination = destination;
    patch.today_section = todaySection;
    patch.start_date = startDate;
    if (destination !== current.destination
      || todaySection !== current.today_section
      || startDate !== current.start_date) {
      patch.planning_order_key = await nextPlanningOrderKey(
        auth, current.id, destination, todaySection,
      );
    }
  }
  return patch;
}

async function schedulePatch(
  input: ScheduleTaskProjectRequest,
  current: TaskProjectRow,
  auth: AuthenticatedMcpContext,
): Promise<TaskProjectPatch> {
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

  let destination = current.destination as ProjectDestination;
  let todaySection = current.today_section as ProjectTodaySection;
  if (destination === 'someday' && startDate !== null) {
    destination = 'anytime';
    todaySection = 'none';
  }
  validatePlanningPlacement(destination, todaySection, startDate);

  const patch: TaskProjectPatch = { start_date: startDate, deadline };
  if (destination !== current.destination) {
    patch.destination = destination;
    patch.today_section = todaySection;
    patch.planning_order_key = await nextPlanningOrderKey(
      auth, current.id, destination, todaySection,
    );
  } else if (todaySection !== current.today_section) {
    patch.today_section = todaySection;
  }
  return patch;
}

function changedPatch(current: Snapshot, patch: TaskProjectPatch): TaskProjectPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => current[key] !== value),
  );
}

function expectedAfterForRetry(
  request: MutationRequest,
  before: Snapshot,
  after: Snapshot,
): { expected: Snapshot; ignored: Set<string> } {
  const expected = { ...before };
  const ignored = new Set<string>();
  if (request.kind === 'move') {
    const input = request.input;
    if (hasOwn(input, 'area_id')) {
      expected.area_id = input.area_id ?? null;
      ignored.add('order_key');
    }
    if (input.destination !== undefined) {
      expected.destination = input.destination;
      expected.today_section = input.destination === 'someday'
        ? 'none'
        : input.today_section ?? 'none';
      expected.start_date = input.start_date ?? null;
      ignored.add('planning_order_key');
    }
    return { expected, ignored };
  }

  const input = request.input;
  if (hasOwn(input, 'start_date')) expected.start_date = input.start_date ?? null;
  if (hasOwn(input, 'deadline')) expected.deadline = input.deadline ?? null;
  if (before.destination === 'someday' && expected.start_date !== null) {
    expected.destination = 'anytime';
    expected.today_section = 'none';
    ignored.add('planning_order_key');
  }
  return { expected, ignored };
}

function expectedHistoryTransition(before: Snapshot, after: Snapshot): string {
  if (before.area_id !== after.area_id) return 'move';
  if (before.order_key !== after.order_key
    || before.planning_order_key !== after.planning_order_key) return 'reorder';
  return 'update';
}

function requestChangedAcceptedState(
  request: MutationRequest,
  before: Snapshot,
  expected: Snapshot,
): boolean {
  if (request.kind === 'move') {
    const input = request.input;
    const areaChanged = hasOwn(input, 'area_id') && before.area_id !== expected.area_id;
    const planningChanged = input.destination !== undefined && (
      before.destination !== expected.destination
      || before.today_section !== expected.today_section
      || before.start_date !== expected.start_date
    );
    return areaChanged || planningChanged;
  }
  return (hasOwn(request.input, 'start_date') && before.start_date !== expected.start_date)
    || (hasOwn(request.input, 'deadline') && before.deadline !== expected.deadline)
    || before.destination !== expected.destination
    || before.today_section !== expected.today_section;
}

function assertExactRetry(request: MutationRequest, event: TaskHierarchyHistoryRow): void {
  if (event.entity_type !== 'project'
    || event.entity_id !== request.input.project_id
    || event.base_revision !== request.input.expected_revision
    || event.actor_type !== 'automation'
    || event.mutation_channel !== 'mcp'
    || event.before_state === null) {
    throw new Error('The mutation identifier was already used for a different project request.');
  }
  const before = jsonRecord(event.before_state);
  const after = jsonRecord(event.after_state);
  const { expected, ignored } = expectedAfterForRetry(request, before, after);
  if (!requestChangedAcceptedState(request, before, expected)
    || event.transition !== expectedHistoryTransition(before, after)
    || !snapshotsMatch(after, expected, ignored)) {
    throw new Error('The mutation identifier was already used with different project data.');
  }
}

async function resolveRetry(
  request: MutationRequest,
  auth: AuthenticatedMcpContext,
) {
  const [event, todoEvent, hierarchyOperation] = await Promise.all([
    readHierarchyMutation(auth, request.input.client_mutation_id),
    readOne<{ id: string }>(auth.supabase.from('tasks_history_events').select('id')
      .eq('owner_id', auth.userId)
      .eq('client_mutation_id', request.input.client_mutation_id).maybeSingle()),
    readOne<{ id: string }>(auth.supabase.from('tasks_hierarchy_operations').select('id')
      .eq('owner_id', auth.userId).eq('id', request.input.client_mutation_id).maybeSingle()),
  ]);
  if (todoEvent !== null) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
  if (hierarchyOperation !== null) {
    throw new Error('The mutation identifier was already used for a different hierarchy operation.');
  }
  if (event === null) return null;
  assertExactRetry(request, event);
  const current = await requireProject(auth, request.input.project_id);
  return mutationResult('already_applied', historyReceipt(event), current);
}

async function writeMutation(
  request: MutationRequest,
  current: TaskProjectRow,
  patch: TaskProjectPatch,
  auth: AuthenticatedMcpContext,
) {
  const nextPatch = changedPatch(rowSnapshot(current), patch);
  const transition = request.kind === 'move' ? 'move' : 'update';
  if (Object.keys(nextPatch).length === 0) {
    return mutationResult(
      'noop',
      ephemeralReceipt(request.input, current, transition, 'noop', 'already_current'),
      current,
    );
  }
  const { data, error } = await auth.supabase.from('tasks_projects').update({
    ...nextPatch,
    revision: current.revision + 1,
    client_mutation_id: request.input.client_mutation_id,
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
  }).eq('owner_id', auth.userId).eq('id', current.id)
    .eq('revision', current.revision).eq('disposition', 'present').eq('lifecycle', 'open')
    .select('*').maybeSingle();
  if (error) {
    const retry = await resolveRetry(request, auth);
    if (retry !== null) return retry;
    if ('code' in error && error.code === '23505') {
      throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
    }
    throw new Error(error.message);
  }
  if (data === null) {
    const retry = await resolveRetry(request, auth);
    if (retry !== null) return retry;
    const authoritative = await requireProject(auth, current.id);
    return mutationResult(
      'conflict',
      ephemeralReceipt(
        request.input, authoritative, transition, 'conflict', 'revision_conflict',
      ),
      authoritative,
    );
  }
  const event = await readHierarchyMutation(auth, request.input.client_mutation_id);
  if (event === null) throw new Error('The accepted project mutation receipt is unavailable.');
  assertExactRetry(request, event);
  return mutationResult('applied', historyReceipt(event), data);
}

async function runMutation(
  request: MutationRequest,
  auth: AuthenticatedMcpContext,
) {
  const retry = await resolveRetry(request, auth);
  if (retry !== null) return retry;
  const current = await requireProject(auth, request.input.project_id);
  const transition = request.kind === 'move' ? 'move' : 'update';
  if (current.revision !== request.input.expected_revision) {
    return mutationResult(
      'conflict',
      ephemeralReceipt(
        request.input, current, transition, 'conflict', 'revision_conflict',
      ),
      current,
    );
  }
  assertMutable(current);
  const patch = request.kind === 'move'
    ? await movePatch(request.input, current, auth)
    : await schedulePatch(request.input, current, auth);
  return writeMutation(request, current, patch, auth);
}

export function moveTaskProjectData(
  input: MoveTaskProjectRequest,
  auth: AuthenticatedMcpContext,
) {
  return runMutation({ kind: 'move', input }, auth);
}

export function scheduleTaskProjectData(
  input: ScheduleTaskProjectRequest,
  auth: AuthenticatedMcpContext,
) {
  return runMutation({ kind: 'schedule', input }, auth);
}

const mutationBaseSchema = {
  project_id: uuidSchema.describe('Stable project identifier.'),
  expected_revision: z.number().int().positive().describe('Current project revision.'),
  client_mutation_id: uuidSchema.describe(
    'Stable UUID for this exact logical mutation. Reuse it only for an exact retry.',
  ),
};

const mutationAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const moveTaskProject = defineTool({
  name: 'move_task_project',
  title: 'Move Task Project',
  description: 'Move one open project to an area, a planning placement, or both without accepting raw order keys.',
  inputSchema: {
    ...mutationBaseSchema,
    area_id: uuidSchema.nullable().optional().describe('Present area or null for no area.'),
    destination: destinationSchema.optional(),
    today_section: todaySectionSchema.optional(),
    start_date: calendarDateSchema.nullable().optional(),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(
    moveTaskProjectData(input, requireAuthenticated(ctx)),
  ),
});

export const scheduleTaskProject = defineTool({
  name: 'schedule_task_project',
  title: 'Schedule Task Project',
  description: 'Set or clear one open project start date or deadline without accepting timestamps or time-zone offsets.',
  inputSchema: {
    ...mutationBaseSchema,
    start_date: calendarDateSchema.nullable().optional(),
    deadline: calendarDateSchema.nullable().optional(),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(
    scheduleTaskProjectData(input, requireAuthenticated(ctx)),
  ),
});

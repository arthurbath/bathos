import type { Database, Json } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '../../../modules/tasks/domain/taskDates';
import { generateTaskOrderKey } from '../../../modules/tasks/domain/taskOrder';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';
import { planningDateInTimeZone } from './tasks-read';

const destinationSchema = z.enum(['anytime', 'someday']);
const todaySectionSchema = z.enum(['inbox', 'now', 'next', 'later']);
const calendarDateSchema = z.string().refine(isTaskCalendarDate, {
  message: 'Expected a valid ISO calendar date.',
});

type Tables = Database['public']['Tables'];
type TaskAreaRow = Tables['tasks_areas']['Row'];
type TaskProjectRow = Tables['tasks_projects']['Row'];
type TaskChecklistItemRow = Tables['tasks_checklist_items']['Row'];
type TaskHierarchyHistoryRow = Tables['tasks_hierarchy_history_events']['Row'];
type TaskDestination = z.infer<typeof destinationSchema>;
type TaskTodaySection = z.infer<typeof todaySectionSchema>;
type HierarchyRecordType = 'area' | 'project' | 'checklist_item';
type HierarchyRow = TaskAreaRow | TaskProjectRow | TaskChecklistItemRow;

export type CreateTaskAreaRequest = {
  idempotency_key: string;
  title: string;
};

export type CreateTaskProjectRequest = {
  idempotency_key: string;
  title: string;
  notes: string;
  area_id?: string;
  destination: TaskDestination;
  today_section?: TaskTodaySection | null;
  start_date?: string | null;
  deadline?: string | null;
};

export type CreateTaskChecklistItemRequest = {
  idempotency_key: string;
  task_id: string;
  title: string;
};

type ExistingCreation = {
  event: TaskHierarchyHistoryRow;
  record: HierarchyRow;
};

function trimTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error('A title is required.');
  if (Array.from(title).length > 500) throw new Error('A title cannot exceed 500 characters.');
  return title;
}

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

function jsonRecord(value: Json): Record<string, Json | undefined> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The hierarchy creation receipt is invalid.');
  }
  return value;
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function readHierarchyRecord(
  auth: AuthenticatedMcpContext,
  recordType: HierarchyRecordType,
  id: string,
): Promise<HierarchyRow | null> {
  if (recordType === 'area') {
    return readOne<TaskAreaRow>(auth.supabase.from('tasks_areas')
      .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  if (recordType === 'project') {
    return readOne<TaskProjectRow>(auth.supabase.from('tasks_projects')
      .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  return readOne<TaskChecklistItemRow>(auth.supabase.from('tasks_checklist_items')
    .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
}

async function findExistingCreation(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
): Promise<ExistingCreation | null> {
  const event = await readOne<TaskHierarchyHistoryRow>(auth.supabase
    .from('tasks_hierarchy_history_events')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('client_mutation_id', idempotencyKey)
    .maybeSingle());
  if (event === null) return null;
  if (event.transition !== 'create') {
    throw new Error('The idempotency key belongs to a different hierarchy mutation.');
  }
  const recordType = event.entity_type as HierarchyRecordType;
  if (!['area', 'project', 'checklist_item'].includes(recordType)) {
    throw new Error('The hierarchy creation receipt has an unsupported record type.');
  }
  const record = await readHierarchyRecord(auth, recordType, event.entity_id);
  if (record === null) throw new Error('The created hierarchy record is unavailable.');
  return { event, record };
}

function assertExactReplay(
  existing: ExistingCreation,
  expectedType: HierarchyRecordType,
  expected: Record<string, Json>,
): void {
  if (existing.event.entity_type !== expectedType) {
    throw new Error('The idempotency key was already used for a different hierarchy request.');
  }
  const state = jsonRecord(existing.event.after_state);
  const matches = Object.entries(expected).every(([key, value]) => state[key] === value);
  if (!matches) {
    throw new Error('The idempotency key was already used with different hierarchy data.');
  }
}

function creationResult(existing: ExistingCreation, status: 'created' | 'already_applied') {
  const { event, record } = existing;
  return {
    mutation_outcome: status,
    receipt: {
      client_mutation_id: event.client_mutation_id,
      actor_type: event.actor_type,
      mutation_channel: event.mutation_channel,
      affected_ids: event.affected_ids,
      base_revision: event.base_revision,
      result_revision: event.result_revision,
      transition: event.transition,
      occurred_at: event.occurred_at,
      outcome: 'accepted' as const,
      code: null,
    },
    record_type: event.entity_type,
    record: stripOwner(record),
  };
}

async function replayOrNull(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
  recordType: HierarchyRecordType,
  expected: Record<string, Json>,
) {
  const [existing, todoMutation, hierarchyOperation] = await Promise.all([
    findExistingCreation(auth, idempotencyKey),
    readOne<{ id: string }>(auth.supabase.from('tasks_history_events')
      .select('id').eq('owner_id', auth.userId)
      .eq('client_mutation_id', idempotencyKey).maybeSingle()),
    readOne<{ id: string }>(auth.supabase.from('tasks_hierarchy_operations')
      .select('id').eq('owner_id', auth.userId).eq('id', idempotencyKey).maybeSingle()),
  ]);
  if (todoMutation !== null) {
    throw new Error('The idempotency key was already used for a different task mutation.');
  }
  if (hierarchyOperation !== null) {
    throw new Error('The idempotency key was already used for a different hierarchy operation.');
  }
  if (existing === null) return null;
  assertExactReplay(existing, recordType, expected);
  return creationResult(existing, 'already_applied');
}

async function readCreated(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
): Promise<ExistingCreation> {
  const existing = await findExistingCreation(auth, idempotencyKey);
  if (existing === null) throw new Error('The accepted hierarchy creation receipt is unavailable.');
  return existing;
}

async function insertWithReplay(
  auth: AuthenticatedMcpContext,
  table: 'tasks_areas' | 'tasks_projects' | 'tasks_checklist_items',
  row: Tables[typeof table]['Insert'],
  idempotencyKey: string,
  recordType: HierarchyRecordType,
  expected: Record<string, Json>,
) {
  const { error } = await auth.supabase.from(table).insert(row as never);
  if (error) {
    if (error.code === '23505') {
      const replay = await replayOrNull(auth, idempotencyKey, recordType, expected);
      if (replay !== null) return replay;
      throw new Error('The idempotency key is unavailable. Use a new key for a new hierarchy request.');
    }
    throw new Error(error.message);
  }
  return creationResult(await readCreated(auth, idempotencyKey), 'created');
}

async function nextAreaOrderKey(auth: AuthenticatedMcpContext): Promise<string> {
  const last = await readOne<Pick<TaskAreaRow, 'order_key'>>(auth.supabase
    .from('tasks_areas').select('order_key').eq('owner_id', auth.userId)
    .eq('disposition', 'present').order('order_key', { ascending: false })
    .order('id', { ascending: false }).limit(1).maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

async function nextProjectOrderKeys(
  auth: AuthenticatedMcpContext,
  areaId: string | null,
  destination: TaskDestination,
  todaySection: TaskTodaySection | null,
): Promise<{ orderKey: string; planningOrderKey: string }> {
  let structuralQuery = auth.supabase.from('tasks_projects').select('order_key')
    .eq('owner_id', auth.userId).eq('disposition', 'present');
  structuralQuery = areaId === null
    ? structuralQuery.is('area_id', null)
    : structuralQuery.eq('area_id', areaId);
  let planningQuery = auth.supabase.from('tasks_projects').select('planning_order_key')
    .eq('owner_id', auth.userId).eq('disposition', 'present').eq('lifecycle', 'open')
    .eq('destination', destination);
  planningQuery = todaySection === null
    ? planningQuery.is('today_section', null)
    : planningQuery.eq('today_section', todaySection);
  const [structural, planning] = await Promise.all([
    readOne<Pick<TaskProjectRow, 'order_key'>>(structuralQuery
      .order('order_key', { ascending: false }).order('id', { ascending: false })
      .limit(1).maybeSingle()),
    readOne<Pick<TaskProjectRow, 'planning_order_key'>>(planningQuery
      .order('planning_order_key', { ascending: false }).order('id', { ascending: false })
      .limit(1).maybeSingle()),
  ]);
  return {
    orderKey: generateTaskOrderKey(structural?.order_key ?? null, null),
    planningOrderKey: generateTaskOrderKey(planning?.planning_order_key ?? null, null),
  };
}

async function nextChecklistOrderKey(
  auth: AuthenticatedMcpContext,
  taskId: string,
): Promise<string> {
  const last = await readOne<Pick<TaskChecklistItemRow, 'order_key'>>(auth.supabase
    .from('tasks_checklist_items').select('order_key').eq('owner_id', auth.userId)
    .eq('task_id', taskId).eq('disposition', 'present')
    .order('order_key', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

export async function createTaskAreaData(
  input: CreateTaskAreaRequest,
  auth: AuthenticatedMcpContext,
) {
  const title = trimTitle(input.title);
  const expected = { title };
  const replay = await replayOrNull(auth, input.idempotency_key, 'area', expected);
  if (replay !== null) return replay;
  const timestamp = new Date().toISOString();
  return insertWithReplay(auth, 'tasks_areas', {
    id: crypto.randomUUID(),
    owner_id: auth.userId,
    title,
    order_key: await nextAreaOrderKey(auth),
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    entry_channel: 'mcp',
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
    revision: 1,
    client_mutation_id: input.idempotency_key,
    created_at: timestamp,
    updated_at: timestamp,
  }, input.idempotency_key, 'area', expected);
}

export async function createTaskProjectData(
  input: CreateTaskProjectRequest,
  auth: AuthenticatedMcpContext,
) {
  const title = trimTitle(input.title);
  const areaId = input.area_id ?? null;
  const startDate = input.start_date ?? null;
  const deadline = input.deadline ?? null;
  if (input.destination === 'someday' && (input.today_section != null || startDate !== null)) {
    throw new Error('Someday projects cannot retain a start date or day horizon.');
  }
  if (startDate !== null && !isTaskCalendarDate(startDate)) {
    throw new Error('Start date must be a valid ISO calendar date.');
  }
  if (deadline !== null && !isTaskCalendarDate(deadline)) {
    throw new Error('Deadline must be a valid ISO calendar date.');
  }
  if (areaId !== null) {
    const area = await readOne<Pick<TaskAreaRow, 'id'>>(auth.supabase.from('tasks_areas')
      .select('id').eq('owner_id', auth.userId).eq('id', areaId)
      .eq('disposition', 'present').maybeSingle());
    if (area === null) throw new Error('The task area is unavailable.');
  }
  if (startDate !== null) {
    const settings = await readOne<{ planning_timezone: string }>(auth.supabase
      .from('tasks_user_settings').select('planning_timezone')
      .eq('owner_id', auth.userId).maybeSingle());
    if (!settings) {
      throw new Error('Task planning settings are not initialized. Open the Tasks module once.');
    }
    if (startDate <= planningDateInTimeZone(settings.planning_timezone)) {
      throw new Error('Start date must be later than today in the owner planning time zone.');
    }
  }
  const todaySection = input.destination === 'someday'
    ? null
    : startDate === null ? input.today_section ?? null : input.today_section ?? 'next';
  const expected = {
    title,
    notes: input.notes,
    area_id: areaId,
    destination: input.destination,
    today_section: todaySection,
    start_date: startDate,
    deadline,
  };
  const replay = await replayOrNull(auth, input.idempotency_key, 'project', expected);
  if (replay !== null) return replay;
  const { orderKey, planningOrderKey } = await nextProjectOrderKeys(
    auth, areaId, input.destination, todaySection,
  );
  const timestamp = new Date().toISOString();
  return insertWithReplay(auth, 'tasks_projects', {
    id: crypto.randomUUID(),
    owner_id: auth.userId,
    area_id: areaId,
    title,
    notes: input.notes,
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: input.destination,
    today_section: todaySection,
    order_key: orderKey,
    planning_order_key: planningOrderKey,
    start_date: startDate,
    deadline,
    entry_channel: 'mcp',
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
    revision: 1,
    client_mutation_id: input.idempotency_key,
    created_at: timestamp,
    updated_at: timestamp,
  }, input.idempotency_key, 'project', expected);
}

export async function createTaskChecklistItemData(
  input: CreateTaskChecklistItemRequest,
  auth: AuthenticatedMcpContext,
) {
  const title = trimTitle(input.title);
  const expected = { title, task_id: input.task_id };
  const replay = await replayOrNull(auth, input.idempotency_key, 'checklist_item', expected);
  if (replay !== null) return replay;
  const task = await readOne<{ id: string }>(auth.supabase.from('tasks_todos')
    .select('id').eq('owner_id', auth.userId).eq('id', input.task_id)
    .eq('disposition', 'present').eq('lifecycle', 'open').maybeSingle());
  if (task === null) throw new Error('The parent task is unavailable.');
  const timestamp = new Date().toISOString();
  return insertWithReplay(auth, 'tasks_checklist_items', {
    id: crypto.randomUUID(),
    owner_id: auth.userId,
    task_id: input.task_id,
    title,
    completed: false,
    completed_at: null,
    order_key: await nextChecklistOrderKey(auth, input.task_id),
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    entry_channel: 'mcp',
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
    revision: 1,
    client_mutation_id: input.idempotency_key,
    created_at: timestamp,
    updated_at: timestamp,
  }, input.idempotency_key, 'checklist_item', expected);
}

const idempotencyInput = {
  idempotency_key: uuidSchema.describe(
    'Stable UUID for this logical creation request. Reuse it only for an exact retry.',
  ),
  title: z.string().trim().min(1).max(500),
};

const mutationAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const createTaskArea = defineTool({
  name: 'create_task_area',
  title: 'Create Task Area',
  description: 'Create one owner-scoped task area with safe exact-retry behavior.',
  inputSchema: idempotencyInput,
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(createTaskAreaData(input, requireAuthenticated(ctx))),
});

export const createTaskProject = defineTool({
  name: 'create_task_project',
  title: 'Create Task Project',
  description: 'Create one owner-scoped open project with structured placement and planning fields.',
  inputSchema: {
    ...idempotencyInput,
    notes: z.string().max(100_000).default(''),
    area_id: uuidSchema.optional(),
    destination: destinationSchema.default('anytime'),
    today_section: todaySectionSchema.nullable().optional(),
    start_date: calendarDateSchema.nullable().optional(),
    deadline: calendarDateSchema.nullable().optional(),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(createTaskProjectData(input, requireAuthenticated(ctx))),
});

export const createTaskChecklistItem = defineTool({
  name: 'create_task_checklist_item',
  title: 'Create Task Checklist Item',
  description: 'Create one owner-scoped checklist item beneath an accessible open to-do.',
  inputSchema: { ...idempotencyInput, task_id: uuidSchema },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(
    createTaskChecklistItemData(input, requireAuthenticated(ctx)),
  ),
});

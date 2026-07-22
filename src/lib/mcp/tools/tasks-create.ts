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
const todaySectionSchema = z.enum(['none', 'now', 'next', 'later']);
const actionabilitySchema = z.enum(['actionable', 'waiting']);
const integrationChannelSchema = z.enum([
  'mcp',
  'raycast',
  'browser_capture',
  'mail_automation',
  'native',
]);
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
type TaskDestination = z.infer<typeof destinationSchema>;
type TaskTodaySection = z.infer<typeof todaySectionSchema>;
type TaskActionability = z.infer<typeof actionabilitySchema>;
type TaskIntegrationChannel = z.infer<typeof integrationChannelSchema>;
type TaskSource = z.infer<typeof sourceSchema>;

export type CreateTaskRequest = {
  idempotency_key: string;
  title: string;
  notes: string;
  destination: TaskDestination;
  today_section: TaskTodaySection;
  actionability?: TaskActionability;
  entry_channel?: TaskIntegrationChannel;
  start_date?: string | null;
  deadline?: string | null;
  area_id?: string;
  project_id?: string;
  heading_id?: string;
  source?: TaskSource;
};

type NormalizedCreateTaskRequest = {
  idempotencyKey: string;
  title: string;
  notes: string;
  destination: TaskDestination;
  todaySection: TaskTodaySection;
  actionability: TaskActionability;
  entryChannel: TaskIntegrationChannel;
  requestedStartDate: string | null;
  startDateWasExplicit: boolean;
  deadline: string | null;
  areaId: string | null;
  projectId: string | null;
  headingId: string | null;
  sourceKind: TaskSource['kind'] | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceExternalId: string | null;
};

type ExistingCreation = {
  event: Pick<
    TaskHistoryRow,
    'task_id' | 'client_mutation_id' | 'actor_type' | 'mutation_channel'
      | 'affected_ids' | 'base_revision'
      | 'result_revision' | 'transition' | 'occurred_at' | 'outcome'
      | 'after_state'
  >;
  task: TaskTodoRow;
};

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

function normalizeRequest(input: CreateTaskRequest): NormalizedCreateTaskRequest {
  const sourceKind = input.source?.kind ?? null;
  const sourceUrl = trimOptional(input.source?.url);
  const sourceTitle = trimOptional(input.source?.title);
  const sourceExternalId = trimOptional(input.source?.external_id);
  if ((sourceKind === 'webpage' || sourceKind === 'reading_item') && sourceUrl === null) {
    throw new Error('Webpage and reading-item sources require a URL.');
  }
  if (sourceUrl !== null && (sourceKind === 'webpage' || sourceKind === 'reading_item')) {
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      throw new Error('Webpage and reading-item sources require a valid HTTP or HTTPS URL.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Webpage and reading-item sources require a valid HTTP or HTTPS URL.');
    }
  }

  const areaId = input.area_id ?? null;
  const projectId = input.project_id ?? null;
  const headingId = input.heading_id ?? null;
  if (areaId !== null && projectId !== null) {
    throw new Error('A task cannot belong directly to both an area and a project.');
  }
  if (headingId !== null && projectId === null) {
    throw new Error('A task heading requires project membership.');
  }
  const requestedStartDate = input.start_date ?? null;
  if (requestedStartDate !== null && !isTaskCalendarDate(requestedStartDate)) {
    throw new Error('Start date must be a valid ISO calendar date.');
  }
  const deadline = input.deadline ?? null;
  if (deadline !== null && !isTaskCalendarDate(deadline)) {
    throw new Error('Deadline must be a valid ISO calendar date.');
  }
  if (input.destination === 'someday' && input.today_section !== 'none') {
    throw new Error('Someday work cannot appear in Today.');
  }
  if (input.destination === 'someday' && requestedStartDate !== null) {
    throw new Error('Someday work cannot retain a start date.');
  }
  if (requestedStartDate !== null) assertTaskCalendarRange(requestedStartDate, deadline);

  return {
    idempotencyKey: input.idempotency_key,
    title: trimRequired(input.title, 'Task title', 500),
    notes: input.notes,
    destination: input.destination,
    todaySection: input.today_section,
    actionability: input.actionability ?? 'actionable',
    entryChannel: input.entry_channel ?? 'mcp',
    requestedStartDate,
    startDateWasExplicit: input.start_date !== undefined && input.start_date !== null,
    deadline,
    areaId,
    projectId,
    headingId,
    sourceKind,
    sourceUrl,
    sourceTitle,
    sourceExternalId,
  };
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function findExistingCreation(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
): Promise<ExistingCreation | null> {
  const event = await readOne<ExistingCreation['event']>(auth.supabase
    .from('tasks_history_events')
    .select('task_id, client_mutation_id, actor_type, mutation_channel, affected_ids, base_revision, result_revision, transition, occurred_at, outcome, after_state')
    .eq('owner_id', auth.userId)
    .eq('client_mutation_id', idempotencyKey)
    .eq('transition', 'create')
    .maybeSingle());
  if (event === null) return null;

  const task = await readOne<TaskTodoRow>(auth.supabase
    .from('tasks_todos')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('id', event.task_id)
    .maybeSingle());
  if (task === null) throw new Error('The idempotent task creation record is unavailable.');
  return { event, task };
}

function jsonRecord(value: Json): Record<string, Json | undefined> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The idempotent task creation record is invalid.');
  }
  return value;
}

function assertSameCreationRequest(
  request: NormalizedCreateTaskRequest,
  existing: ExistingCreation,
): void {
  const state = jsonRecord(existing.event.after_state);
  const checks: Array<[unknown, unknown]> = [
    [state.title, request.title],
    [state.notes, request.notes],
    [state.destination, request.destination],
    [state.today_section, request.todaySection],
    [state.actionability, request.actionability],
    [existing.event.mutation_channel, request.entryChannel],
    [state.deadline, request.deadline],
    [state.area_id, request.areaId],
    [state.project_id, request.projectId],
    [state.heading_id, request.headingId],
    [state.source_kind, request.sourceKind],
    [state.source_url, request.sourceUrl],
    [state.source_title, request.sourceTitle],
    [state.source_external_id, request.sourceExternalId],
  ];
  checks.push([state.start_date, request.requestedStartDate]);
  if (checks.some(([actual, expected]) => actual !== expected)) {
    throw new Error('The idempotency key was already used for a different task creation request.');
  }
}

async function resolveStartDate(
  request: NormalizedCreateTaskRequest,
  _auth: AuthenticatedMcpContext,
): Promise<string | null> {
  return request.requestedStartDate;
}

async function validateContainer(
  request: NormalizedCreateTaskRequest,
  auth: AuthenticatedMcpContext,
): Promise<void> {
  const [area, project, heading] = await Promise.all([
    request.areaId === null ? null : readOne<{ id: string }>(auth.supabase
      .from('tasks_areas')
      .select('id')
      .eq('owner_id', auth.userId)
      .eq('id', request.areaId)
      .eq('disposition', 'present')
      .maybeSingle()),
    request.projectId === null ? null : readOne<{ id: string }>(auth.supabase
      .from('tasks_projects')
      .select('id')
      .eq('owner_id', auth.userId)
      .eq('id', request.projectId)
      .eq('disposition', 'present')
      .eq('lifecycle', 'open')
      .maybeSingle()),
    request.headingId === null ? null : readOne<{ id: string; project_id: string }>(auth.supabase
      .from('tasks_headings')
      .select('id, project_id')
      .eq('owner_id', auth.userId)
      .eq('id', request.headingId)
      .eq('disposition', 'present')
      .maybeSingle()),
  ]);
  if (request.areaId !== null && area === null) throw new Error('The task area is unavailable.');
  if (request.projectId !== null && project === null) throw new Error('The task project is unavailable.');
  if (request.headingId !== null && (heading === null || heading.project_id !== request.projectId)) {
    throw new Error('The task heading does not belong to the selected project.');
  }
}

async function nextPlanningOrderKey(
  request: NormalizedCreateTaskRequest,
  startDate: string | null,
  auth: AuthenticatedMcpContext,
): Promise<string> {
  const query = auth.supabase
    .from('tasks_todos')
    .select('order_key')
    .eq('owner_id', auth.userId)
    .eq('destination', request.destination)
    .eq('today_section', request.todaySection)
    .eq('lifecycle', 'open')
    .eq('disposition', 'present');
  const last = await readOne<{ order_key: string }>(query
    .order('order_key', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

async function nextHierarchyOrderKey(
  request: NormalizedCreateTaskRequest,
  auth: AuthenticatedMcpContext,
): Promise<string | null> {
  if (request.areaId === null && request.projectId === null && request.headingId === null) {
    return null;
  }
  let query = auth.supabase
    .from('tasks_todos')
    .select('hierarchy_order_key')
    .eq('owner_id', auth.userId)
    .eq('lifecycle', 'open')
    .eq('disposition', 'present');
  query = request.areaId === null ? query.is('area_id', null) : query.eq('area_id', request.areaId);
  query = request.projectId === null ? query.is('project_id', null) : query.eq('project_id', request.projectId);
  query = request.headingId === null ? query.is('heading_id', null) : query.eq('heading_id', request.headingId);
  const last = await readOne<{ hierarchy_order_key: string | null }>(query
    .not('hierarchy_order_key', 'is', null)
    .order('hierarchy_order_key', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle());
  return generateTaskOrderKey(last?.hierarchy_order_key ?? null, null);
}

function withoutOwner(row: TaskTodoRow) {
  const { owner_id: _ownerId, ...task } = row;
  return task;
}

function creationResult(existing: ExistingCreation, idempotencyOutcome: 'created' | 'already_applied') {
  return {
    idempotency_outcome: idempotencyOutcome,
    receipt: {
      client_mutation_id: existing.event.client_mutation_id,
      actor_type: existing.event.actor_type,
      mutation_channel: existing.event.mutation_channel,
      affected_ids: existing.event.affected_ids,
      base_revision: existing.event.base_revision,
      result_revision: existing.event.result_revision,
      transition: existing.event.transition,
      occurred_at: existing.event.occurred_at,
      outcome: existing.event.outcome,
      code: null,
    },
    task: withoutOwner(existing.task),
  };
}

async function readCreationEvent(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
): Promise<ExistingCreation> {
  const created = await findExistingCreation(auth, idempotencyKey);
  if (created === null) throw new Error('The accepted task creation receipt is unavailable.');
  return created;
}

export async function createTaskData(
  input: CreateTaskRequest,
  auth: AuthenticatedMcpContext,
) {
  const request = normalizeRequest(input);
  const existing = await findExistingCreation(auth, request.idempotencyKey);
  if (existing !== null) {
    assertSameCreationRequest(request, existing);
    return creationResult(existing, 'already_applied');
  }

  const startDate = await resolveStartDate(request, auth);
  assertTaskCalendarRange(startDate, request.deadline);
  await validateContainer(request, auth);
  const [orderKey, hierarchyOrderKey] = await Promise.all([
    nextPlanningOrderKey(request, startDate, auth),
    nextHierarchyOrderKey(request, auth),
  ]);
  const timestamp = new Date().toISOString();
  const row: Tables['tasks_todos']['Insert'] = {
    id: crypto.randomUUID(),
    owner_id: auth.userId,
    area_id: request.areaId,
    project_id: request.projectId,
    heading_id: request.headingId,
    title: request.title,
    notes: request.notes,
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: request.destination,
    today_section: request.todaySection,
    actionability: request.actionability,
    order_key: orderKey,
    hierarchy_order_key: hierarchyOrderKey,
    start_date: startDate,
    deadline: request.deadline,
    entry_channel: request.entryChannel,
    last_mutation_channel: request.entryChannel,
    last_actor_type: 'automation',
    undo_source_event_id: null,
    source_kind: request.sourceKind,
    source_url: request.sourceUrl,
    source_title: request.sourceTitle,
    source_external_id: request.sourceExternalId,
    revision: 1,
    client_mutation_id: request.idempotencyKey,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const { error } = await auth.supabase.from('tasks_todos').insert(row);
  if (error) {
    if (error.code === '23505') {
      const replay = await findExistingCreation(auth, request.idempotencyKey);
      if (replay !== null) {
        assertSameCreationRequest(request, replay);
        return creationResult(replay, 'already_applied');
      }
      throw new Error('The idempotency key is unavailable. Use a new key for a new task request.');
    }
    throw new Error(error.message);
  }
  return creationResult(await readCreationEvent(auth, request.idempotencyKey), 'created');
}

export const createTask = defineTool({
  name: 'create_task',
  title: 'Create Task',
  description: 'Create one owner-scoped to-do with structured planning and source fields. A required idempotency key makes exact retries safe.',
  inputSchema: {
    idempotency_key: uuidSchema.describe('Stable UUID for this logical creation request. Reuse it only to retry the exact same request.'),
    title: z.string().trim().min(1).max(500),
    notes: z.string().max(100_000).default(''),
    destination: destinationSchema.default('anytime'),
    today_section: todaySectionSchema.default('later'),
    actionability: actionabilitySchema.default('actionable').describe('Whether the task can be acted on now or is waiting on something external.'),
    entry_channel: integrationChannelSchema.default('mcp').describe('Structured integration that collected the task. Ordinary MCP clients should keep the default.'),
    start_date: calendarDateSchema.nullable().optional(),
    deadline: calendarDateSchema.nullable().optional(),
    area_id: uuidSchema.optional(),
    project_id: uuidSchema.optional(),
    heading_id: uuidSchema.optional(),
    source: sourceSchema.optional().describe('Optional typed source reference. Template provenance is reserved for template instantiation.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(createTaskData(input, requireAuthenticated(ctx))),
});

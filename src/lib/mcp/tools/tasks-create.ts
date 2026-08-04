import type { Database, Json } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '../../../modules/tasks/domain/taskDates';
import { normalizeTaskPrimaryLink } from '../../../modules/tasks/domain/taskPrimaryLink';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';
const destinationSchema = z.enum(['anytime', 'someday']);
const todaySectionSchema = z.enum(['inbox', 'now', 'next', 'later']);
const actionabilitySchema = z.enum(['actionable', 'waiting', 'rechecking']);
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
  destination?: TaskDestination;
  today_section?: TaskTodaySection | null;
  actionability?: TaskActionability;
  entry_channel?: TaskIntegrationChannel;
  start_date?: string | null;
  deadline?: string | null;
  area_id?: string;
  source?: TaskSource;
  primary_link?: string | null;
};

type NormalizedCreateTaskRequest = {
  idempotencyKey: string;
  title: string;
  notes: string;
  destination: TaskDestination;
  todaySection: TaskTodaySection | null;
  actionability: TaskActionability;
  entryChannel: TaskIntegrationChannel;
  requestedStartDate: string | null;
  placementWasImplicit: boolean;
  deadline: string | null;
  areaId: string | null;
  sourceKind: TaskSource['kind'] | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceExternalId: string | null;
  primaryLink: string | null;
};

export type CreateTaskResult = {
  idempotency_outcome: 'created' | 'already_applied';
  receipt: Pick<
    TaskHistoryRow,
    'client_mutation_id' | 'actor_type' | 'mutation_channel'
      | 'affected_ids' | 'base_revision' | 'result_revision'
      | 'transition' | 'occurred_at' | 'outcome'
  > & { code: null };
  task: Omit<TaskTodoRow, 'owner_id'>;
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
  const primaryLink = normalizeTaskPrimaryLink(input.primary_link);
  if ((primaryLink?.length ?? 0) > 8_000) {
    throw new Error('Primary Link cannot exceed 8000 characters.');
  }
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
  const destination = input.destination ?? 'anytime';
  const requestedStartDate = input.start_date ?? null;
  if (requestedStartDate !== null && !isTaskCalendarDate(requestedStartDate)) {
    throw new Error('Start must be a valid ISO calendar date.');
  }
  const deadline = input.deadline ?? null;
  if (deadline !== null && !isTaskCalendarDate(deadline)) {
    throw new Error('Deadline must be a valid ISO calendar date.');
  }
  const requestedTodaySection = input.today_section ?? null;
  if (destination === 'someday' && (requestedTodaySection !== null || requestedStartDate !== null)) {
    throw new Error('Someday work cannot retain a Start or day horizon.');
  }
  return {
    idempotencyKey: input.idempotency_key,
    title: trimRequired(input.title, 'Task title', 500),
    notes: input.notes,
    destination,
    todaySection: requestedTodaySection,
    actionability: input.actionability ?? 'actionable',
    entryChannel: input.entry_channel ?? 'mcp',
    requestedStartDate,
    placementWasImplicit: input.destination === undefined
      && input.start_date === undefined
      && input.today_section === undefined,
    deadline,
    areaId,
    sourceKind,
    sourceUrl,
    sourceTitle,
    sourceExternalId,
    primaryLink,
  };
}

function jsonRecord(value: Json): Record<string, Json | undefined> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The transactional task creation response is invalid.');
  }
  return value;
}

function parseCreationResult(value: Json): CreateTaskResult {
  const result = jsonRecord(value);
  const receipt = jsonRecord(result.receipt ?? null);
  const task = jsonRecord(result.task ?? null);
  if (
    !['created', 'already_applied'].includes(String(result.idempotency_outcome))
    || receipt.transition !== 'create'
    || task.owner_id !== undefined
  ) {
    throw new Error('The transactional task creation response is invalid.');
  }
  return value as unknown as CreateTaskResult;
}

export async function createTaskData(
  input: CreateTaskRequest,
  auth: AuthenticatedMcpContext,
) {
  const request = normalizeRequest(input);
  const { data, error } = await auth.supabase.rpc('tasks_create_mcp_task', {
    _idempotency_key: request.idempotencyKey,
    _title: request.title,
    _notes: request.notes,
    _destination: request.destination,
    _requested_today_section: request.todaySection,
    _actionability: request.actionability,
    _entry_channel: request.entryChannel,
    _requested_start_date: request.requestedStartDate,
    _placement_was_implicit: request.placementWasImplicit,
    _deadline: request.deadline,
    _area_id: request.areaId,
    _source_kind: request.sourceKind,
    _source_url: request.sourceUrl,
    _source_title: request.sourceTitle,
    _source_external_id: request.sourceExternalId,
    _primary_link: request.primaryLink,
  });
  if (error) throw new Error(error.message);
  return parseCreationResult(data);
}

export const createTask = defineTool({
  name: 'create_task',
  title: 'Create Task',
  description: 'Create one owner-scoped to-do with structured planning and source fields. A required idempotency key makes exact retries safe.',
  inputSchema: {
    idempotency_key: uuidSchema.describe('Stable UUID for this logical creation request. Reuse it only to retry the exact same request.'),
    title: z.string().trim().min(1).max(500),
    notes: z.string().max(100_000).default(''),
    destination: destinationSchema.optional().describe('Omit for ordinary active capture in Today Next. Explicit Anytime without a Start or horizon remains undated.'),
    today_section: todaySectionSchema.nullable().optional().describe('Today work may use a horizon. A future Start has no horizon.'),
    actionability: actionabilitySchema.default('actionable').describe('Whether the task is actionable, waiting on an outside party or signal, or requires deliberate rechecking.'),
    entry_channel: integrationChannelSchema.default('mcp').describe('Structured integration that collected the task. Ordinary MCP clients should keep the default.'),
    start_date: calendarDateSchema.nullable().optional(),
    deadline: calendarDateSchema.nullable().optional(),
    area_id: uuidSchema.optional(),
    source: sourceSchema.optional().describe('Optional typed source reference for captured work.'),
    primary_link: z.string().max(8_000).nullable().optional().describe('Optional editable shortcut, stored independently from typed source provenance.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(createTaskData(input, requireAuthenticated(ctx))),
});

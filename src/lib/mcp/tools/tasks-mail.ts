import { generateTaskOrderKey } from '../../../modules/tasks/domain/taskOrder';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';
import { planningDateInTimeZone } from './tasks-read';

const messageDeepLinkSchema = z.string().max(8_000).refine(
  (value) => value.startsWith('message://'),
  { message: 'Expected a message:// Mail deep link.' },
);

export type CreateMailTaskRequest = {
  idempotency_key: string;
  title: string;
  notes: string;
  account_identifier: string;
  mailbox_identifier: string;
  message_identifier: string;
  deep_link: string;
  retirement_destination_identifier: string;
  source_title?: string;
  area_id?: string;
};

export type BeginMailRetirementRequest = {
  task_id: string;
  expected_revision: number;
  idempotency_key: string;
};

export type ResolveMailRetirementRequest = BeginMailRetirementRequest & {
  result: 'retired' | 'failed';
  error_code?: string;
};

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

function trimRequired(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (Array.from(normalized).length > maxLength) {
    throw new Error(`${label} cannot exceed ${maxLength} characters.`);
  }
  return normalized;
}

async function planningDate(auth: AuthenticatedMcpContext): Promise<string> {
  const settings = await readOne<{ planning_timezone: string }>(auth.supabase
    .from('tasks_user_settings')
    .select('planning_timezone')
    .eq('owner_id', auth.userId)
    .maybeSingle());
  if (!settings) {
    throw new Error('Task planning settings are not initialized. Open the Tasks module once.');
  }
  return planningDateInTimeZone(settings.planning_timezone);
}

async function validateArea(
  areaId: string | undefined,
  auth: AuthenticatedMcpContext,
): Promise<string | null> {
  if (!areaId) return null;
  const area = await readOne<{ id: string }>(auth.supabase
    .from('tasks_areas')
    .select('id')
    .eq('owner_id', auth.userId)
    .eq('id', areaId)
    .eq('disposition', 'present')
    .maybeSingle());
  if (!area) throw new Error('The task area is unavailable.');
  return area.id;
}

async function nextPlanningOrderKey(
  _startDate: string,
  auth: AuthenticatedMcpContext,
): Promise<string> {
  const last = await readOne<{ order_key: string }>(auth.supabase
    .from('tasks_todos')
    .select('order_key')
    .eq('owner_id', auth.userId)
    .eq('destination', 'anytime')
    .eq('today_section', 'inbox')
    .is('start_date', null)
    .eq('lifecycle', 'open')
    .eq('disposition', 'present')
    .order('order_key', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

async function nextAreaOrderKey(
  areaId: string | null,
  auth: AuthenticatedMcpContext,
): Promise<string | null> {
  if (areaId === null) return null;
  const last = await readOne<{ hierarchy_order_key: string | null }>(auth.supabase
    .from('tasks_todos')
    .select('hierarchy_order_key')
    .eq('owner_id', auth.userId)
    .eq('area_id', areaId)
    .is('project_id', null)
    .is('heading_id', null)
    .eq('lifecycle', 'open')
    .eq('disposition', 'present')
    .not('hierarchy_order_key', 'is', null)
    .order('hierarchy_order_key', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle());
  return generateTaskOrderKey(last?.hierarchy_order_key ?? null, null);
}

export async function createMailTaskData(
  input: CreateMailTaskRequest,
  auth: AuthenticatedMcpContext,
) {
  const title = trimRequired(input.title, 'Task title', 500);
  const accountIdentifier = trimRequired(input.account_identifier, 'Mail account identifier', 500);
  const mailboxIdentifier = trimRequired(input.mailbox_identifier, 'Mail mailbox identifier', 1_000);
  const messageIdentifier = trimRequired(input.message_identifier, 'Mail message identifier', 2_000);
  const retirementDestination = trimRequired(
    input.retirement_destination_identifier,
    'Mail retirement destination',
    1_000,
  );
  const sourceTitle = input.source_title?.trim() || null;
  const [startDate, areaId] = await Promise.all([
    planningDate(auth),
    validateArea(input.area_id, auth),
  ]);
  const [orderKey, hierarchyOrderKey] = await Promise.all([
    nextPlanningOrderKey(startDate, auth),
    nextAreaOrderKey(areaId, auth),
  ]);
  const { data, error } = await auth.supabase.rpc('tasks_create_mail_capture', {
    _idempotency_key: input.idempotency_key,
    _task_id: crypto.randomUUID(),
    _title: title,
    _notes: input.notes,
    _start_date: startDate,
    _order_key: orderKey,
    _hierarchy_order_key: hierarchyOrderKey,
    _account_identifier: accountIdentifier,
    _mailbox_identifier: mailboxIdentifier,
    _message_identifier: messageIdentifier,
    _deep_link: input.deep_link,
    _retirement_destination_identifier: retirementDestination,
    _source_title: sourceTitle,
    _area_id: areaId,
  });
  if (error) throw new Error(error.message);
  return data;
}

export const createMailTask = defineTool({
  name: 'create_mail_task',
  title: 'Create Mail Task',
  description: 'Atomically create one AI-processed Today task and its structured Mail source lifecycle record. Intended for a verified Mail integration, not generic task creation.',
  inputSchema: {
    idempotency_key: uuidSchema.describe('Stable UUID for this logical Mail capture. Reuse it only for an exact retry.'),
    title: z.string().trim().min(1).max(500),
    notes: z.string().max(100_000).default(''),
    account_identifier: z.string().trim().min(1).max(500),
    mailbox_identifier: z.string().trim().min(1).max(1_000),
    message_identifier: z.string().trim().min(1).max(2_000),
    deep_link: messageDeepLinkSchema,
    retirement_destination_identifier: z.string().trim().min(1).max(1_000),
    source_title: z.string().max(1_000).optional(),
    area_id: uuidSchema.optional().describe('Optional accessible area for verified work-mail routing.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(createMailTaskData(input, requireAuthenticated(ctx))),
});

export async function beginMailRetirementData(
  input: BeginMailRetirementRequest,
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_begin_mail_retirement', {
    _task_id: input.task_id,
    _expected_revision: input.expected_revision,
    _idempotency_key: input.idempotency_key,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function resolveMailRetirementData(
  input: ResolveMailRetirementRequest,
  auth: AuthenticatedMcpContext,
) {
  const errorCode = input.error_code?.trim() || null;
  if (input.result === 'failed' && errorCode === null) {
    throw new Error('A failed Mail retirement requires an error code.');
  }
  if (input.result === 'retired' && errorCode !== null) {
    throw new Error('A successful Mail retirement cannot include an error code.');
  }
  const { data, error } = await auth.supabase.rpc('tasks_resolve_mail_retirement', {
    _task_id: input.task_id,
    _expected_revision: input.expected_revision,
    _idempotency_key: input.idempotency_key,
    _result: input.result,
    _error_code: errorCode,
  });
  if (error) throw new Error(error.message);
  return data;
}

const retirementMutationInput = {
  task_id: uuidSchema.describe('Mail-sourced task identifier returned by create_mail_task.'),
  expected_revision: z.number().int().positive().describe('Current Mail source revision.'),
  idempotency_key: uuidSchema.describe('Stable UUID for this exact lifecycle mutation.'),
};

export const beginMailRetirement = defineTool({
  name: 'begin_mail_retirement',
  title: 'Begin Mail Retirement',
  description: 'Mark one retained or explicitly failed Mail source as pending immediately before attempting its external Mail move.',
  inputSchema: retirementMutationInput,
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(beginMailRetirementData(input, requireAuthenticated(ctx))),
});

export const resolveMailRetirement = defineTool({
  name: 'resolve_mail_retirement',
  title: 'Resolve Mail Retirement',
  description: 'Record the verified success or bounded failure of a pending external Mail move.',
  inputSchema: {
    ...retirementMutationInput,
    result: z.enum(['retired', 'failed']),
    error_code: z.string().trim().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(resolveMailRetirementData(input, requireAuthenticated(ctx))),
});

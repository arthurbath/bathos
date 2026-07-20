import type { Database } from '@/integrations/supabase/types';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

type DefinitionRow = Database['public']['Tables']['tasks_recurrence_definitions']['Row'];
type RevisionRow = Database['public']['Tables']['tasks_recurrence_revisions']['Row'];
type OccurrenceRow = Database['public']['Tables']['tasks_recurrence_occurrences']['Row'];

async function readMany<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

export async function getTaskRecurrencesData(
  input: { include_archived: boolean; include_occurrences: boolean; limit: number },
  auth: AuthenticatedMcpContext,
) {
  let query = auth.supabase
    .from('tasks_recurrence_definitions')
    .select('*')
    .eq('owner_id', auth.userId);
  if (!input.include_archived) query = query.neq('status', 'archived');
  const definitions = await readMany<DefinitionRow>(query
    .order('name')
    .order('id')
    .limit(input.limit + 1));
  const visible = definitions.slice(0, input.limit);
  const ids = visible.map(({ id }) => id);
  const revisions = ids.length === 0 ? [] : await readMany<RevisionRow>(auth.supabase
    .from('tasks_recurrence_revisions')
    .select('*')
    .eq('owner_id', auth.userId)
    .in('recurrence_id', ids)
    .order('recurrence_id')
    .order('revision', { ascending: false }));
  const occurrenceRows = !input.include_occurrences || ids.length === 0
    ? []
    : await readMany<OccurrenceRow>(auth.supabase
      .from('tasks_recurrence_occurrences')
      .select('*')
      .eq('owner_id', auth.userId)
      .in('recurrence_id', ids)
      .order('scheduled_date', { ascending: false })
      .limit(501));
  const occurrences = occurrenceRows.slice(0, 500);
  const currentByDefinition = new Map(revisions.map((revision) => [
    `${revision.recurrence_id}:${revision.revision}`,
    revision,
  ]));
  const occurrencesByDefinition = new Map<string, Array<Omit<OccurrenceRow, 'owner_id'>>>();
  for (const occurrence of occurrences) {
    const rows = occurrencesByDefinition.get(occurrence.recurrence_id) ?? [];
    rows.push(stripOwner(occurrence));
    occurrencesByDefinition.set(occurrence.recurrence_id, rows);
  }
  return {
    recurrences: visible.map((definition) => ({
      ...stripOwner(definition),
      current_revision_record: currentByDefinition.has(
        `${definition.id}:${definition.current_revision}`,
      )
        ? stripOwner(currentByDefinition.get(`${definition.id}:${definition.current_revision}`)!)
        : null,
      ...(input.include_occurrences
        ? { occurrences: occurrencesByDefinition.get(definition.id) ?? [] }
        : {}),
    })),
    truncated: definitions.length > input.limit,
    occurrences_truncated: input.include_occurrences && occurrenceRows.length > 500,
  };
}

export async function saveTaskRecurrenceData(
  input: {
    recurrence_id?: string;
    expected_record_revision?: number;
    name: string;
    template_id: string;
    template_revision?: number;
    rule_mode: 'calendar' | 'after_completion';
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval_count: number;
    start_date: string;
    planning_timezone: string;
    missed_policy: 'skip' | 'latest' | 'all';
    catch_up_limit: number;
    target_area_id?: string;
    idempotency_key: string;
  },
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_save_recurrence', {
    _recurrence_id: input.recurrence_id ?? null,
    _expected_record_revision: input.expected_record_revision ?? null,
    _name: input.name,
    _template_id: input.template_id,
    _template_revision: input.template_revision ?? null,
    _rule_mode: input.rule_mode,
    _frequency: input.frequency,
    _interval_count: input.interval_count,
    _start_date: input.start_date,
    _planning_timezone: input.planning_timezone,
    _missed_policy: input.missed_policy,
    _catch_up_limit: input.catch_up_limit,
    _target_area_id: input.target_area_id ?? null,
    _mutation_id: input.idempotency_key,
    _mutation_channel: 'mcp',
    _actor_type: 'automation',
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function setTaskRecurrenceStatusData(
  input: {
    recurrence_id: string;
    expected_record_revision: number;
    status: 'active' | 'paused' | 'archived';
    idempotency_key: string;
  },
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_set_recurrence_status', {
    _recurrence_id: input.recurrence_id,
    _expected_record_revision: input.expected_record_revision,
    _status: input.status,
    _mutation_id: input.idempotency_key,
    _mutation_channel: 'mcp',
    _actor_type: 'automation',
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function evaluateTaskRecurrenceData(
  input: { recurrence_id: string; through_date: string; idempotency_key: string },
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_evaluate_recurrence', {
    _recurrence_id: input.recurrence_id,
    _through_date: input.through_date,
    _request_id: input.idempotency_key,
    _entry_channel: 'mcp',
    _actor_type: 'automation',
  });
  if (error) throw new Error(error.message);
  return data;
}

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const getTaskRecurrences = defineTool({
  name: 'get_task_recurrences',
  title: 'Get Task Recurrences',
  description: 'Read owner-scoped recurrence definitions, immutable current rules, and optionally their generated occurrence identities.',
  inputSchema: {
    include_archived: z.boolean().default(false),
    include_occurrences: z.boolean().default(false),
    limit: z.number().int().min(1).max(500).default(250),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getTaskRecurrencesData(input, requireAuthenticated(ctx))),
});

export const saveTaskRecurrence = defineTool({
  name: 'save_task_recurrence',
  title: 'Save Task Recurrence',
  description: 'Create or revise one recurrence definition from an immutable native task-template revision. Existing generated work never changes.',
  inputSchema: {
    recurrence_id: uuidSchema.optional().describe('Existing recurrence to revise. Omit to create.'),
    expected_record_revision: z.number().int().positive().optional()
      .describe('Required current record revision when revising an existing recurrence.'),
    name: z.string().min(1).max(500),
    template_id: uuidSchema,
    template_revision: z.number().int().positive().optional(),
    rule_mode: z.enum(['calendar', 'after_completion']),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval_count: z.number().int().min(1).max(1000).default(1),
    start_date: calendarDateSchema,
    planning_timezone: z.string().min(1).max(200),
    missed_policy: z.enum(['skip', 'latest', 'all']).default('latest'),
    catch_up_limit: z.number().int().min(1).max(100).default(50),
    target_area_id: uuidSchema.optional(),
    idempotency_key: uuidSchema.describe('Stable UUID for this exact save request.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(saveTaskRecurrenceData(input, requireAuthenticated(ctx))),
});

export const setTaskRecurrenceStatus = defineTool({
  name: 'set_task_recurrence_status',
  title: 'Set Task Recurrence Status',
  description: 'Pause, resume, or permanently archive one recurrence definition without changing existing generated work.',
  inputSchema: {
    recurrence_id: uuidSchema,
    expected_record_revision: z.number().int().positive(),
    status: z.enum(['active', 'paused', 'archived']),
    idempotency_key: uuidSchema.describe('Stable UUID for this exact status request.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(setTaskRecurrenceStatusData(input, requireAuthenticated(ctx))),
});

export const evaluateTaskRecurrence = defineTool({
  name: 'evaluate_task_recurrence',
  title: 'Evaluate Task Recurrence',
  description: 'Request idempotent server-side catch-up for one recurrence through an explicit local calendar date.',
  inputSchema: {
    recurrence_id: uuidSchema,
    through_date: calendarDateSchema,
    idempotency_key: uuidSchema.describe('Stable UUID for this exact evaluation request.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(evaluateTaskRecurrenceData(input, requireAuthenticated(ctx))),
});

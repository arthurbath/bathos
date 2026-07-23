import type { Database } from '@/integrations/supabase/types';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

type ReminderRow = Database['public']['Tables']['tasks_reminders']['Row'];
type OccurrenceRow = Database['public']['Tables']['tasks_reminder_occurrences']['Row'];

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

export async function getTaskRemindersData(
  input: { include_canceled: boolean; include_occurrences: boolean; limit: number },
  auth: AuthenticatedMcpContext,
) {
  let query = auth.supabase
    .from('tasks_reminders')
    .select('*')
    .eq('owner_id', auth.userId);
  if (!input.include_canceled) query = query.eq('status', 'active');
  const reminders = await readMany<ReminderRow>(query
    .order('resolved_at')
    .order('id')
    .limit(input.limit + 1));
  const visible = reminders.slice(0, input.limit);
  const ids = visible.map(({ id }) => id);
  const occurrences = !input.include_occurrences || ids.length === 0
    ? []
    : await readMany<OccurrenceRow>(auth.supabase
      .from('tasks_reminder_occurrences')
      .select('*')
      .eq('owner_id', auth.userId)
      .in('reminder_id', ids)
      .order('resolved_at', { ascending: false })
      .limit(501));
  const occurrencesByReminder = new Map<string, Array<Omit<OccurrenceRow, 'owner_id'>>>();
  for (const occurrence of occurrences.slice(0, 500)) {
    const rows = occurrencesByReminder.get(occurrence.reminder_id) ?? [];
    rows.push(stripOwner(occurrence));
    occurrencesByReminder.set(occurrence.reminder_id, rows);
  }
  return {
    reminders: visible.map((reminder) => ({
      ...stripOwner(reminder),
      root_id: reminder.task_id ?? reminder.project_id,
      ...(input.include_occurrences
        ? { occurrences: occurrencesByReminder.get(reminder.id) ?? [] }
        : {}),
    })),
    truncated: reminders.length > input.limit,
    occurrences_truncated: input.include_occurrences && occurrences.length > 500,
  };
}

export async function saveTaskReminderData(
  input: {
    reminder_id?: string;
    expected_record_revision?: number;
    root_type: 'todo' | 'project';
    root_id: string;
    local_time: string;
    time_zone: string;
    ambiguity_choice: 'earlier' | 'later';
    idempotency_key: string;
  },
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_save_start_reminder', {
    _reminder_id: input.reminder_id ?? null,
    _expected_record_revision: input.expected_record_revision ?? null,
    _root_type: input.root_type,
    _root_id: input.root_id,
    _local_time: input.local_time,
    _time_zone: input.time_zone,
    _ambiguity_choice: input.ambiguity_choice,
    _mutation_id: input.idempotency_key,
    _mutation_channel: 'mcp',
    _actor_type: 'automation',
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelTaskReminderData(
  input: {
    reminder_id: string;
    expected_record_revision: number;
    idempotency_key: string;
  },
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_cancel_reminder', {
    _reminder_id: input.reminder_id,
    _expected_record_revision: input.expected_record_revision,
    _mutation_id: input.idempotency_key,
    _mutation_channel: 'mcp',
    _actor_type: 'automation',
  });
  if (error) throw new Error(error.message);
  return data;
}

const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);

export const getTaskReminders = defineTool({
  name: 'get_task_reminders',
  title: 'Get Task Reminders',
  description: 'Read owner-scoped reminder intent, resolved UTC instants, resolution decisions, and optionally immutable occurrence identities.',
  inputSchema: {
    include_canceled: z.boolean().default(false),
    include_occurrences: z.boolean().default(false),
    limit: z.number().int().min(1).max(500).default(250),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getTaskRemindersData(input, requireAuthenticated(ctx))),
});

export const saveTaskReminder = defineTool({
  name: 'save_task_reminder',
  title: 'Save Task Reminder',
  description: 'Create or revise one task or project reminder at a wall-clock time on its Start date, using an IANA time zone and daylight-saving ambiguity choice.',
  inputSchema: {
    reminder_id: uuidSchema.optional().describe('Existing reminder to revise. Omit to create.'),
    expected_record_revision: z.number().int().positive().optional()
      .describe('Required current record revision when revising an existing reminder.'),
    root_type: z.enum(['todo', 'project']),
    root_id: uuidSchema,
    local_time: localTimeSchema,
    time_zone: z.string().min(1).max(255),
    ambiguity_choice: z.enum(['earlier', 'later']).default('earlier'),
    idempotency_key: uuidSchema.describe('Stable UUID for this exact save request.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(saveTaskReminderData(input, requireAuthenticated(ctx))),
});

export const cancelTaskReminder = defineTool({
  name: 'cancel_task_reminder',
  title: 'Cancel Task Reminder',
  description: 'Cancel one reminder and every still-pending delivery occurrence without deleting its portable schedule history.',
  inputSchema: {
    reminder_id: uuidSchema,
    expected_record_revision: z.number().int().positive(),
    idempotency_key: uuidSchema.describe('Stable UUID for this exact cancellation request.'),
  },
  annotations: {
    readOnlyHint: false,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  handler: (input, ctx) => toMcpResult(cancelTaskReminderData(input, requireAuthenticated(ctx))),
});

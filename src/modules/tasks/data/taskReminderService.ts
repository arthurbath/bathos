import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '@/modules/tasks/domain/taskDates';
import {
  taskActorTypes,
  taskEntryChannels,
  taskReminderAmbiguityChoices,
  taskReminderResolutionKinds,
  taskReminderStatuses,
  taskTemplateKinds,
  type TaskReminder,
  type TaskReminderAmbiguityChoice,
  type TaskReminderDelivery,
  type TaskReminderOccurrence,
  type TaskTemplateKind,
} from '@/modules/tasks/types/tasks';

type TaskReminderClient = Pick<SupabaseClient<Database>, 'rpc'>;

export type TaskReminderSaveInput = {
  reminder?: TaskReminder | null;
  rootType: TaskTemplateKind;
  rootId: string;
  localDate: string;
  localTime: string;
  timeZone: string;
  ambiguityChoice?: TaskReminderAmbiguityChoice;
  mutationId?: string;
  mutationChannel?: 'web' | 'mcp';
  actorType?: 'user' | 'automation';
};

export type TaskReminderSaveResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  reminder: TaskReminder;
  occurrence?: TaskReminderOccurrence;
};

export type TaskDueReminder = {
  delivery_id: string;
  occurrence_id: string;
  reminder_id: string;
  root_type: TaskTemplateKind;
  root_id: string;
  title: string;
  resolved_at: string;
  attempt_count: number;
};

export type TaskReminderClaimResult = {
  outcome: 'accepted';
  through_at: string;
  items: TaskDueReminder[];
};

export class InvalidTaskReminderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskReminderError';
  }
}

export class TaskReminderService {
  constructor(private readonly client: TaskReminderClient) {}

  async save(input: TaskReminderSaveInput): Promise<TaskReminderSaveResult> {
    if (
      !input.rootId
      || !isTaskCalendarDate(input.localDate)
      || !isTaskReminderTime(input.localTime)
      || !input.timeZone.trim()
    ) {
      throw new InvalidTaskReminderError('A valid reminder date, time, and time zone are required');
    }
    const { data, error } = await this.client.rpc('tasks_save_reminder', {
      _reminder_id: (input.reminder?.id ?? null) as unknown as string,
      _expected_record_revision: (input.reminder?.record_revision ?? null) as unknown as number,
      _root_type: input.rootType,
      _root_id: input.rootId,
      _local_date: input.localDate,
      _local_time: input.localTime,
      _time_zone: input.timeZone,
      _ambiguity_choice: input.ambiguityChoice ?? 'earlier',
      _mutation_id: input.mutationId ?? crypto.randomUUID(),
      _mutation_channel: input.mutationChannel ?? 'web',
      _actor_type: input.actorType ?? 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Reminder save returned an invalid result');
    const outcome = requireEnum(
      result.outcome,
      ['accepted', 'already_applied', 'conflict'] as const,
      'reminder save outcome',
    );
    return {
      outcome,
      reminder: parseTaskReminder(result.reminder),
      ...(outcome === 'conflict'
        ? {}
        : { occurrence: parseTaskReminderOccurrence(result.occurrence) }),
    };
  }

  async cancel(
    reminder: TaskReminder,
    mutationId = crypto.randomUUID(),
    mutationChannel: 'web' | 'mcp' = 'web',
    actorType: 'user' | 'automation' = 'user',
  ): Promise<{ outcome: 'accepted' | 'already_applied' | 'conflict'; reminder: TaskReminder }> {
    const { data, error } = await this.client.rpc('tasks_cancel_reminder', {
      _reminder_id: reminder.id,
      _expected_record_revision: reminder.record_revision,
      _mutation_id: mutationId,
      _mutation_channel: mutationChannel,
      _actor_type: actorType,
    });
    if (error) throw error;
    const result = requireRecord(data, 'Reminder cancellation returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'conflict'] as const,
        'reminder cancellation outcome',
      ),
      reminder: parseTaskReminder(result.reminder),
    };
  }

  async claimDue(
    throughAt = new Date().toISOString(),
    requestId = crypto.randomUUID(),
  ): Promise<TaskReminderClaimResult> {
    if (Number.isNaN(new Date(throughAt).valueOf())) {
      throw new InvalidTaskReminderError('A valid reminder claim time is required');
    }
    const { data, error } = await this.client.rpc('tasks_claim_due_reminders', {
      _through_at: throughAt,
      _request_id: requestId,
    });
    if (error) throw error;
    const result = requireRecord(data, 'Reminder claim returned an invalid result');
    const items = requireArray(result.items, 'Reminder claim items are invalid')
      .map(parseTaskDueReminder);
    return {
      outcome: requireEnum(result.outcome, ['accepted'] as const, 'reminder claim outcome'),
      through_at: requireTimestamp(result.through_at, 'reminder claim time'),
      items,
    };
  }

  async acknowledge(deliveryId: string): Promise<{
    outcome: 'accepted' | 'already_applied' | 'canceled';
    delivery: TaskReminderDelivery;
  }> {
    const { data, error } = await this.client.rpc('tasks_acknowledge_reminder_delivery', {
      _delivery_id: deliveryId,
    });
    if (error) throw error;
    const result = requireRecord(data, 'Reminder acknowledgement returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'canceled'] as const,
        'reminder acknowledgement outcome',
      ),
      delivery: result.delivery as TaskReminderDelivery,
    };
  }
}

export function parseTaskReminder(value: unknown): TaskReminder {
  const record = requireRecord(value, 'Reminder is invalid');
  requireText(record.id, 'reminder identifier');
  requireText(record.owner_id, 'reminder owner');
  requireCalendarDate(record.local_date, 'reminder date');
  if (!isTaskReminderTime(record.local_time)) {
    throw new InvalidTaskReminderError('Reminder time is invalid');
  }
  requireTimestamp(record.resolved_at, 'reminder resolved time');
  requirePositiveInteger(record.record_revision, 'reminder revision');
  return {
    ...record,
    root_type: requireEnum(record.root_type, taskTemplateKinds, 'reminder root type'),
    status: requireEnum(record.status, taskReminderStatuses, 'reminder status'),
    ambiguity_choice: requireEnum(
      record.ambiguity_choice,
      taskReminderAmbiguityChoices,
      'reminder ambiguity choice',
    ),
    resolution_kind: requireEnum(
      record.resolution_kind,
      taskReminderResolutionKinds,
      'reminder resolution kind',
    ),
    last_mutation_channel: requireEnum(
      record.last_mutation_channel,
      taskEntryChannels,
      'reminder mutation channel',
    ),
    last_actor_type: requireEnum(record.last_actor_type, taskActorTypes, 'reminder actor'),
  } as TaskReminder;
}

export function parseTaskReminderOccurrence(value: unknown): TaskReminderOccurrence {
  const record = requireRecord(value, 'Reminder occurrence is invalid');
  requireText(record.id, 'reminder occurrence identifier');
  requireText(record.owner_id, 'reminder occurrence owner');
  requireText(record.reminder_id, 'reminder identifier');
  requirePositiveInteger(record.reminder_revision, 'reminder occurrence revision');
  requireTimestamp(record.resolved_at, 'reminder occurrence time');
  return {
    ...record,
    status: requireEnum(
      record.status,
      ['scheduled', 'canceled'] as const,
      'reminder occurrence status',
    ),
  } as TaskReminderOccurrence;
}

export function isTaskReminderTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function parseTaskDueReminder(value: unknown): TaskDueReminder {
  const record = requireRecord(value, 'Due reminder is invalid');
  return {
    delivery_id: requireText(record.delivery_id, 'delivery identifier'),
    occurrence_id: requireText(record.occurrence_id, 'occurrence identifier'),
    reminder_id: requireText(record.reminder_id, 'reminder identifier'),
    root_type: requireEnum(record.root_type, taskTemplateKinds, 'reminder root type'),
    root_id: requireText(record.root_id, 'reminder root identifier'),
    title: requireText(record.title, 'reminder title'),
    resolved_at: requireTimestamp(record.resolved_at, 'reminder due time'),
    attempt_count: requirePositiveInteger(record.attempt_count, 'reminder attempt count'),
  };
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  const parsed = typeof value === 'string' ? parseJson(value, message) : value;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidTaskReminderError(message);
  }
  return parsed as Record<string, unknown>;
}

function requireArray(value: unknown, message: string): unknown[] {
  const parsed = typeof value === 'string' ? parseJson(value, message) : value;
  if (!Array.isArray(parsed)) throw new InvalidTaskReminderError(message);
  return parsed;
}

function parseJson(value: string, message: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidTaskReminderError(message);
  }
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value;
}

function requireCalendarDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isTaskCalendarDate(value)) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value;
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).valueOf())) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return Number(value);
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value as T[number];
}

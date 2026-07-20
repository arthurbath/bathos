import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '@/modules/tasks/domain/taskDates';
import {
  taskActorTypes,
  taskEntryChannels,
  taskRecurrenceFrequencies,
  taskRecurrenceMissedPolicies,
  taskRecurrenceRuleModes,
  taskRecurrenceStatuses,
  taskTemplateKinds,
  type TaskRecurrenceDefinition,
  type TaskRecurrenceFrequency,
  type TaskRecurrenceMissedPolicy,
  type TaskRecurrenceOccurrence,
  type TaskRecurrenceRevision,
  type TaskRecurrenceRuleMode,
  type TaskRecurrenceStatus,
} from '@/modules/tasks/types/tasks';

type TaskRecurrenceClient = Pick<SupabaseClient<Database>, 'rpc'>;

export type TaskRecurrenceSaveInput = {
  recurrenceId?: string | null;
  expectedRecordRevision?: number | null;
  name: string;
  templateId: string;
  templateRevision: number;
  ruleMode: TaskRecurrenceRuleMode;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  startDate: string;
  planningTimeZone: string;
  missedPolicy: TaskRecurrenceMissedPolicy;
  catchUpLimit?: number;
  targetAreaId?: string | null;
  mutationId?: string;
};

export type TaskRecurrenceSaveResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  definition: TaskRecurrenceDefinition;
  revision?: TaskRecurrenceRevision;
};

export type TaskRecurrenceStatusResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  definition: TaskRecurrenceDefinition;
};

export type TaskRecurrenceEvaluationResult = {
  outcome: 'accepted' | 'already_applied';
  status: TaskRecurrenceStatus;
  through_date: string;
  generated_count: number;
  occurrence_ids: string[];
  definition: TaskRecurrenceDefinition;
};

export class InvalidTaskRecurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskRecurrenceError';
  }
}

export class TaskRecurrenceService {
  constructor(
    private readonly client: TaskRecurrenceClient,
    private readonly ownerId: string,
  ) {
    requireText(ownerId, 'recurrence owner');
  }

  async save(input: TaskRecurrenceSaveInput): Promise<TaskRecurrenceSaveResult> {
    const name = input.name.trim();
    if (
      !name
      || name.length > 500
      || !Number.isInteger(input.templateRevision)
      || input.templateRevision < 1
      || !Number.isInteger(input.intervalCount)
      || input.intervalCount < 1
      || input.intervalCount > 1000
      || !isTaskCalendarDate(input.startDate)
      || !input.planningTimeZone
    ) {
      throw new InvalidTaskRecurrenceError('A valid recurrence definition is required');
    }
    const { data, error } = await this.client.rpc('tasks_save_recurrence', {
      _recurrence_id: (input.recurrenceId ?? null) as unknown as string,
      _expected_record_revision: (input.expectedRecordRevision ?? null) as unknown as number,
      _name: name,
      _template_id: input.templateId,
      _template_revision: input.templateRevision,
      _rule_mode: input.ruleMode,
      _frequency: input.frequency,
      _interval_count: input.intervalCount,
      _start_date: input.startDate,
      _planning_timezone: input.planningTimeZone,
      _missed_policy: input.missedPolicy,
      _catch_up_limit: input.catchUpLimit ?? 50,
      _target_area_id: (input.targetAreaId ?? null) as unknown as string,
      _mutation_id: input.mutationId ?? crypto.randomUUID(),
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Recurrence save returned an invalid result');
    const outcome = requireEnum(
      result.outcome,
      ['accepted', 'already_applied', 'conflict'] as const,
      'recurrence save outcome',
    );
    return {
      outcome,
      definition: parseTaskRecurrenceDefinition(result.definition, this.ownerId),
      ...(outcome === 'conflict'
        ? {}
        : { revision: parseTaskRecurrenceRevision(result.revision, this.ownerId) }),
    };
  }

  async setStatus(
    definition: TaskRecurrenceDefinition,
    status: TaskRecurrenceStatus,
    mutationId = crypto.randomUUID(),
  ): Promise<TaskRecurrenceStatusResult> {
    const { data, error } = await this.client.rpc('tasks_set_recurrence_status', {
      _recurrence_id: definition.id,
      _expected_record_revision: definition.record_revision,
      _status: status,
      _mutation_id: mutationId,
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Recurrence status returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'conflict'] as const,
        'recurrence status outcome',
      ),
      definition: parseTaskRecurrenceDefinition(result.definition, this.ownerId),
    };
  }

  async evaluate(
    recurrenceId: string,
    throughDate: string,
    requestId = crypto.randomUUID(),
  ): Promise<TaskRecurrenceEvaluationResult> {
    if (!isTaskCalendarDate(throughDate)) {
      throw new InvalidTaskRecurrenceError('A valid evaluation date is required');
    }
    const { data, error } = await this.client.rpc('tasks_evaluate_recurrence', {
      _recurrence_id: recurrenceId,
      _through_date: throughDate,
      _request_id: requestId,
      _entry_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Recurrence evaluation returned an invalid result');
    const occurrenceIds = requireArray(
      result.occurrence_ids,
      'Recurrence occurrence identifiers are invalid',
    );
    if (occurrenceIds.some((id) => typeof id !== 'string')) {
      throw new InvalidTaskRecurrenceError('Recurrence occurrence identifiers are invalid');
    }
    if (!Number.isInteger(result.generated_count) || Number(result.generated_count) < 0) {
      throw new InvalidTaskRecurrenceError('Recurrence generated count is invalid');
    }
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied'] as const,
        'recurrence evaluation outcome',
      ),
      status: requireEnum(result.status, taskRecurrenceStatuses, 'recurrence status'),
      through_date: requireCalendarDate(result.through_date, 'evaluation date'),
      generated_count: Number(result.generated_count),
      occurrence_ids: occurrenceIds as string[],
      definition: parseTaskRecurrenceDefinition(result.definition, this.ownerId),
    };
  }
}

export function parseTaskRecurrenceDefinition(
  value: unknown,
  ownerId?: string,
): TaskRecurrenceDefinition {
  const record = requireRecord(value, 'Recurrence definition is invalid');
  requireText(record.id, 'recurrence identifier');
  const resolvedOwnerId = resolveOwner(record.owner_id, ownerId, 'recurrence owner');
  requireText(record.name, 'recurrence name');
  requirePositiveInteger(record.current_revision, 'recurrence current revision');
  requirePositiveInteger(record.record_revision, 'recurrence record revision');
  return {
    ...record,
    owner_id: resolvedOwnerId,
    status: requireEnum(record.status, taskRecurrenceStatuses, 'recurrence status'),
    last_mutation_channel: requireEnum(
      record.last_mutation_channel,
      taskEntryChannels,
      'recurrence mutation channel',
    ),
    last_actor_type: requireEnum(record.last_actor_type, taskActorTypes, 'recurrence actor'),
  } as TaskRecurrenceDefinition;
}

export function parseTaskRecurrenceRevision(
  value: unknown,
  ownerId?: string,
): TaskRecurrenceRevision {
  const record = requireRecord(value, 'Recurrence revision is invalid');
  requireText(record.id, 'recurrence revision identifier');
  const resolvedOwnerId = resolveOwner(
    record.owner_id,
    ownerId,
    'recurrence revision owner',
  );
  requireText(record.recurrence_id, 'recurrence identifier');
  requireText(record.template_id, 'recurrence template identifier');
  requirePositiveInteger(record.revision, 'recurrence revision');
  requirePositiveInteger(record.template_revision, 'recurrence template revision');
  requirePositiveInteger(record.interval_count, 'recurrence interval');
  requireCalendarDate(record.start_date, 'recurrence start date');
  requireText(record.planning_timezone, 'recurrence planning time zone');
  return {
    ...record,
    owner_id: resolvedOwnerId,
    rule_mode: requireEnum(record.rule_mode, taskRecurrenceRuleModes, 'recurrence mode'),
    frequency: requireEnum(record.frequency, taskRecurrenceFrequencies, 'recurrence frequency'),
    missed_policy: requireEnum(
      record.missed_policy,
      taskRecurrenceMissedPolicies,
      'recurrence missed policy',
    ),
  } as TaskRecurrenceRevision;
}

export function parseTaskRecurrenceOccurrence(
  value: unknown,
  ownerId?: string,
): TaskRecurrenceOccurrence {
  const record = requireRecord(value, 'Recurrence occurrence is invalid');
  requireText(record.id, 'occurrence identifier');
  const resolvedOwnerId = resolveOwner(record.owner_id, ownerId, 'occurrence owner');
  requireText(record.recurrence_id, 'recurrence identifier');
  requirePositiveInteger(record.recurrence_revision, 'occurrence revision');
  requireCalendarDate(record.scheduled_date, 'occurrence date');
  requireText(record.logical_key, 'occurrence logical key');
  requireText(record.root_id, 'occurrence root identifier');
  return {
    ...record,
    owner_id: resolvedOwnerId,
    root_type: requireEnum(record.root_type, taskTemplateKinds, 'occurrence root type'),
  } as TaskRecurrenceOccurrence;
}

function resolveOwner(value: unknown, ownerId: string | undefined, field: string): string {
  const resolved = value === undefined
    ? requireText(ownerId, field)
    : requireText(value, field);
  if (ownerId !== undefined && resolved !== ownerId) {
    throw new InvalidTaskRecurrenceError(
      'Recurrence owner does not match the authenticated owner',
    );
  }
  return resolved;
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  const parsed = typeof value === 'string' ? parseJson(value, message) : value;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidTaskRecurrenceError(message);
  }
  return parsed as Record<string, unknown>;
}

function requireArray(value: unknown, message: string): unknown[] {
  const parsed = typeof value === 'string' ? parseJson(value, message) : value;
  if (!Array.isArray(parsed)) throw new InvalidTaskRecurrenceError(message);
  return parsed;
}

function parseJson(value: string, message: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidTaskRecurrenceError(message);
  }
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidTaskRecurrenceError(`Invalid ${label}`);
  }
  return value;
}

function requireCalendarDate(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (!isTaskCalendarDate(text)) throw new InvalidTaskRecurrenceError(`Invalid ${label}`);
  return text;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new InvalidTaskRecurrenceError(`Invalid ${label}`);
  }
  return Number(value);
}

function requireEnum<T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new InvalidTaskRecurrenceError(`Invalid ${label}`);
  }
  return value as T[number];
}

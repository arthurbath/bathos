import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '@/modules/tasks/domain/taskDates';
import {
  taskActorTypes,
  taskEntryChannels,
  taskRecurrenceFrequencies,
  taskRecurrenceEndModes,
  taskRecurrenceMissedPolicies,
  taskRecurrenceOccurrenceOrigins,
  taskRecurrenceRuleModes,
  taskRecurrenceStatuses,
  type TaskRecurrenceDefinition,
  type TaskRecurrenceEndMode,
  type TaskRecurrenceFrequency,
  type TaskRecurrenceMissedPolicy,
  type TaskRecurrenceOccurrence,
  type TaskRecurrenceRevision,
  type TaskRecurrenceRuleMode,
  type TaskRecurrenceRuleConfig,
  type TaskRecurrencePrototypeSnapshot,
  type TaskRecurrenceStatus,
} from '@/modules/tasks/types/tasks';

type TaskRecurrenceClient = Pick<SupabaseClient<Database>, 'rpc'>;

export type TaskRecurrenceSaveResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  definition: TaskRecurrenceDefinition;
  revision?: TaskRecurrenceRevision;
};

export type TaskRecurrenceStatusResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  definition: TaskRecurrenceDefinition;
};

export type TaskRecurrenceReorderResult = {
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

export type TaskRecurrenceCreateFromTaskInput = {
  taskId: string;
  name: string;
  ruleMode: TaskRecurrenceRuleMode;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  scheduleDate: string;
  ruleConfig: TaskRecurrenceRuleConfig;
  endMode: TaskRecurrenceEndMode;
  endAfterCount?: number | null;
  endOnDate?: string | null;
  reminderLocalTime?: string | null;
  deadlineOffsetDays?: number | null;
  mutationId?: string;
};

export type TaskRecurrenceCreateFromTaskResult = TaskRecurrenceSaveResult & {
  occurrence: TaskRecurrenceOccurrence | null;
};

export type TaskRecurrenceEditInput = {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  name: string;
  ruleMode: TaskRecurrenceRuleMode;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  scheduleDate: string;
  ruleConfig: TaskRecurrenceRuleConfig;
  endMode: TaskRecurrenceEndMode;
  endAfterCount?: number | null;
  endOnDate?: string | null;
  reminderLocalTime?: string | null;
  deadlineOffsetDays?: number | null;
  prototypeSnapshot?: TaskRecurrencePrototypeSnapshot;
  targetAreaId?: string | null;
  mutationId?: string;
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

  async createFromTask(
    input: TaskRecurrenceCreateFromTaskInput,
  ): Promise<TaskRecurrenceCreateFromTaskResult> {
    const name = input.name.trim();
    if (
      !name
      || !isTaskCalendarDate(input.scheduleDate)
      || input.intervalCount < 1
      || (
        input.endMode === 'after'
        && (!Number.isInteger(input.endAfterCount) || Number(input.endAfterCount) < 1)
      )
      || (
        input.endMode === 'on_date'
        && !isTaskCalendarDate(input.endOnDate ?? '')
      )
    ) {
      throw new InvalidTaskRecurrenceError('A valid recurrence definition is required');
    }
    const { data, error } = await this.client.rpc('tasks_create_recurrence_from_task', {
      _task_id: input.taskId,
      _name: name,
      _rule_mode: input.ruleMode,
      _frequency: input.frequency,
      _interval_count: input.intervalCount,
      _schedule_date: input.scheduleDate,
      _rule_config: input.ruleConfig as unknown as Database['public']['Functions']['tasks_create_recurrence_from_task']['Args']['_rule_config'],
      _end_mode: input.endMode,
      _end_after_count: input.endMode === 'after' ? input.endAfterCount ?? null : null,
      _end_on_date: input.endMode === 'on_date' ? input.endOnDate ?? null : null,
      _reminder_local_time: input.reminderLocalTime ?? null,
      _deadline_offset_days: input.deadlineOffsetDays ?? null,
      _mutation_id: input.mutationId ?? crypto.randomUUID(),
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Recurrence creation returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied'] as const,
        'recurrence creation outcome',
      ),
      definition: parseTaskRecurrenceDefinition(result.definition, this.ownerId),
      revision: parseTaskRecurrenceRevision(result.revision, this.ownerId),
      occurrence: result.occurrence === null
        ? null
        : parseTaskRecurrenceOccurrence(result.occurrence, this.ownerId),
    };
  }

  async edit(input: TaskRecurrenceEditInput): Promise<TaskRecurrenceSaveResult> {
    const name = input.name.trim();
    if (
      !name
      || !isTaskCalendarDate(input.scheduleDate)
      || input.intervalCount < 1
      || (
        input.endMode === 'after'
        && (!Number.isInteger(input.endAfterCount) || Number(input.endAfterCount) < 1)
      )
      || (
        input.endMode === 'on_date'
        && !isTaskCalendarDate(input.endOnDate ?? '')
      )
    ) {
      throw new InvalidTaskRecurrenceError('A valid recurrence definition is required');
    }
    const { data, error } = await this.client.rpc('tasks_edit_recurrence', {
      _recurrence_id: input.definition.id,
      _expected_record_revision: input.definition.record_revision,
      _name: name,
      _rule_mode: input.ruleMode,
      _frequency: input.frequency,
      _interval_count: input.intervalCount,
      _start_date: input.scheduleDate,
      _planning_timezone: input.revision.planning_timezone,
      _missed_policy: input.revision.missed_policy,
      _catch_up_limit: input.revision.catch_up_limit,
      _target_area_id: (input.targetAreaId === undefined
        ? input.revision.target_area_id
        : input.targetAreaId) as unknown as string,
      _rule_config: input.ruleConfig as unknown as Database['public']['Functions']['tasks_edit_recurrence']['Args']['_rule_config'],
      _end_mode: input.endMode,
      _end_after_count: input.endMode === 'after' ? input.endAfterCount ?? null : null,
      _end_on_date: input.endMode === 'on_date' ? input.endOnDate ?? null : null,
      _reminder_local_time: input.reminderLocalTime ?? null,
      _deadline_offset_days: input.deadlineOffsetDays ?? null,
      _prototype_snapshot: (input.prototypeSnapshot
        ?? input.revision.prototype_snapshot) as unknown as Database['public']['Functions']['tasks_edit_recurrence']['Args']['_prototype_snapshot'],
      _mutation_id: input.mutationId ?? crypto.randomUUID(),
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Recurrence edit returned an invalid result');
    const outcome = requireEnum(
      result.outcome,
      ['accepted', 'already_applied', 'conflict'] as const,
      'recurrence edit outcome',
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

  async reorderProjection(
    definition: TaskRecurrenceDefinition,
    upcomingOrderKey: string,
    mutationId = crypto.randomUUID(),
  ): Promise<TaskRecurrenceReorderResult> {
    const orderKey = upcomingOrderKey.trim();
    if (!orderKey || orderKey.length > 200) {
      throw new InvalidTaskRecurrenceError('A valid Upcoming order is required');
    }
    const { data, error } = await this.client.rpc('tasks_reorder_recurrence_projection', {
      _recurrence_id: definition.id,
      _expected_record_revision: definition.record_revision,
      _upcoming_order_key: orderKey,
      _mutation_id: mutationId,
      _mutation_channel: 'web',
      _actor_type: 'user',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Recurrence reorder returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'conflict'] as const,
        'recurrence reorder outcome',
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
  requirePositiveInteger(record.revision, 'recurrence revision');
  requirePositiveInteger(record.interval_count, 'recurrence interval');
  requireCalendarDate(record.start_date, 'recurrence start');
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
    end_mode: requireEnum(
      record.end_mode ?? 'never',
      taskRecurrenceEndModes,
      'recurrence end mode',
    ),
    rule_config: parseRuleConfig(record.rule_config ?? {}),
    prototype_snapshot: parseTaskRecurrencePrototypeSnapshot(record.prototype_snapshot),
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
    root_type: requireEnum(record.root_type, ['todo'] as const, 'occurrence root type'),
    origin: requireEnum(
      record.origin ?? 'generated',
      taskRecurrenceOccurrenceOrigins,
      'occurrence origin',
    ),
  } as TaskRecurrenceOccurrence;
}

export function parseTaskRecurrencePrototypeSnapshot(
  value: unknown,
): TaskRecurrencePrototypeSnapshot {
  const snapshot = requireRecord(value, 'Recurrence prototype snapshot is invalid');
  if (snapshot.version !== 2 || snapshot.kind !== 'todo') {
    throw new InvalidTaskRecurrenceError('Recurrence prototype snapshot is unsupported');
  }
  const root = requireRecord(snapshot.root, 'Recurrence prototype task is invalid');
  requireText(root.node_id, 'recurrence prototype node');
  requireText(root.title, 'recurrence prototype summary');
  const checklist = requireArray(
    root.checklist ?? [],
    'Recurrence prototype checklist is invalid',
  ).map((item) => {
    const record = requireRecord(item, 'Recurrence prototype checklist item is invalid');
    requireText(record.node_id, 'recurrence prototype checklist node');
    requireText(record.title, 'recurrence prototype checklist item');
    requireText(record.order_key, 'recurrence prototype checklist order');
    if (typeof record.completed !== 'boolean') {
      throw new InvalidTaskRecurrenceError(
        'Recurrence prototype checklist completion is invalid',
      );
    }
    return {
      node_id: record.node_id as string,
      title: record.title as string,
      completed: record.completed,
      order_key: record.order_key as string,
    };
  });
  const startOffset = parseNullableInteger(
    root.start_offset_days,
    'recurrence prototype start offset',
  );
  const deadlineOffset = parseNullableInteger(
    root.deadline_offset_days,
    'recurrence prototype deadline offset',
  );
  return {
    version: 2,
    kind: 'todo',
    root: {
      node_id: root.node_id as string,
      title: root.title as string,
      notes: typeof root.notes === 'string' ? root.notes : '',
      primary_link: typeof root.primary_link === 'string' ? root.primary_link : null,
      actionability: requireEnum(
        root.actionability,
        ['actionable', 'waiting', 'rechecking'] as const,
        'recurrence prototype actionability',
      ),
      destination: requireEnum(
        root.destination,
        ['anytime', 'someday'] as const,
        'recurrence prototype destination',
      ),
      today_section: root.today_section === null
        ? null
        : requireEnum(
            root.today_section,
            ['inbox', 'now', 'next', 'later'] as const,
            'recurrence prototype horizon',
          ),
      order_key: requireText(root.order_key, 'recurrence prototype order'),
      ...(typeof root.hierarchy_order_key === 'string'
        ? { hierarchy_order_key: root.hierarchy_order_key }
        : {}),
      start_offset_days: startOffset,
      deadline_offset_days: deadlineOffset,
      checklist,
    },
  };
}

function parseNullableInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value)) {
    throw new InvalidTaskRecurrenceError(`${field} is invalid`);
  }
  return Number(value);
}

function parseRuleConfig(value: unknown): TaskRecurrenceRuleConfig {
  const record = value === null || value === undefined
    ? {}
    : requireRecord(value, 'Recurrence rule configuration is invalid');
  const weekdays = record.weekdays;
  if (
    weekdays !== undefined
    && (
      !Array.isArray(weekdays)
      || weekdays.some((day) => !Number.isInteger(day) || Number(day) < 1 || Number(day) > 7)
    )
  ) {
    throw new InvalidTaskRecurrenceError('Recurrence weekdays are invalid');
  }
  return {
    ...(Array.isArray(weekdays) ? { weekdays: weekdays.map(Number) } : {}),
    ...(
      record.monthly_kind === 'day_of_month'
      || record.monthly_kind === 'last_day'
      || record.monthly_kind === 'ordinal_weekday'
      || record.monthly_kind === 'ordinal_day_type'
      ? { monthly_kind: record.monthly_kind }
      : {}
    ),
    ...(
      record.yearly_kind === 'fixed_date'
      || record.yearly_kind === 'last_day'
      || record.yearly_kind === 'ordinal_weekday'
      ? { yearly_kind: record.yearly_kind }
      : {}
    ),
    ...(Number.isInteger(record.month) ? { month: Number(record.month) } : {}),
    ...(Number.isInteger(record.month_day) ? { month_day: Number(record.month_day) } : {}),
    ...(Number.isInteger(record.ordinal)
      ? { ordinal: Number(record.ordinal) as -1 | 1 | 2 | 3 | 4 | 5 }
      : {}),
    ...(Number.isInteger(record.weekday) ? { weekday: Number(record.weekday) } : {}),
    ...(record.day_type === 'weekday' || record.day_type === 'weekend_day'
      ? { day_type: record.day_type }
      : {}),
  };
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

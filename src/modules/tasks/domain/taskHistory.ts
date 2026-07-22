import type { Tables } from '@/integrations/supabase/types';
import {
  taskActorTypes,
  taskActionabilities,
  taskDestinations,
  taskEntryChannels,
  taskMutationTransitions,
  taskSourceKinds,
  taskTodaySections,
  type TaskActorType,
  type TaskActionability,
  type TaskDestination,
  type TaskEntryChannel,
  type TaskMutationTransition,
  type TaskSourceKind,
  type TaskTodaySection,
  type TaskTodo,
} from '@/modules/tasks/types/tasks';

export type TaskHistorySnapshot = Pick<
  TaskTodo,
  | 'title'
  | 'actionability'
  | 'notes'
  | 'lifecycle'
  | 'completed_at'
  | 'canceled_at'
  | 'disposition'
  | 'deleted_at'
  | 'deletion_root_id'
  | 'destination'
  | 'today_section'
  | 'order_key'
  | 'area_id'
  | 'project_id'
  | 'heading_id'
  | 'hierarchy_order_key'
  | 'start_date'
  | 'deadline'
  | 'source_kind'
  | 'source_url'
  | 'source_title'
  | 'source_external_id'
>;

export type TaskHistoryEvent = {
  id: string;
  owner_id: string;
  task_id: string;
  client_mutation_id: string;
  actor_type: TaskActorType;
  mutation_channel: TaskEntryChannel;
  affected_ids: string[];
  base_revision: number;
  result_revision: number;
  transition: TaskMutationTransition;
  occurred_at: string;
  outcome: 'accepted';
  code: string | null;
  before_state: TaskHistorySnapshot | null;
  after_state: TaskHistorySnapshot;
};

export type TaskHistoryStorageRow = Omit<
  Tables<'tasks_history_events'>,
  'actor_type' | 'affected_ids' | 'after_state' | 'before_state' | 'mutation_channel' | 'transition'
> & {
  actor_type: unknown;
  affected_ids: unknown;
  after_state: unknown;
  before_state: unknown;
  mutation_channel: unknown;
  transition: unknown;
};

export class InvalidTaskHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskHistoryError';
  }
}

export class UnsafeTaskUndoError extends Error {
  constructor(message = 'The requested undo is no longer safe') {
    super(message);
    this.name = 'UnsafeTaskUndoError';
  }
}

export function parseTaskHistoryEvent(row: TaskHistoryStorageRow): TaskHistoryEvent {
  return {
    ...row,
    actor_type: requireEnum(row.actor_type, taskActorTypes, 'actor type'),
    mutation_channel: requireEnum(row.mutation_channel, taskEntryChannels, 'mutation channel'),
    affected_ids: parseStringArray(row.affected_ids),
    transition: requireEnum(row.transition, taskMutationTransitions, 'transition'),
    outcome: requireAccepted(row.outcome),
    before_state: row.before_state === null ? null : parseTaskHistorySnapshot(row.before_state),
    after_state: parseTaskHistorySnapshot(row.after_state),
  };
}

export function createTaskUndoPatch(
  current: TaskTodo,
  event: TaskHistoryEvent,
): TaskHistorySnapshot {
  if (
    event.owner_id !== current.owner_id
    || event.task_id !== current.id
    || event.outcome !== 'accepted'
    || event.transition === 'baseline'
    || event.transition === 'create'
    || event.result_revision !== current.revision
    || event.before_state === null
    || !snapshotsEqual(event.after_state, snapshotTask(current))
  ) {
    throw new UnsafeTaskUndoError();
  }

  return event.before_state;
}

export function snapshotTask(task: TaskTodo): TaskHistorySnapshot {
  return {
    title: task.title,
    actionability: task.actionability ?? 'actionable',
    notes: task.notes,
    lifecycle: task.lifecycle,
    completed_at: task.completed_at,
    canceled_at: task.canceled_at,
    disposition: task.disposition,
    deleted_at: task.deleted_at,
    deletion_root_id: task.deletion_root_id ?? null,
    destination: task.destination,
    today_section: task.today_section,
    order_key: task.order_key,
    area_id: task.area_id ?? null,
    project_id: task.project_id ?? null,
    heading_id: task.heading_id ?? null,
    hierarchy_order_key: task.hierarchy_order_key ?? null,
    start_date: task.start_date ?? null,
    deadline: task.deadline ?? null,
    source_kind: task.source_kind,
    source_url: task.source_url,
    source_title: task.source_title,
    source_external_id: task.source_external_id,
  };
}

function parseTaskHistorySnapshot(value: unknown): TaskHistorySnapshot {
  const parsed = parseJson(value);
  if (!isRecord(parsed)) {
    throw new InvalidTaskHistoryError('Task history contains an invalid state snapshot');
  }
  const legacyDestination = requireText(parsed.destination, 'destination');
  const destination = legacyDestination === 'inbox' || legacyDestination === 'today'
    ? 'anytime'
    : requireEnum(legacyDestination, taskDestinations, 'destination') as TaskDestination;
  const legacyTodaySection = parsed.today_section === undefined
    ? 'daytime'
    : requireText(parsed.today_section, 'Today section');
  const todaySection = legacyDestination === 'inbox'
    ? 'later'
    : legacyDestination === 'today'
      ? legacyTodaySection === 'evening' ? 'later' : 'next'
      : legacyTodaySection === 'daytime' || legacyTodaySection === 'evening'
        ? 'none'
        : requireEnum(
          legacyTodaySection,
          taskTodaySections,
          'Today section',
        ) as TaskTodaySection;

  return {
    title: requireText(parsed.title, 'title'),
    actionability: parsed.actionability === undefined
      ? 'actionable'
      : requireEnum(
        parsed.actionability,
        taskActionabilities,
        'actionability',
      ) as TaskActionability,
    notes: requireText(parsed.notes, 'notes', true),
    lifecycle: requireEnum(parsed.lifecycle, ['open', 'completed', 'canceled'] as const, 'lifecycle'),
    completed_at: optionalText(parsed.completed_at, 'completed_at'),
    canceled_at: optionalText(parsed.canceled_at, 'canceled_at'),
    disposition: requireEnum(parsed.disposition, ['present', 'deleted'] as const, 'disposition'),
    deleted_at: optionalText(parsed.deleted_at, 'deleted_at'),
    deletion_root_id: optionalTextOrMissing(parsed.deletion_root_id, 'deletion_root_id'),
    destination,
    today_section: todaySection,
    order_key: requireText(parsed.order_key, 'order_key'),
    area_id: optionalTextOrMissing(parsed.area_id, 'area_id'),
    project_id: optionalTextOrMissing(parsed.project_id, 'project_id'),
    heading_id: optionalTextOrMissing(parsed.heading_id, 'heading_id'),
    hierarchy_order_key: optionalTextOrMissing(
      parsed.hierarchy_order_key,
      'hierarchy_order_key',
    ),
    start_date: optionalTextOrMissing(parsed.start_date, 'start_date'),
    deadline: optionalTextOrMissing(parsed.deadline, 'deadline'),
    source_kind: parsed.source_kind === null
      ? null
      : requireEnum(parsed.source_kind, taskSourceKinds, 'source kind') as TaskSourceKind,
    source_url: optionalText(parsed.source_url, 'source_url'),
    source_title: optionalText(parsed.source_title, 'source_title'),
    source_external_id: optionalText(parsed.source_external_id, 'source_external_id'),
  };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidTaskHistoryError('Task history contains malformed JSON');
  }
}

function parseStringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some((item) => typeof item !== 'string')) {
    throw new InvalidTaskHistoryError('Task history contains invalid affected identifiers');
  }
  return parsed;
}

function requireAccepted(value: unknown): 'accepted' {
  if (value !== 'accepted') {
    throw new InvalidTaskHistoryError('Task history contains an unsupported mutation outcome');
  }
  return value;
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new InvalidTaskHistoryError(`Task history contains an invalid ${field}`);
  }
  return value as T[number];
}

function requireText(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new InvalidTaskHistoryError(`Task history contains an invalid ${field}`);
  }
  return value;
}

function optionalText(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  return requireText(value, field, true);
}

function optionalTextOrMissing(value: unknown, field: string): string | null {
  if (value === undefined) {
    return null;
  }
  return optionalText(value, field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotsEqual(left: TaskHistorySnapshot, right: TaskHistorySnapshot): boolean {
  return left.title === right.title
    && left.actionability === right.actionability
    && left.notes === right.notes
    && left.lifecycle === right.lifecycle
    && left.completed_at === right.completed_at
    && left.canceled_at === right.canceled_at
    && left.disposition === right.disposition
    && left.deleted_at === right.deleted_at
    && left.deletion_root_id === right.deletion_root_id
    && left.destination === right.destination
    && left.today_section === right.today_section
    && left.order_key === right.order_key
    && left.area_id === right.area_id
    && left.project_id === right.project_id
    && left.heading_id === right.heading_id
    && left.hierarchy_order_key === right.hierarchy_order_key
    && left.start_date === right.start_date
    && left.deadline === right.deadline
    && left.source_kind === right.source_kind
    && left.source_url === right.source_url
    && left.source_title === right.source_title
    && left.source_external_id === right.source_external_id;
}

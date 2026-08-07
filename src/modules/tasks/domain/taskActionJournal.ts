import { snapshotTask, type TaskHistorySnapshot } from '@/modules/tasks/domain/taskHistory';
import {
  taskActionabilities,
  taskDestinations,
  taskSourceKinds,
  taskTodaySections,
  type TaskChecklistItem,
  type TaskTodo,
} from '@/modules/tasks/types/tasks';

export const TASK_ACTION_JOURNAL_SNAPSHOT_VERSION = 1;
export const TASK_ACTION_JOURNAL_RETENTION_MS = 30 * 60 * 1_000;
export const TASK_ACTION_JOURNAL_LIMIT = 100;

export type TaskChecklistHistorySnapshot = Pick<
  TaskChecklistItem,
  | 'task_id'
  | 'title'
  | 'completed'
  | 'completed_at'
  | 'order_key'
>;

export type TaskActionJournalChange =
  | {
      entityType: 'task';
      entityId: string;
      before: TaskHistorySnapshot | null;
      after: TaskHistorySnapshot | null;
    }
  | {
      entityType: 'checklist_item';
      entityId: string;
      before: TaskChecklistHistorySnapshot | null;
      after: TaskChecklistHistorySnapshot | null;
    };

export type TaskActionJournalState = 'applied' | 'undone';

export type TaskActionJournalEntry = {
  id: string;
  owner_id: string;
  sequence: number;
  action_id: string;
  occurred_at: string;
  expires_at: string;
  state: TaskActionJournalState;
  snapshot_version: number;
  changes: TaskActionJournalChange[];
};

export type TaskActionJournalStorageRow = Omit<TaskActionJournalEntry, 'changes'> & {
  changes: unknown;
};

export class InvalidTaskActionJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskActionJournalError';
  }
}

export function taskJournalSnapshot(task: TaskTodo): TaskHistorySnapshot | null {
  return task.disposition === 'present' ? snapshotTask(task) : null;
}

export function checklistJournalSnapshot(
  item: TaskChecklistItem,
): TaskChecklistHistorySnapshot | null {
  if (item.disposition !== 'present') return null;
  return {
    task_id: item.task_id,
    title: item.title,
    completed: Boolean(item.completed),
    completed_at: item.completed_at,
    order_key: item.order_key,
  };
}

export function taskJournalSnapshotsEqual(
  left: TaskHistorySnapshot | null,
  right: TaskHistorySnapshot | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function checklistJournalSnapshotsEqual(
  left: TaskChecklistHistorySnapshot | null,
  right: TaskChecklistHistorySnapshot | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function parseTaskActionJournalEntry(
  row: TaskActionJournalStorageRow,
): TaskActionJournalEntry {
  if (row.snapshot_version !== TASK_ACTION_JOURNAL_SNAPSHOT_VERSION) {
    throw new InvalidTaskActionJournalError('The task action uses an unsupported snapshot version');
  }
  const parsed = typeof row.changes === 'string'
    ? safeParse(row.changes)
    : row.changes;
  if (!Array.isArray(parsed) || !parsed.every(isJournalChange)) {
    throw new InvalidTaskActionJournalError('The task action contains invalid changes');
  }
  return { ...row, changes: parsed };
}

function isJournalChange(value: unknown): value is TaskActionJournalChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.entityId !== 'string') return false;
  if (candidate.entityType === 'task') {
    return isNullableSnapshot(candidate.before, isTaskSnapshot)
      && isNullableSnapshot(candidate.after, isTaskSnapshot);
  }
  if (candidate.entityType === 'checklist_item') {
    return isNullableSnapshot(candidate.before, isChecklistSnapshot)
      && isNullableSnapshot(candidate.after, isChecklistSnapshot);
  }
  return false;
}

function isNullableSnapshot<T>(value: unknown, guard: (candidate: unknown) => candidate is T) {
  return value === null || guard(value);
}

function isTaskSnapshot(value: unknown): value is TaskHistorySnapshot {
  if (!isRecord(value)) return false;
  return typeof value.title === 'string'
    && isOneOf(value.actionability, taskActionabilities)
    && typeof value.notes === 'string'
    && isOneOf(value.lifecycle, ['open', 'completed', 'canceled'])
    && isNullableString(value.completed_at)
    && isNullableString(value.canceled_at)
    && isOneOf(value.disposition, ['present', 'deleted'])
    && isNullableString(value.deleted_at)
    && isNullableString(value.deletion_root_id)
    && isOneOf(value.destination, taskDestinations)
    && isNullableOneOf(value.today_section, taskTodaySections)
    && typeof value.order_key === 'string'
    && isNullableString(value.area_id)
    && isNullableString(value.hierarchy_order_key)
    && isNullableString(value.start_date)
    && isNullableString(value.deadline)
    && isNullableString(value.primary_link)
    && isNullableOneOf(value.source_kind, taskSourceKinds)
    && isNullableString(value.source_url)
    && isNullableString(value.source_title)
    && isNullableString(value.source_external_id);
}

function isChecklistSnapshot(value: unknown): value is TaskChecklistHistorySnapshot {
  return isRecord(value)
    && typeof value.task_id === 'string'
    && typeof value.title === 'string'
    && typeof value.completed === 'boolean'
    && isNullableString(value.completed_at)
    && typeof value.order_key === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isOneOf(value: unknown, options: readonly string[]): value is string {
  return typeof value === 'string' && options.includes(value);
}

function isNullableOneOf(value: unknown, options: readonly string[]): value is string | null {
  return value === null || isOneOf(value, options);
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

import {
  isTaskCalendarDate,
  isTaskPlanningTimeZone,
} from '@/modules/tasks/domain/taskDates';
import {
  taskActionabilities,
  taskDestinations,
  taskRecurrenceFrequencies,
  taskRecurrenceMissedPolicies,
  taskRecurrenceRuleModes,
  taskRecurrenceStatuses,
  taskReminderAmbiguityChoices,
  taskTodaySections,
  type TaskActionability,
  type TaskDestination,
  type TaskRecurrenceFrequency,
  type TaskRecurrenceMissedPolicy,
  type TaskRecurrenceRuleMode,
  type TaskRecurrenceStatus,
  type TaskReminderAmbiguityChoice,
  type TaskTodaySection,
} from '@/modules/tasks/types/tasks';

export const TASK_CLIPBOARD_KIND = 'garden.bath.tasks.clipboard';
export const TASK_CLIPBOARD_VERSION = 1;
export const TASK_CLIPBOARD_MAX_TASKS = 100;
export const TASK_CLIPBOARD_MAX_BYTES = 1_000_000;

export type TaskClipboardChecklistItem = {
  title: string;
  completed: boolean;
  orderKey: string;
};

export type TaskClipboardReminder = {
  localTime: string;
  timeZone: string;
  ambiguityChoice: TaskReminderAmbiguityChoice;
};

export type TaskClipboardRecurrence = {
  name: string;
  status: TaskRecurrenceStatus;
  templateId: string;
  templateRevision: number;
  ruleMode: TaskRecurrenceRuleMode;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  startDate: string;
  planningTimeZone: string;
  missedPolicy: TaskRecurrenceMissedPolicy;
  catchUpLimit: number;
  targetAreaId: string | null;
};

export type TaskClipboardSnapshot = {
  title: string;
  notes: string;
  primaryLink: string | null;
  destination: TaskDestination;
  todaySection: TaskTodaySection | null;
  startDate: string | null;
  deadline: string | null;
  actionability: TaskActionability;
  areaId: string | null;
  projectId: string | null;
  checklist: TaskClipboardChecklistItem[];
  reminder: TaskClipboardReminder | null;
  recurrence: TaskClipboardRecurrence | null;
};

export type TaskClipboardEnvelope = {
  kind: typeof TASK_CLIPBOARD_KIND;
  version: typeof TASK_CLIPBOARD_VERSION;
  operation: 'copy' | 'cut';
  tasks: TaskClipboardSnapshot[];
};

export type TaskClipboardDestination =
  | { kind: 'today' }
  | { kind: 'anytime' }
  | { kind: 'someday' }
  | { kind: 'area'; areaId: string }
  | { kind: 'project'; areaId: string | null; projectId: string };

export type TaskClipboardCreatePlan = TaskClipboardSnapshot & {
  destination: TaskDestination;
  todaySection: TaskTodaySection | null;
  startDate: string | null;
  areaId: string | null;
  projectId: string | null;
};

export type ParsedTaskClipboard =
  | { kind: 'tasks'; envelope: TaskClipboardEnvelope }
  | { kind: 'text'; title: string }
  | { kind: 'invalid-task-payload'; reason: string }
  | { kind: 'empty' };

export function serializeTaskClipboard(
  operation: TaskClipboardEnvelope['operation'],
  tasks: readonly TaskClipboardSnapshot[],
): string {
  if (tasks.length < 1 || tasks.length > TASK_CLIPBOARD_MAX_TASKS) {
    throw new Error(`Task clipboard requires 1-${TASK_CLIPBOARD_MAX_TASKS} tasks`);
  }
  const envelope: TaskClipboardEnvelope = {
    kind: TASK_CLIPBOARD_KIND,
    version: TASK_CLIPBOARD_VERSION,
    operation,
    tasks: [...tasks],
  };
  const serialized = JSON.stringify(envelope);
  if (new TextEncoder().encode(serialized).byteLength > TASK_CLIPBOARD_MAX_BYTES) {
    throw new Error('Task clipboard payload is too large');
  }
  return serialized;
}

export function parseTaskClipboard(text: string): ParsedTaskClipboard {
  if (!text.trim()) return { kind: 'empty' };
  if (new TextEncoder().encode(text).byteLength > TASK_CLIPBOARD_MAX_BYTES) {
    return text.includes(TASK_CLIPBOARD_KIND)
      ? { kind: 'invalid-task-payload', reason: 'Task clipboard payload is too large' }
      : { kind: 'text', title: text };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'text', title: text };
  }
  if (!isRecord(value) || value.kind !== TASK_CLIPBOARD_KIND) {
    return { kind: 'text', title: text };
  }

  try {
    if (value.version !== TASK_CLIPBOARD_VERSION) {
      throw new Error('Task clipboard version is not supported');
    }
    if (value.operation !== 'copy' && value.operation !== 'cut') {
      throw new Error('Task clipboard operation is invalid');
    }
    if (
      !Array.isArray(value.tasks)
      || value.tasks.length < 1
      || value.tasks.length > TASK_CLIPBOARD_MAX_TASKS
    ) {
      throw new Error('Task clipboard task count is invalid');
    }
    return {
      kind: 'tasks',
      envelope: {
        kind: TASK_CLIPBOARD_KIND,
        version: TASK_CLIPBOARD_VERSION,
        operation: value.operation,
        tasks: value.tasks.map(parseSnapshot),
      },
    };
  } catch (error) {
    return {
      kind: 'invalid-task-payload',
      reason: error instanceof Error ? error.message : 'Task clipboard payload is invalid',
    };
  }
}

export function planTaskClipboardPaste(
  snapshot: TaskClipboardSnapshot,
  destination: TaskClipboardDestination,
  options: { now?: Date; planningTimeZone: string },
): TaskClipboardCreatePlan {
  const organization = destination.kind === 'project'
    ? { areaId: null, projectId: destination.projectId }
    : destination.kind === 'area'
      ? { areaId: destination.areaId, projectId: null }
      : { areaId: snapshot.areaId, projectId: snapshot.projectId };
  const planning = destination.kind === 'today'
    ? { destination: 'anytime' as const, todaySection: 'inbox' as const, startDate: null }
    : destination.kind === 'someday'
      ? { destination: 'someday' as const, todaySection: null, startDate: null }
      : destination.kind === 'anytime'
        ? { destination: 'anytime' as const, todaySection: null, startDate: null }
        : {
          destination: snapshot.destination,
          todaySection: snapshot.todaySection,
          startDate: snapshot.startDate,
        };

  const reminder = planning.todaySection === 'inbox'
    && snapshot.reminder !== null
    && reminderTimeIsFuture(
      snapshot.reminder.localTime,
      options.planningTimeZone,
      options.now ?? new Date(),
    )
      ? snapshot.reminder
      : planning.startDate !== null || planning.todaySection !== null
        ? snapshot.reminder
        : null;
  const recurrence = snapshot.recurrence === null
    ? null
    : destination.kind === 'project' || destination.kind === 'area'
      ? {
        ...snapshot.recurrence,
        targetAreaId: destination.areaId,
      }
      : snapshot.recurrence;

  return {
    ...snapshot,
    ...organization,
    ...planning,
    reminder,
    recurrence,
  };
}

function parseSnapshot(value: unknown): TaskClipboardSnapshot {
  const row = requireRecord(value, 'Task snapshot is invalid');
  const title = requireText(row.title, 'Task Title', 500);
  const notes = requireString(row.notes, 'Task Notes', 100_000);
  const primaryLink = requireNullableString(row.primaryLink, 'Task Primary Link', 10_000);
  const destination = requireEnum(row.destination, taskDestinations, 'Task destination');
  const todaySection = requireNullableEnum(
    row.todaySection,
    taskTodaySections,
    'Task day horizon',
  );
  const startDate = requireNullableDate(row.startDate, 'Task Start');
  const deadline = requireNullableDate(row.deadline, 'Task Deadline');
  const actionability = requireEnum(
    row.actionability,
    taskActionabilities,
    'Task actionability',
  );
  const areaId = requireNullableId(row.areaId, 'Task area');
  const projectId = requireNullableId(row.projectId, 'Task project');
  if (!Array.isArray(row.checklist) || row.checklist.length > 500) {
    throw new Error('Task checklist is invalid');
  }
  const checklist = row.checklist.map((item) => {
    const checklistItem = requireRecord(item, 'Checklist item is invalid');
    if (typeof checklistItem.completed !== 'boolean') {
      throw new Error('Checklist completion is invalid');
    }
    return {
      title: requireText(checklistItem.title, 'Checklist Title', 500),
      completed: checklistItem.completed,
      orderKey: requireText(checklistItem.orderKey, 'Checklist order', 500),
    };
  });
  return {
    title,
    notes,
    primaryLink,
    destination,
    todaySection,
    startDate,
    deadline,
    actionability,
    areaId,
    projectId,
    checklist,
    reminder: row.reminder === null ? null : parseReminder(row.reminder),
    recurrence: row.recurrence === null ? null : parseRecurrence(row.recurrence),
  };
}

function parseReminder(value: unknown): TaskClipboardReminder {
  const row = requireRecord(value, 'Task reminder is invalid');
  const timeZone = requireText(row.timeZone, 'Reminder time zone', 200);
  if (!isTaskPlanningTimeZone(timeZone)) throw new Error('Reminder time zone is invalid');
  return {
    localTime: requireTime(row.localTime, 'Reminder time'),
    timeZone,
    ambiguityChoice: requireEnum(
      row.ambiguityChoice,
      taskReminderAmbiguityChoices,
      'Reminder ambiguity',
    ),
  };
}

function parseRecurrence(value: unknown): TaskClipboardRecurrence {
  const row = requireRecord(value, 'Task recurrence is invalid');
  const planningTimeZone = requireText(
    row.planningTimeZone,
    'Recurrence planning time zone',
    200,
  );
  if (!isTaskPlanningTimeZone(planningTimeZone)) {
    throw new Error('Recurrence planning time zone is invalid');
  }
  return {
    name: requireText(row.name, 'Recurrence name', 500),
    status: requireEnum(row.status, taskRecurrenceStatuses, 'Recurrence status'),
    templateId: requireId(row.templateId, 'Recurrence template'),
    templateRevision: requireInteger(row.templateRevision, 'Recurrence template revision', 1, 1_000_000),
    ruleMode: requireEnum(row.ruleMode, taskRecurrenceRuleModes, 'Recurrence mode'),
    frequency: requireEnum(row.frequency, taskRecurrenceFrequencies, 'Recurrence frequency'),
    intervalCount: requireInteger(row.intervalCount, 'Recurrence interval', 1, 1_000),
    startDate: requireDate(row.startDate, 'Recurrence Start'),
    planningTimeZone,
    missedPolicy: requireEnum(
      row.missedPolicy,
      taskRecurrenceMissedPolicies,
      'Recurrence missed policy',
    ),
    catchUpLimit: requireInteger(row.catchUpLimit, 'Recurrence catch-up limit', 1, 10_000),
    targetAreaId: requireNullableId(row.targetAreaId, 'Recurrence area'),
  };
}

function reminderTimeIsFuture(localTime: string, timeZone: string, now: Date): boolean {
  if (!isTaskPlanningTimeZone(timeZone) || Number.isNaN(now.valueOf())) return false;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(localTime);
  if (!match) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return Number(match[1]) * 60 + Number(match[2]) > values.hour * 60 + values.minute;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(label);
  return value;
}

function requireString(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} is invalid`);
  return value;
}

function requireText(value: unknown, label: string, max: number): string {
  const text = requireString(value, label, max);
  if (!text.trim()) throw new Error(`${label} is required`);
  return text;
}

function requireNullableString(value: unknown, label: string, max: number): string | null {
  return value === null ? null : requireString(value, label, max);
}

function requireId(value: unknown, label: string): string {
  const id = requireText(value, label, 200);
  if (!/^[0-9a-f-]{8,}$/i.test(id)) throw new Error(`${label} is invalid`);
  return id;
}

function requireNullableId(value: unknown, label: string): string | null {
  return value === null ? null : requireId(value, label);
}

function requireDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isTaskCalendarDate(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function requireNullableDate(value: unknown, label: string): string | null {
  return value === null ? null : requireDate(value, label);
}

function requireTime(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function requireInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${label} is invalid`);
  }
  return Number(value);
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value as T[number];
}

function requireNullableEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] | null {
  return value === null ? null : requireEnum(value, allowed, label);
}

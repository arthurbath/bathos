import { deriveTaskAreaSections } from '@/modules/tasks/domain/taskAreaViews';
import {
  taskMatchesQuickFilter,
  type TaskQuickFilter,
} from '@/modules/tasks/domain/taskQuickFilters';
import {
  deriveTaskViewTasks,
  type TaskListView,
} from '@/modules/tasks/hooks/useTaskList';
import {
  getTaskUpcomingDate,
  getTaskUpcomingGroup,
} from '@/modules/tasks/domain/taskUpcoming';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';
import type {
  TaskActionability,
  TaskArea,
  TaskRecurrenceDefinition,
  TaskRecurrenceRevision,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import type { TaskLifecycle } from '@/modules/tasks/domain/taskState';
import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkKind,
  type TaskPrimaryLinkKind,
} from '@/modules/tasks/domain/taskPrimaryLink';
import {
  getTasksNativeMessageHandler,
  getTasksNativeInstallationId,
  TASKS_NATIVE_BRIDGE_HANDLER,
} from '@/platform/native/tasksNativeCompanion';

export const TASK_NATIVE_WIDGET_SCHEMA_VERSION = 2;
export const TASK_NATIVE_WIDGET_LIST_LIMIT = 50;
export const TASK_NATIVE_WIDGET_BRIDGE_HANDLER = TASKS_NATIVE_BRIDGE_HANDLER;
export const TASK_NATIVE_TASK_QUERY_PARAMETER = 'native_task';
export const TASK_NATIVE_NEW_TASK_QUERY_PARAMETER = 'native_new_task';
export const TASK_NATIVE_QUICK_ENTRY_QUERY_PARAMETER = 'native_quick_entry';
export type TaskNativeNewTaskSignal = 'today-inbox' | 'current-list';

export const taskNativeWidgetListIds = [
  'today',
  'upcoming',
  'anytime',
  'someday',
  'done',
] as const;

export type TaskNativeWidgetListId = (typeof taskNativeWidgetListIds)[number];

export type TaskNativeWidgetTask = {
  id: string;
  summary: string;
  deadline: string | null;
  todaySection: TaskTodaySection | null;
  actionability: TaskActionability;
  terminalState: Exclude<TaskLifecycle, 'open'> | 'deleted' | null;
  upcomingDate: string | null;
  isRecurrenceProjection: boolean;
  primaryLink: {
    href: string;
    kind: TaskPrimaryLinkKind;
  } | null;
};

export type TaskNativeWidgetList = {
  id: TaskNativeWidgetListId;
  title: string;
  totalCount: number;
  truncated: boolean;
  tasks: TaskNativeWidgetTask[];
};

export type TaskNativeWidgetSnapshot = {
  type: 'snapshot';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
  ownerId: string;
  generatedAt: string;
  planningDate: string;
  lists: TaskNativeWidgetList[];
};

export type TaskNativeWidgetClearMessage = {
  type: 'clear';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
};

export type TaskNativeWidgetCredentialMessage = {
  type: 'credential';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
  ownerId: string;
  installationId: string;
  credential: string;
  expiresAt: string;
};

export type TaskNativeNewTaskSummaryFocusMessage = {
  type: 'focus-new-task-summary';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
};

export type TaskNativeContentReadyMessage = {
  type: 'content-ready';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
};

export type TaskNativeQuickEntryReadyMessage = {
  type: 'quick-entry-ready';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
};

export type TaskNativeQuickEntryDismissalMessage = {
  type: 'quick-entry-dismiss-requested';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
};

export type TaskNativeQuickEntryShortcut = {
  code: string;
  command: boolean;
  control: boolean;
  option: boolean;
  shift: boolean;
};

export type TaskNativeQuickEntryShortcutMessage = {
  type: 'configure-quick-entry-shortcut';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
  shortcut: TaskNativeQuickEntryShortcut;
};

export type TaskNativeQuickEntryShortcutClearMessage = {
  type: 'clear-quick-entry-shortcut';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
};

export type TaskNativeQuickEntryFinishedMessage = {
  type: 'quick-entry-finished';
  schemaVersion: typeof TASK_NATIVE_WIDGET_SCHEMA_VERSION;
  committed: boolean;
};

type BuildTaskNativeWidgetSnapshotInput = {
  ownerId: string;
  planningDate: string;
  tasks: readonly TaskTodo[];
  areas: readonly TaskArea[];
  automaticListSorting: boolean;
  quickFilter: TaskQuickFilter;
  recurrencePrototypes?: ReadonlyArray<{
    definition: TaskRecurrenceDefinition;
    revision: TaskRecurrenceRevision;
    scheduledDate: string;
  }>;
  generatedAt?: string;
  listLimit?: number;
};

const taskNativeWidgetListTitles: Record<TaskNativeWidgetListId, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  anytime: 'Anytime',
  someday: 'Someday',
  done: 'Done',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let lastPublishedContent: string | null = null;

export function buildTaskNativeWidgetSnapshot({
  ownerId,
  planningDate,
  tasks,
  areas,
  automaticListSorting,
  quickFilter,
  recurrencePrototypes = [],
  generatedAt = new Date().toISOString(),
  listLimit = TASK_NATIVE_WIDGET_LIST_LIMIT,
}: BuildTaskNativeWidgetSnapshotInput): TaskNativeWidgetSnapshot {
  const safeLimit = Number.isSafeInteger(listLimit)
    ? Math.max(1, Math.min(listLimit, TASK_NATIVE_WIDGET_LIST_LIMIT))
    : TASK_NATIVE_WIDGET_LIST_LIMIT;

  return {
    type: 'snapshot',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
    ownerId,
    generatedAt,
    planningDate,
    lists: taskNativeWidgetListIds.map((id) => {
      const projected = deriveTaskViewTasks(
        tasks,
        ownerId,
        id satisfies TaskListView,
        planningDate,
      );
      const ordered = id === 'anytime' || id === 'someday'
        ? deriveTaskAreaSections(projected, areas, automaticListSorting)
          .flatMap((section) => section.tasks)
        : projected;
      const filtered = quickFilter === 'all'
        ? ordered
        : ordered.filter((task) => taskMatchesQuickFilter(
          task.actionability,
          quickFilter,
        ));

      const widgetTasks = filtered.map((task) => (
        toTaskNativeWidgetTask(task, id, planningDate)
      ));
      if (id === 'upcoming') {
        const upcomingOrderKeys = new Map(filtered.map((task) => [
          task.id,
          task.upcoming_order_key ?? task.order_key,
        ]));
        widgetTasks.push(...recurrencePrototypes
          .filter(({ revision }) => (
            quickFilter === 'all'
            || taskMatchesQuickFilter(
              revision.prototype_snapshot.root.actionability,
              quickFilter,
            )
          ))
          .map((prototype) => {
            upcomingOrderKeys.set(
              prototype.definition.id,
              prototype.definition.upcoming_order_key
                ?? prototype.revision.prototype_snapshot.root.order_key,
            );
            return toTaskNativeWidgetRecurrencePrototype(prototype);
          }));
        widgetTasks.sort((left, right) => (
          getTaskUpcomingGroup(
            left.upcomingDate ?? planningDate,
            planningDate,
          ).date.localeCompare(getTaskUpcomingGroup(
            right.upcomingDate ?? planningDate,
            planningDate,
          ).date)
          || (upcomingOrderKeys.get(left.id) ?? '').localeCompare(
            upcomingOrderKeys.get(right.id) ?? '',
          )
          || left.id.localeCompare(right.id)
        ));
      }

      return {
        id,
        title: taskNativeWidgetListTitles[id],
        totalCount: widgetTasks.length,
        truncated: widgetTasks.length > safeLimit,
        tasks: widgetTasks.slice(0, safeLimit),
      };
    }),
  };
}

export function publishTaskNativeWidgetSnapshot(
  snapshot: TaskNativeWidgetSnapshot,
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler) return false;

  const message = getTasksNativeInstallationId(target)
    ? snapshot
    : toLegacyTaskNativeWidgetSnapshot(snapshot);
  const content = JSON.stringify({
    ...message,
    generatedAt: null,
  });
  if (content === lastPublishedContent) return false;

  handler.postMessage(message);
  lastPublishedContent = content;
  return true;
}

export function clearTaskNativeWidgetCache(target: Window = window): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler) return false;
  handler.postMessage({
    type: 'clear',
    schemaVersion: getTasksNativeInstallationId(target)
      ? TASK_NATIVE_WIDGET_SCHEMA_VERSION
      : 1,
  });
  lastPublishedContent = null;
  return true;
}

export function publishTaskNativeWidgetCredential(
  message: Omit<TaskNativeWidgetCredentialMessage, 'type' | 'schemaVersion'>,
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler) return false;
  handler.postMessage({
    type: 'credential',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
    ...message,
  } satisfies TaskNativeWidgetCredentialMessage);
  return true;
}

export function requestTaskNativeNewTaskSummaryFocus(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'focus-new-task-summary',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
  } satisfies TaskNativeNewTaskSummaryFocusMessage);
  return true;
}

export function publishTaskNativeContentReady(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'content-ready',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
  } satisfies TaskNativeContentReadyMessage);
  return true;
}

export function publishTaskNativeQuickEntryReady(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'quick-entry-ready',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
  } satisfies TaskNativeQuickEntryReadyMessage);
  return true;
}

export function requestTaskNativeQuickEntryDismissal(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'quick-entry-dismiss-requested',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
  } satisfies TaskNativeQuickEntryDismissalMessage);
  return true;
}

export function configureTaskNativeQuickEntryShortcut(
  shortcut: TaskNativeQuickEntryShortcut,
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'configure-quick-entry-shortcut',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
    shortcut,
  } satisfies TaskNativeQuickEntryShortcutMessage);
  return true;
}

export function clearTaskNativeQuickEntryShortcut(
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'clear-quick-entry-shortcut',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
  } satisfies TaskNativeQuickEntryShortcutClearMessage);
  return true;
}

export function finishTaskNativeQuickEntry(
  committed: boolean,
  target: Window = window,
): boolean {
  const handler = getTasksNativeMessageHandler(target);
  if (!handler || getTasksNativeInstallationId(target) === null) return false;
  handler.postMessage({
    type: 'quick-entry-finished',
    schemaVersion: TASK_NATIVE_WIDGET_SCHEMA_VERSION,
    committed,
  } satisfies TaskNativeQuickEntryFinishedMessage);
  return true;
}

export function getNativeTaskDeepLinkId(search: string): string | null {
  const taskId = new URLSearchParams(search).get(TASK_NATIVE_TASK_QUERY_PARAMETER);
  return taskId !== null && uuidPattern.test(taskId) ? taskId : null;
}

export function removeNativeTaskDeepLink(search: string): string {
  const parameters = new URLSearchParams(search);
  parameters.delete(TASK_NATIVE_TASK_QUERY_PARAMETER);
  const next = parameters.toString();
  return next ? `?${next}` : '';
}

export function getNativeNewTaskSignal(search: string): TaskNativeNewTaskSignal | null {
  const values = new URLSearchParams(search).getAll(
    TASK_NATIVE_NEW_TASK_QUERY_PARAMETER,
  );
  if (values.length !== 1) return null;
  if (values[0] === '1') return 'today-inbox';
  if (values[0] === 'list') return 'current-list';
  return null;
}

export function hasNativeNewTaskSignal(search: string): boolean {
  return getNativeNewTaskSignal(search) !== null;
}

export function removeNativeNewTaskSignal(search: string): string {
  const parameters = new URLSearchParams(search);
  parameters.delete(TASK_NATIVE_NEW_TASK_QUERY_PARAMETER);
  const next = parameters.toString();
  return next ? `?${next}` : '';
}

export function isTaskNativeQuickEntry(search: string): boolean {
  return new URLSearchParams(search).get(TASK_NATIVE_QUICK_ENTRY_QUERY_PARAMETER) === '1';
}

export function resetTaskNativeWidgetPublisherForTests(): void {
  lastPublishedContent = null;
}

function toTaskNativeWidgetTask(
  task: TaskTodo,
  listId: TaskNativeWidgetListId,
  planningDate: string,
): TaskNativeWidgetTask {
  const primaryLinkHref = getTaskPrimaryLinkHref(task.primary_link);
  const primaryLinkKind = getTaskPrimaryLinkKind(task.primary_link);
  return {
    id: task.id,
    summary: task.title.trim().slice(0, 500),
    deadline: task.deadline,
    todaySection: task.today_section,
    actionability: task.actionability,
    terminalState: task.disposition === 'deleted'
      ? 'deleted'
      : task.lifecycle === 'open' ? null : task.lifecycle,
    upcomingDate: listId === 'upcoming'
      ? getTaskUpcomingDate(task, planningDate)
      : null,
    isRecurrenceProjection: false,
    primaryLink: primaryLinkHref && primaryLinkKind
      ? { href: primaryLinkHref.slice(0, 8_000), kind: primaryLinkKind }
      : null,
  };
}

function toTaskNativeWidgetRecurrencePrototype({
  definition,
  revision,
  scheduledDate,
}: {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  scheduledDate: string;
}): TaskNativeWidgetTask {
  const prototype = revision.prototype_snapshot.root;
  const primaryLinkHref = getTaskPrimaryLinkHref(prototype.primary_link);
  const primaryLinkKind = getTaskPrimaryLinkKind(prototype.primary_link);
  return {
    id: definition.id,
    summary: prototype.title.trim().slice(0, 500),
    deadline: (revision.deadline_after_start_days ?? revision.deadline_offset_days) === null
      ? null
      : revision.date_basis === 'start' && definition.next_occurrence_date
        ? addTaskCalendarDays(
            definition.next_occurrence_date,
            revision.deadline_after_start_days ?? revision.deadline_offset_days ?? 0,
          )
        : definition.next_occurrence_date,
    todaySection: null,
    actionability: prototype.actionability,
    terminalState: null,
    upcomingDate: scheduledDate,
    isRecurrenceProjection: true,
    primaryLink: primaryLinkHref && primaryLinkKind
      ? { href: primaryLinkHref.slice(0, 8_000), kind: primaryLinkKind }
      : null,
  };
}

function toLegacyTaskNativeWidgetSnapshot(snapshot: TaskNativeWidgetSnapshot) {
  return {
    ...snapshot,
    schemaVersion: 1,
    lists: snapshot.lists.map((list) => ({
      ...list,
      tasks: list.tasks.map(({
        primaryLink: _primaryLink,
        upcomingDate: _upcomingDate,
        isRecurrenceProjection: _isRecurrenceProjection,
        ...task
      }) => task),
    })),
  };
}

import { deriveTaskAreaSections } from '@/modules/tasks/domain/taskAreaViews';
import {
  taskMatchesQuickFilter,
  type TaskQuickFilter,
} from '@/modules/tasks/domain/taskQuickFilters';
import {
  deriveTaskViewTasks,
  type TaskListView,
} from '@/modules/tasks/hooks/useTaskList';
import type {
  TaskActionability,
  TaskArea,
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

type BuildTaskNativeWidgetSnapshotInput = {
  ownerId: string;
  planningDate: string;
  tasks: readonly TaskTodo[];
  areas: readonly TaskArea[];
  automaticListSorting: boolean;
  quickFilter: TaskQuickFilter;
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

      return {
        id,
        title: taskNativeWidgetListTitles[id],
        totalCount: filtered.length,
        truncated: filtered.length > safeLimit,
        tasks: filtered.slice(0, safeLimit).map(toTaskNativeWidgetTask),
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

export function hasNativeNewTaskSignal(search: string): boolean {
  const values = new URLSearchParams(search).getAll(
    TASK_NATIVE_NEW_TASK_QUERY_PARAMETER,
  );
  return values.length === 1 && values[0] === '1';
}

export function removeNativeNewTaskSignal(search: string): string {
  const parameters = new URLSearchParams(search);
  parameters.delete(TASK_NATIVE_NEW_TASK_QUERY_PARAMETER);
  const next = parameters.toString();
  return next ? `?${next}` : '';
}

export function resetTaskNativeWidgetPublisherForTests(): void {
  lastPublishedContent = null;
}

function toTaskNativeWidgetTask(task: TaskTodo): TaskNativeWidgetTask {
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
      tasks: list.tasks.map(({ primaryLink: _primaryLink, ...task }) => task),
    })),
  };
}

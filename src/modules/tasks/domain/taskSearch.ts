import type { TaskLifecycle } from '@/modules/tasks/domain/taskState';
import type {
  TaskActionability,
  TaskDestination,
  TaskSourceKind,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

export type TaskSearchFilters = {
  destination: 'all' | TaskDestination;
  lifecycle: 'all' | TaskLifecycle;
  actionability: 'all' | TaskActionability;
  sourceKind: 'all' | 'none' | TaskSourceKind;
};

export type TaskSearchHierarchy = {
  areas: ReadonlyArray<{ id: string; title: string }>;
  projects: ReadonlyArray<{ id: string; title: string }>;
};

export type TaskSearchDocument = {
  task: TaskTodo;
  hierarchyLabel: string | null;
  normalizedText: string;
};

export function createTaskSearchDocuments(
  tasks: readonly TaskTodo[],
  hierarchy: TaskSearchHierarchy,
): TaskSearchDocument[] {
  const areaTitles = new Map(hierarchy.areas.map(({ id, title }) => [id, title]));
  const projectTitles = new Map(hierarchy.projects.map(({ id, title }) => [id, title]));

  return tasks.map((task) => {
    const hierarchyLabel = getIndexedTaskHierarchyLabel(
      task,
      areaTitles,
      projectTitles,
    );
    return {
      task,
      hierarchyLabel,
      normalizedText: [
        task.title,
        task.notes,
        task.source_title,
        task.source_url,
        hierarchyLabel,
      ].filter((value): value is string => Boolean(value)).join('\n').toLocaleLowerCase(),
    };
  });
}

export function filterTaskSearchDocuments(
  documents: readonly TaskSearchDocument[],
  normalizedQuery: string,
  filters: TaskSearchFilters,
): TaskSearchDocument[] {
  return documents.filter(({ task, normalizedText }) => {
    if (filters.destination !== 'all' && task.destination !== filters.destination) return false;
    if (filters.lifecycle !== 'all' && task.lifecycle !== filters.lifecycle) return false;
    if (filters.actionability !== 'all' && task.actionability !== filters.actionability) return false;
    if (filters.sourceKind === 'none' && task.source_kind !== null) return false;
    if (
      filters.sourceKind !== 'all'
      && filters.sourceKind !== 'none'
      && task.source_kind !== filters.sourceKind
    ) return false;
    return !normalizedQuery || normalizedText.includes(normalizedQuery);
  });
}

export function getTaskSearchSourceKinds(
  documents: readonly TaskSearchDocument[],
): TaskSourceKind[] {
  return Array.from(new Set(documents.flatMap(({ task }) => (
    task.source_kind ? [task.source_kind] : []
  )))).sort();
}

function getIndexedTaskHierarchyLabel(
  task: TaskTodo,
  areaTitles: ReadonlyMap<string, string>,
  projectTitles: ReadonlyMap<string, string>,
): string | null {
  if (task.project_id) {
    const projectTitle = projectTitles.get(task.project_id);
    if (!projectTitle) return 'Unavailable Project';
    return projectTitle;
  }
  if (task.area_id) {
    return areaTitles.get(task.area_id) ?? 'Unavailable Area';
  }
  return null;
}

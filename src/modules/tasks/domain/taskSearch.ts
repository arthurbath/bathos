import type { TaskTodo } from '@/modules/tasks/types/tasks';

export type TaskSearchHierarchy = {
  areas: ReadonlyArray<{ id: string; title: string }>;
};

export type TaskSearchDocument = {
  task: TaskTodo;
  hierarchyLabel: string | null;
  normalizedTitle: string;
  normalizedNotes: string;
  normalizedSourceTitle: string;
  normalizedSourceUrl: string;
  normalizedHierarchyLabel: string;
  normalizedText: string;
};

export function createTaskSearchDocuments(
  tasks: readonly TaskTodo[],
  hierarchy: TaskSearchHierarchy,
): TaskSearchDocument[] {
  const areaTitles = new Map(hierarchy.areas.map(({ id, title }) => [id, title]));

  return tasks.map((task) => {
    const hierarchyLabel = getIndexedTaskHierarchyLabel(task, areaTitles);
    const normalizedTitle = normalizeSearchValue(task.title);
    const normalizedNotes = normalizeSearchValue(task.notes);
    const normalizedSourceTitle = normalizeSearchValue(task.source_title);
    const normalizedSourceUrl = normalizeSearchValue(task.source_url);
    const normalizedHierarchyLabel = normalizeSearchValue(hierarchyLabel);
    return {
      task,
      hierarchyLabel,
      normalizedTitle,
      normalizedNotes,
      normalizedSourceTitle,
      normalizedSourceUrl,
      normalizedHierarchyLabel,
      normalizedText: [
        normalizedTitle,
        normalizedNotes,
        normalizedSourceTitle,
        normalizedSourceUrl,
        normalizedHierarchyLabel,
      ].filter(Boolean).join('\n'),
    };
  });
}

export function filterTaskSearchDocuments(
  documents: readonly TaskSearchDocument[],
  normalizedQuery: string,
): TaskSearchDocument[] {
  return documents.filter(({ normalizedText }) => (
    !normalizedQuery || normalizedText.includes(normalizedQuery)
  ));
}

export function rankTaskSearchDocuments(
  documents: readonly TaskSearchDocument[],
  normalizedQuery: string,
): TaskSearchDocument[] {
  return [...documents].sort((left, right) => (
    getTaskSearchRank(left, normalizedQuery) - getTaskSearchRank(right, normalizedQuery)
    || left.task.title.localeCompare(right.task.title)
    || left.task.id.localeCompare(right.task.id)
  ));
}

function getTaskSearchRank(
  document: TaskSearchDocument,
  normalizedQuery: string,
): number {
  if (document.normalizedTitle === normalizedQuery) return 0;
  if (document.normalizedTitle.startsWith(normalizedQuery)) return 1;
  if (document.normalizedTitle.includes(normalizedQuery)) return 2;
  if (document.normalizedSourceTitle.includes(normalizedQuery)) return 3;
  if (document.normalizedHierarchyLabel.includes(normalizedQuery)) return 4;
  if (document.normalizedNotes.includes(normalizedQuery)) return 5;
  if (document.normalizedSourceUrl.includes(normalizedQuery)) return 6;
  return 7;
}

function normalizeSearchValue(value: string | null | undefined): string {
  return value?.toLocaleLowerCase() ?? '';
}

function getIndexedTaskHierarchyLabel(
  task: TaskTodo,
  areaTitles: ReadonlyMap<string, string>,
): string | null {
  if (task.area_id) {
    return areaTitles.get(task.area_id) ?? 'Unavailable Area';
  }
  return null;
}

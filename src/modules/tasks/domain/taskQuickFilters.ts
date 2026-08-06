import type { TaskActionability } from '@/modules/tasks/types/tasks';

export const taskQuickFilters = [
  'all',
  'actionable',
  'non_actionable',
  'actionable_waiting',
  'actionable_rechecking',
  'rechecking',
  'waiting',
] as const;

export type TaskQuickFilter = (typeof taskQuickFilters)[number];

export const taskQuickFilterActionabilityOptions = [
  { value: 'actionable', label: 'Ready' },
  { value: 'rechecking', label: 'Rechecking' },
  { value: 'waiting', label: 'Waiting' },
] as const satisfies ReadonlyArray<{
  value: TaskActionability;
  label: string;
}>;

export const taskQuickFilterLabels: Record<TaskQuickFilter, string> = {
  all: 'All Tasks',
  actionable: 'Only Ready',
  non_actionable: 'Only Waiting & Rechecking',
  actionable_waiting: 'Only Ready & Waiting',
  actionable_rechecking: 'Only Ready & Rechecking',
  rechecking: 'Only Rechecking',
  waiting: 'Only Waiting',
};

const taskQuickFilterActionabilities: Record<
  TaskQuickFilter,
  readonly TaskActionability[]
> = {
  all: ['actionable', 'waiting', 'rechecking'],
  actionable: ['actionable'],
  non_actionable: ['waiting', 'rechecking'],
  actionable_waiting: ['actionable', 'waiting'],
  actionable_rechecking: ['actionable', 'rechecking'],
  rechecking: ['rechecking'],
  waiting: ['waiting'],
};

export function sanitizeTaskQuickFilter(value: unknown): TaskQuickFilter {
  return typeof value === 'string'
    && taskQuickFilters.includes(value as TaskQuickFilter)
    ? value as TaskQuickFilter
    : 'all';
}

export function taskMatchesQuickFilter(
  actionability: TaskActionability,
  filter: TaskQuickFilter,
): boolean {
  return taskQuickFilterActionabilities[filter].includes(actionability);
}

export function getTaskQuickFilterActionabilities(
  filter: TaskQuickFilter,
): readonly TaskActionability[] {
  return taskQuickFilterActionabilities[filter];
}

export function getTaskQuickFilterForActionabilities(
  selectedActionabilities: readonly TaskActionability[],
): TaskQuickFilter {
  const selected = new Set(selectedActionabilities);

  // An empty actionability projection is illegal. Treat it as a request to
  // restore the unfiltered default instead of leaving the list blank.
  if (selected.size === 0 || selected.size === taskQuickFilterActionabilityOptions.length) {
    return 'all';
  }
  if (selected.size === 1) {
    if (selected.has('actionable')) return 'actionable';
    if (selected.has('waiting')) return 'waiting';
    return 'rechecking';
  }
  if (!selected.has('actionable')) return 'non_actionable';
  if (selected.has('waiting')) return 'actionable_waiting';
  return 'actionable_rechecking';
}

import { useDeferredValue, useEffect, useMemo, useState, type MouseEvent } from 'react';

import { Button } from '@/components/ui/button';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { shouldHandleWithBrowser } from '@/lib/navigation';
import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
} from '@/modules/tasks/domain/taskSearch';
import { getTaskPlanningRoute } from '@/modules/tasks/domain/taskPlanningRoute';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

type QuickFindResult =
  | { kind: 'todo'; id: string; title: string; detail: string; href: string; task: TaskTodo }
  | { kind: 'area'; id: string; title: string; detail: string; href: string };

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function taskDetail(task: TaskTodo, hierarchyLabel: string | null): string {
  if (hierarchyLabel) return hierarchyLabel;
  if (task.lifecycle !== 'open') return task.lifecycle === 'completed' ? 'Completed' : 'Canceled';
  return task.destination === 'someday' ? 'Someday' : 'Anytime';
}

function createQuickFindResults(
  query: string,
  basePath: string,
  tasks: readonly TaskTodo[],
  hierarchy: TaskHierarchyModel,
  planningDate: string,
): QuickFindResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const taskResults: QuickFindResult[] = filterTaskSearchDocuments(
    createTaskSearchDocuments(tasks, hierarchy),
    normalizedQuery,
  )
    .map(({ task, hierarchyLabel }) => ({
      kind: 'todo',
      id: task.id,
      title: task.title,
      detail: taskDetail(task, hierarchyLabel),
      href: `${basePath}/${getTaskPlanningRoute(task, planningDate)}`,
      task,
    }));
  const areaResults: QuickFindResult[] = hierarchy.areas
    .filter(({ title }) => title.toLocaleLowerCase().includes(normalizedQuery))
    .map((area) => ({
      kind: 'area',
      id: area.id,
      title: area.title,
      detail: 'Area',
      href: `${basePath}/areas/${encodeURIComponent(area.id)}`,
    }));
  return [...taskResults, ...areaResults]
    .sort((left, right) => {
      const leftExact = left.title.toLocaleLowerCase() === normalizedQuery ? 0 : 1;
      const rightExact = right.title.toLocaleLowerCase() === normalizedQuery ? 0 : 1;
      return leftExact - rightExact || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    })
    .slice(0, 3);
}

const resultIcons = {
  todo: TASK_ICONS.Task,
  area: TASK_ICONS.Area,
} as const;

export function TaskQuickFindDialog({
  open,
  initialQuery,
  basePath,
  tasks,
  hierarchy,
  planningDate,
  loading,
  error,
  onOpenChange,
  onCloseAutoFocus,
  onNavigate,
  onSelectTask,
}: {
  open: boolean;
  initialQuery: string;
  basePath: string;
  tasks: TaskTodo[];
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onNavigate: (path: string) => void;
  onSelectTask: (task: TaskTodo, path: string) => void;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [initialQuery, open]);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => createQuickFindResults(deferredQuery, basePath, tasks, hierarchy, planningDate),
    [basePath, deferredQuery, hierarchy, planningDate, tasks],
  );
  const continueHref = `${basePath}/search?q=${encodeURIComponent(query.trim())}`;

  const activate = (event: MouseEvent<HTMLAnchorElement>, result: QuickFindResult) => {
    if (shouldHandleWithBrowser(event)) return;
    event.preventDefault();
    if (result.kind === 'todo') onSelectTask(result.task, result.href);
    else onNavigate(result.href);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen);
      if (!nextOpen) setQuery('');
    }}>
      <DialogContent
        footerless
        className="shadow-none sm:max-w-lg"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader><DialogTitle>Quick Find</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4 pt-4">
          <div className="relative">
            <TASK_ICONS.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Find Tasks and Areas"
              placeholder="Find Tasks and Areas"
              className="pl-9"
            />
          </div>
          {loading ? (
            <div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>
          ) : error ? (
            <p role="alert" className="py-6 text-center text-sm text-destructive">Tasks Could Not Be Searched</p>
          ) : normalize(query) && results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matches</p>
          ) : results.length > 0 ? (
            <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
              {results.map((result) => {
                const Icon = resultIcons[result.kind];
                return (
                  <a
                    key={`${result.kind}:${result.id}`}
                    href={result.href}
                    onClick={(event) => activate(event, result)}
                    className="flex h-16 items-center gap-3 overflow-hidden px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    data-task-compact-row
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          ) : null}
          <Button asChild variant="outline" className="w-full">
            <a
              href={continueHref}
              aria-disabled={!normalize(query)}
              onClick={(event) => {
                if (!normalize(query)) {
                  event.preventDefault();
                  return;
                }
                if (shouldHandleWithBrowser(event)) return;
                event.preventDefault();
                onNavigate(continueHref);
              }}
            >
              Continue Search
            </a>
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function TaskSearchResultsView({
  query,
  basePath,
  tasks,
  hierarchy,
  planningDate,
  loading,
  error,
  onQueryChange,
  onSelectTask,
}: {
  query: string;
  basePath: string;
  tasks: TaskTodo[];
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  loading: boolean;
  error: unknown;
  onQueryChange: (query: string) => void;
  onSelectTask: (task: TaskTodo, path: string) => void;
}) {
  const deferredQuery = useDeferredValue(normalize(query));
  const documents = useMemo(
    () => createTaskSearchDocuments(tasks, hierarchy),
    [hierarchy, tasks],
  );
  const results = useMemo(
    () => filterTaskSearchDocuments(documents, deferredQuery),
    [deferredQuery, documents],
  );
  return (
    <div className="space-y-5">
      <div className="relative">
        <TASK_ICONS.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Search All Tasks"
          placeholder="Search All Tasks"
          className="pl-9"
        />
      </div>
      <section aria-label="Task Search Results">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          Tasks
        </h3>
        {loading ? (
          <div className="flex min-h-24 items-center justify-center"><LoadingSpinner /></div>
        ) : error ? (
          <p role="alert" className="py-6 text-center text-sm text-destructive">Tasks Could Not Be Searched</p>
        ) : !deferredQuery ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Enter a Search Term</p>
        ) : results.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No matching tasks</p>
        ) : (
          <div className="divide-y divide-[hsl(var(--grid-sticky-line))] border-y border-[hsl(var(--grid-sticky-line))]">
            {results.map(({ task, hierarchyLabel }) => {
              const href = `${basePath}/${getTaskPlanningRoute(task, planningDate)}`;
              return (
                <a
                  key={task.id}
                  href={href}
                  onClick={(event) => {
                    if (shouldHandleWithBrowser(event)) return;
                    event.preventDefault();
                    onSelectTask(task, href);
                  }}
                  className="flex h-16 flex-col justify-center overflow-hidden px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  data-task-compact-row
                >
                  <span className="block truncate text-sm font-medium text-foreground">{task.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{taskDetail(task, hierarchyLabel)}</span>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

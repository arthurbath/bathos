import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useModalViewportStyle } from '@/components/ui/modal-viewport';
import { shouldHandleWithBrowser } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
  getTaskSearchRank,
  rankTaskSearchDocuments,
} from '@/modules/tasks/domain/taskSearch';
import type { TaskPlanningRoute } from '@/modules/tasks/domain/taskPlanningRoute';
import type { TaskHierarchyModel } from '@/modules/tasks/hooks/useTaskHierarchy';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrenceRevision,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

export type TaskSearchResult =
  | {
      kind: 'todo';
      id: string;
      title: string;
      detail: string;
      href: string;
      task: TaskTodo;
      route: TaskPlanningRoute;
      activation: 'open';
      rank: number;
    }
  | {
      kind: 'recurrence';
      id: string;
      title: string;
      detail: string;
      href: string;
      definition: TaskRecurrenceDefinition;
      revision: TaskRecurrenceRevision;
      activation: 'focus-recurrence';
      rank: number;
    };

export type TaskQuickFindRecurrence = {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getTaskQuickFindRoute(task: TaskTodo, planningDate: string): TaskPlanningRoute {
  if (task.lifecycle !== 'open' || task.disposition === 'deleted') return 'done';
  if (task.destination === 'someday') return 'someday';
  if (task.destination === 'anytime' && task.start_date && task.start_date > planningDate) {
    return 'upcoming';
  }
  return 'anytime';
}

function taskDetail(task: TaskTodo, route: TaskPlanningRoute): string {
  if (task.disposition === 'deleted') return 'Deleted';
  if (task.lifecycle !== 'open') return 'Completed';
  return route[0].toUpperCase() + route.slice(1);
}

export function createTaskSearchResults(
  query: string,
  basePath: string,
  tasks: readonly TaskTodo[],
  hierarchy: TaskHierarchyModel,
  planningDate: string,
  recurrences: readonly TaskQuickFindRecurrence[],
): TaskSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];
  const documents = filterTaskSearchDocuments(
    createTaskSearchDocuments(tasks, hierarchy),
    normalizedQuery,
  );
  const taskResults: TaskSearchResult[] = rankTaskSearchDocuments(
    documents,
    normalizedQuery,
  ).map((document) => {
      const { task } = document;
      const route = getTaskQuickFindRoute(task, planningDate);
      return {
        kind: 'todo',
        id: task.id,
        title: task.title,
        detail: taskDetail(task, route),
        href: `${basePath}/${route}`,
        task,
        route,
        activation: 'open',
        rank: getTaskSearchRank(document, normalizedQuery),
      };
    });
  const areaTitles = new Map(hierarchy.areas.map(({ id, title }) => [id, title]));
  const recurrenceResults: TaskSearchResult[] = recurrences.flatMap(({ definition, revision }) => {
    const prototype = revision.prototype_snapshot.root;
    const fields = {
      normalizedTitle: normalize(prototype.title),
      normalizedNotes: normalize(prototype.notes),
      normalizedPrimaryLink: normalize(prototype.primary_link ?? ''),
      normalizedSourceTitle: '',
      normalizedSourceUrl: '',
      normalizedHierarchyLabel: normalize(
        revision.target_area_id ? areaTitles.get(revision.target_area_id) ?? '' : '',
      ),
    };
    if (!Object.values(fields).some((value) => value.includes(normalizedQuery))) return [];
    return [{
      kind: 'recurrence' as const,
      id: definition.id,
      title: prototype.title,
      detail: 'Repeating Task',
      href: `${basePath}/upcoming`,
      definition,
      revision,
      activation: 'focus-recurrence' as const,
      rank: getTaskSearchRank(fields, normalizedQuery),
    }];
  });
  return [...taskResults, ...recurrenceResults].sort((left, right) => (
    left.rank - right.rank
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
  ));
}

export function TaskQuickFindDialog({
  open,
  initialQuery,
  basePath,
  tasks,
  hierarchy,
  planningDate,
  recurrences,
  loading,
  error,
  onOpenChange,
  onCloseAutoFocus,
  onNavigate,
  onSelectTask,
  onSelectRecurrence,
}: {
  open: boolean;
  initialQuery: string;
  basePath: string;
  tasks: TaskTodo[];
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  recurrences: TaskQuickFindRecurrence[];
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
  onNavigate: (path: string) => void;
  onSelectTask: (
    task: TaskTodo,
    path: string,
  ) => void;
  onSelectRecurrence: (definition: TaskRecurrenceDefinition, path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const viewportStyle = useModalViewportStyle();
  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      const input = inputRef.current;
      if (input) input.setSelectionRange(input.value.length, input.value.length);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialQuery, open]);
  const deferredQuery = useDeferredValue(query);
  const allResults = useMemo(
    () => createTaskSearchResults(
      deferredQuery,
      basePath,
      tasks,
      hierarchy,
      planningDate,
      recurrences,
    ),
    [
      basePath,
      deferredQuery,
      hierarchy,
      planningDate,
      recurrences,
      tasks,
    ],
  );
  const results = allResults.slice(0, 3);
  const showAllResults = useMemo(() => {
    return normalize(deferredQuery).length > 0 && allResults.length > 0;
  }, [allResults.length, deferredQuery]);
  const resultIdentity = results.map(({ id, activation }) => `${id}:${activation}`).join('|');
  useEffect(() => {
    setActiveIndex(0);
  }, [deferredQuery, resultIdentity]);
  const continueHref = `${basePath}/search?q=${encodeURIComponent(query.trim())}`;
  const optionCount = results.length + (showAllResults ? 1 : 0);
  const hasSecondaryContent = loading
    || Boolean(error)
    || Boolean(normalize(query))
    || results.length > 0
    || showAllResults;
  const activeOptionId = optionCount === 0
    ? undefined
    : activeIndex < results.length
      ? `${listboxId}-result-${activeIndex}`
      : `${listboxId}-all`;
  const close = () => {
    onOpenChange(false);
    setQuery('');
  };

  const activate = (event: MouseEvent<HTMLAnchorElement>, result: TaskSearchResult) => {
    if (shouldHandleWithBrowser(event)) return;
    event.preventDefault();
    if (result.kind === 'todo') onSelectTask(result.task, result.href);
    else onSelectRecurrence(result.definition, result.href);
  };

  const activateIndex = (index: number) => {
    const result = results[index];
    if (result) {
      if (result.kind === 'todo') onSelectTask(result.task, result.href);
      else onSelectRecurrence(result.definition, result.href);
      return;
    }
    if (showAllResults) onNavigate(continueHref);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (optionCount === 0) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + direction + optionCount) % optionCount);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateIndex(activeIndex);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const dismissFromOverlay = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen);
      if (!nextOpen) setQuery('');
    }}>
      <DialogPortal>
        <DialogOverlay
          className="bg-background/70"
          onPointerDown={dismissFromOverlay}
          data-task-quick-find-dismiss-layer
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onCloseAutoFocus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            close();
          }}
          className="fixed left-1/2 z-50 flex max-h-[calc(var(--bathos-modal-vv-height,100dvh)-5rem)] w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover p-2 focus:outline-none"
          style={{
            ...viewportStyle,
            top: 'calc(var(--bathos-modal-vv-top, 0px) + 4rem)',
          }}
          data-task-quick-find
        >
          <DialogPrimitive.Title className="sr-only">
            Quick Find
          </DialogPrimitive.Title>
          <div className="relative">
            <TASK_ICONS.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={inputRef}
              data-task-quick-find-input
              autoFocus
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded="true"
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              aria-label="Find Tasks"
              placeholder="Find Tasks"
              className="h-11 pl-9"
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label="Quick Find Results"
            className={cn('space-y-0.5', hasSecondaryContent && 'mt-2')}
          >
            {loading ? (
              <div className="flex min-h-20 items-center justify-center"><LoadingSpinner /></div>
            ) : error ? (
              <p role="alert" className="px-3 py-4 text-center text-sm text-destructive">Tasks Could Not Be Searched</p>
            ) : normalize(query) && results.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches</p>
            ) : results.map((result, index) => (
              <a
                key={`${result.kind}:${result.id}`}
                id={`${listboxId}-result-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                href={result.href}
                onClick={(event) => activate(event, result)}
                className={cn(
                  'flex min-h-12 items-center gap-2 overflow-hidden rounded-lg px-3 py-2 outline-none',
                  activeIndex === index && 'bg-info/10',
                )}
                data-task-compact-row
                data-task-quick-find-result-kind={result.activation}
              >
                {result.activation === 'focus-recurrence' ? (
                  <TASK_ICONS.Recurrence
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{result.detail}</span>
                </span>
              </a>
            ))}
            {showAllResults ? (
              <a
                id={`${listboxId}-all`}
                role="option"
                aria-selected={activeIndex === results.length}
                href={continueHref}
                onClick={(event) => {
                  if (shouldHandleWithBrowser(event)) return;
                  event.preventDefault();
                  onNavigate(continueHref);
                }}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-foreground outline-none',
                  activeIndex === results.length && 'bg-info/10',
                )}
              >
                <TASK_ICONS.Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                See All Results
              </a>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export function TaskSearchResultsView({
  query,
  basePath,
  tasks,
  hierarchy,
  planningDate,
  recurrences,
  loading,
  error,
  onQueryChange,
  onSelectTask,
  onSelectRecurrence,
  renderResult,
}: {
  query: string;
  basePath: string;
  tasks: TaskTodo[];
  hierarchy: TaskHierarchyModel;
  planningDate: string;
  recurrences: TaskQuickFindRecurrence[];
  loading: boolean;
  error: unknown;
  onQueryChange: (query: string) => void;
  onSelectTask: (task: TaskTodo, path: string) => void;
  onSelectRecurrence: (definition: TaskRecurrenceDefinition, path: string) => void;
  renderResult: (
    result: TaskSearchResult,
    navigation: {
      focused: boolean;
      onFocus: () => void;
      onMoveFocus: (direction: -1 | 1) => void;
      onActivate: () => void;
    },
  ) => ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [focusedResultIndex, setFocusedResultIndex] = useState<number | null>(null);
  const deferredQuery = useDeferredValue(normalize(query));
  const results = useMemo(
    () => createTaskSearchResults(
      deferredQuery,
      basePath,
      tasks,
      hierarchy,
      planningDate,
      recurrences,
    ),
    [basePath, deferredQuery, hierarchy, planningDate, recurrences, tasks],
  );

  const focusResult = useCallback((index: number) => {
    if (results.length === 0) return;
    const nextIndex = Math.max(0, Math.min(index, results.length - 1));
    setFocusedResultIndex(nextIndex);
    window.requestAnimationFrame(() => {
      const wrapper = resultsRef.current?.querySelector<HTMLElement>(
        `[data-task-search-result-index="${nextIndex}"]`,
      );
      wrapper?.querySelector<HTMLElement>(
        '[data-task-row-focus-target], [data-task-recurrence-prototype]',
      )?.focus({ preventScroll: true });
    });
  }, [results.length]);

  const moveResultFocus = useCallback((index: number, direction: -1 | 1) => {
    if (direction < 0 && index === 0) {
      setFocusedResultIndex(null);
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    focusResult(Math.max(0, Math.min(index + direction, results.length - 1)));
  }, [focusResult, results.length]);

  useEffect(() => {
    setFocusedResultIndex(null);
  }, [deferredQuery]);

  useEffect(() => {
    if (focusedResultIndex === null) return;
    if (results.length === 0) {
      setFocusedResultIndex(null);
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    if (focusedResultIndex >= results.length) focusResult(results.length - 1);
  }, [focusResult, focusedResultIndex, results.length]);

  const activateResult = (result: TaskSearchResult) => {
    if (result.kind === 'todo') onSelectTask(result.task, result.href);
    else onSelectRecurrence(result.definition, result.href);
  };

  return (
    <div className="space-y-5">
      <div className="relative">
        <TASK_ICONS.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.key !== 'ArrowDown') return;
            if (results.length === 0) return;
            event.preventDefault();
            focusResult(0);
          }}
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
          <div ref={resultsRef} className="space-y-0.5" data-task-search-results>
            {results.map((result, index) => (
              <div
                key={`${result.kind}:${result.id}`}
                data-task-search-result-index={index}
                data-task-search-result-kind={result.kind}
                onFocusCapture={() => setFocusedResultIndex(index)}
              >
                {renderResult(result, {
                  focused: focusedResultIndex === index,
                  onFocus: () => focusResult(index),
                  onMoveFocus: (direction) => moveResultFocus(index, direction),
                  onActivate: () => activateResult(result),
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { shouldHandleWithBrowser } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import {
  TaskChecklistEditorSurface,
  type TaskChecklistEditorController,
  type TaskChecklistEditorItem,
} from '@/modules/tasks/components/TaskChecklistEditor';
import { TaskMetadataDrawerFields } from '@/modules/tasks/components/TaskMetadataDrawerFields';
import {
  TaskImmediateDragHandle,
} from '@/modules/tasks/components/TaskImmediateDragHandle';
import { useTaskImmediateDragTarget } from '@/modules/tasks/components/TaskImmediateDragTarget';
import { TASK_OPEN_ROW_HIGHLIGHT_SURFACE_CLASS } from '@/modules/tasks/components/taskPlanningStyles';
import {
  TASK_ICONS,
} from '@/modules/tasks/components/taskIconography';
import { TaskRepeatDialog } from '@/modules/tasks/components/TaskRepeatDialog';
import type {
  TaskRecurrenceEditInput,
  TaskRecurrenceSaveResult,
} from '@/modules/tasks/data/taskRecurrenceService';
import {
  formatTaskCompactCalendarDayOffset,
  formatTaskRelativeCalendarDate,
} from '@/modules/tasks/domain/taskDates';
import { isMacControlTaskSelectionPointer } from '@/modules/tasks/domain/taskSelection';
import { planChecklistGroupMove } from '@/modules/tasks/domain/taskChecklistOrder';
import {
  buildRecurrencePrototypeEditInput,
  type RecurrencePrototypeMetadataPatch,
} from '@/modules/tasks/domain/taskRecurrencePrototypeEdit';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrencePrototypeChecklistItem,
  TaskRecurrencePrototypeSnapshot,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';

const TEXT_AUTOSAVE_DELAY_MS = 350;

type PrototypeRowSharedProps = {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  planningDate: string;
  onEdit: (input: TaskRecurrenceEditInput) => Promise<TaskRecurrenceSaveResult>;
  onDelete: (definition: TaskRecurrenceDefinition) => Promise<unknown>;
  areas: ReadonlyArray<{ id: string; title: string }>;
  focusRequested: boolean;
  onFocusFulfilled: () => void;
  editorOpen: boolean;
  onEditorOpenChange: (open: boolean) => Promise<boolean>;
  onRegisterEditorFlush: (
    definitionId: string,
    flush: (() => Promise<void>) | null,
  ) => void;
  navigationHref?: string;
  focused?: boolean;
  onFocusRow?: () => void;
  onMoveFocus?: (direction: -1 | 1) => void;
  onActivate?: () => void;
  macControlClickSelection?: boolean;
  showDragHandles?: boolean;
};

export function WaitingRecurrenceRow({
  onGoToInstance,
  onSelect,
  ...props
}: PrototypeRowSharedProps & {
  onGoToInstance: () => void;
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <RecurrencePrototypeRow
      {...props}
      waiting
      onGoToInstance={onGoToInstance}
      onSelect={onSelect}
    />
  );
}

export function CalendarRecurrencePrototypeRow({
  scheduledDate,
  dragPlacement,
  onDragStart,
  onDragOver,
  onDragEnd,
  onImmediateDrop,
  bulkSelection,
  onSelect,
  ...props
}: PrototypeRowSharedProps & {
  scheduledDate: string;
  dragPlacement?: 'before' | 'after' | null;
  onDragStart?: () => void;
  onDragOver?: (placement: 'before' | 'after') => void;
  onDragEnd?: () => void;
  onImmediateDrop?: () => void;
  bulkSelection?: {
    selected: boolean;
    onToggle: (event: MouseEvent<HTMLElement>) => void;
  };
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <RecurrencePrototypeRow
      {...props}
      scheduledDate={scheduledDate}
      dragPlacement={dragPlacement}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onImmediateDrop={onImmediateDrop}
      bulkSelection={bulkSelection}
      onSelect={onSelect}
    />
  );
}

function RecurrencePrototypeRow({
  definition,
  revision,
  scheduledDate = null,
  planningDate,
  onEdit,
  onDelete,
  areas,
  focusRequested,
  onFocusFulfilled,
  editorOpen,
  onEditorOpenChange,
  onRegisterEditorFlush,
  navigationHref,
  focused = false,
  onFocusRow,
  onMoveFocus,
  onActivate,
  macControlClickSelection = false,
  showDragHandles = false,
  waiting = false,
  onGoToInstance,
  dragPlacement = null,
  onDragStart,
  onDragOver,
  onDragEnd,
  onImmediateDrop,
  bulkSelection,
  onSelect,
}: PrototypeRowSharedProps & {
  scheduledDate?: string | null;
  waiting?: boolean;
  onGoToInstance?: () => void;
  dragPlacement?: 'before' | 'after' | null;
  onDragStart?: () => void;
  onDragOver?: (placement: 'before' | 'after') => void;
  onDragEnd?: () => void;
  onImmediateDrop?: () => void;
  bulkSelection?: {
    selected: boolean;
    onToggle: (event: MouseEvent<HTMLElement>) => void;
  };
  onSelect?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [visibleTitle, setVisibleTitle] = useState(definition.name);
  const rowRef = useRef<HTMLElement>(null);
  const summaryRowRef = useRef<HTMLDivElement>(null);
  const actionMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const suppressClickUntilRef = useRef(0);
  const editorFlushRef = useRef<() => Promise<void>>(async () => undefined);
  const currentDefinitionRef = useRef(definition);
  const currentRevisionRef = useRef(revision);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (definition.record_revision >= currentDefinitionRef.current.record_revision) {
      currentDefinitionRef.current = definition;
    }
    if (revision.revision >= currentRevisionRef.current.revision) {
      currentRevisionRef.current = revision;
    }
    if (!editorOpen) setVisibleTitle(definition.name);
  }, [definition, editorOpen, revision]);

  useEffect(() => {
    if (!focusRequested) return;
    const timer = window.setTimeout(() => {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      rowRef.current?.focus({ preventScroll: true });
      onFocusFulfilled();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusRequested, onFocusFulfilled]);

  const savePrototype = useCallback((patch: RecurrencePrototypeMetadataPatch) => {
    const save = saveQueueRef.current.then(async () => {
      const input = buildRecurrencePrototypeEditInput(
        currentDefinitionRef.current,
        currentRevisionRef.current,
        patch,
      );
      const result = await onEdit(input);
      if (!result.revision) throw new Error('The recurrence revision was not returned');
      currentDefinitionRef.current = result.definition;
      currentRevisionRef.current = result.revision;
    });
    saveQueueRef.current = save.catch((error) => {
      toast({
        title: 'Repeating Task Could Not Be Saved',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    });
    return save;
  }, [onEdit]);

  const openRepeatEditor = async () => {
    await editorFlushRef.current();
    await saveQueueRef.current;
    setRepeatOpen(true);
  };

  const closeEditor = useCallback(async () => {
    await editorFlushRef.current();
    await saveQueueRef.current;
    await onEditorOpenChange(false);
  }, [onEditorOpenChange]);

  const deletePrototype = async () => {
    try {
      await editorFlushRef.current();
      await saveQueueRef.current;
      await onEditorOpenChange(false);
      setRepeatOpen(false);
      await onDelete(currentDefinitionRef.current);
    } catch (error) {
      toast({
        title: 'Repeating Task Could Not Be Deleted',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const draggable = !waiting && onDragStart && onDragOver && onDragEnd;
  const beginDrag = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + 1_000;
    if (editorOpen) void closeEditor();
    onDragStart?.();
  }, [closeEditor, editorOpen, onDragStart]);
  const handleImmediateTarget = useCallback((point: { clientY: number }) => {
    const bounds = summaryRowRef.current?.getBoundingClientRect();
    if (!bounds || !onDragOver) return;
    onDragOver(point.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
  }, [onDragOver]);
  useTaskImmediateDragTarget(
    draggable && showDragHandles ? 'tasks' : null,
    rowRef,
    draggable && showDragHandles ? handleImmediateTarget : null,
  );
  const handleMacControlSelectionMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (
      !macControlClickSelection
      || !onSelect
      || !isMacControlTaskSelectionPointer({
        macLikePlatform: true,
        ctrlKey: event.ctrlKey,
        button: event.button,
      })
    ) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickUntilRef.current = Date.now() + 500;
    onSelect(event);
  };
  const handleMacControlSelectionContextMenu = (event: MouseEvent<HTMLElement>) => {
    if (!macControlClickSelection || !onSelect || !event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <article
        ref={rowRef}
        className={cn(
          'relative grid overflow-hidden text-[15px] text-foreground transition-[grid-template-rows,opacity,background-color,border-radius] ease-out focus:outline-none motion-reduce:transition-none',
          editorOpen || bulkSelection?.selected
            ? 'rounded-md bg-info/10'
            : focused
              ? 'rounded-md bg-info/10'
              : 'focus-visible:rounded-md focus-visible:bg-info/10',
        )}
        data-task-waiting-recurrence={waiting ? 'true' : undefined}
        data-task-recurrence-prototype={definition.id}
        data-task-row-id={waiting ? undefined : `recurrence:${definition.id}`}
        data-task-recurrence-scheduled-date={scheduledDate ?? undefined}
        data-drag-placement={dragPlacement ?? undefined}
        tabIndex={focused ? 0 : -1}
        data-task-row-focus-target={navigationHref ? true : undefined}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Escape' && editorOpen) {
            event.preventDefault();
            void closeEditor();
            return;
          }
          if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && focused) {
            event.preventDefault();
            onMoveFocus?.(event.key === 'ArrowUp' ? -1 : 1);
            return;
          }
          if (event.key === 'Enter' && focused) {
            event.preventDefault();
            onActivate?.();
          }
        }}
        onFocus={onFocusRow}
        onDragOver={draggable ? (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          const bounds = event.currentTarget.getBoundingClientRect();
          onDragOver(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
        } : undefined}
      >
        {dragPlacement ? (
          <span
            aria-hidden="true"
            data-task-drop-indicator
            className={cn(
              'pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-info',
              dragPlacement === 'before' ? 'top-0' : 'bottom-0',
            )}
          />
        ) : null}
        <div
          className={TASK_OPEN_ROW_HIGHLIGHT_SURFACE_CLASS}
          data-task-open-highlight-surface
        >
        <div ref={summaryRowRef} className="flex h-11 items-center gap-2 px-1 pr-1.5">
          {bulkSelection ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={bulkSelection.selected}
              aria-label={`${bulkSelection.selected ? 'Deselect' : 'Select'} ${visibleTitle}`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/65"
              onClick={bulkSelection.onToggle}
            >
              {bulkSelection.selected ? (
                <TASK_ICONS.Selected className="h-5 w-5" aria-hidden="true" />
              ) : (
                <TASK_ICONS.Selection className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          ) : (
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground"
              aria-label="Repeating Schedule"
            >
              <TASK_ICONS.Recurrence className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          {navigationHref ? <a
            href={navigationHref}
            className="flex h-full min-w-0 flex-1 flex-col justify-center text-left font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseDown={handleMacControlSelectionMouseDown}
            onContextMenu={handleMacControlSelectionContextMenu}
            onClick={(event) => {
              if (Date.now() <= suppressClickUntilRef.current) {
                event.preventDefault();
                return;
              }
              if (shouldHandleWithBrowser(event)) return;
              if (onSelect) {
                onSelect(event);
              } else if (editorOpen) void closeEditor();
              else void onEditorOpenChange(true);
            }}
            aria-label={`Open ${visibleTitle}`}
            aria-pressed={bulkSelection?.selected}
          >
            <span className="truncate">{visibleTitle}</span>
            <RecurrencePrototypeMetadata
              definition={definition}
              revision={revision}
              areas={areas}
              planningDate={planningDate}
              waiting={waiting}
            />
          </a> : <button
            type="button"
            draggable={Boolean(draggable)}
            data-task-drag-handle={draggable ? 'true' : undefined}
            onDragStart={draggable ? (event: DragEvent<HTMLButtonElement>) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('application/x-bathos-recurrence-id', definition.id);
              event.dataTransfer.setData('text/plain', definition.id);
              beginDrag();
            } : undefined}
            onDragEnd={draggable ? () => {
              suppressClickUntilRef.current = Date.now() + 250;
              onDragEnd();
            } : undefined}
            className={cn(
              'flex h-full min-w-0 flex-1 flex-col justify-center text-left font-normal focus:outline-none',
              draggable && 'cursor-grab active:cursor-grabbing',
            )}
            onMouseDown={handleMacControlSelectionMouseDown}
            onContextMenu={handleMacControlSelectionContextMenu}
            onClick={(event) => {
              if (Date.now() <= suppressClickUntilRef.current) {
                event.preventDefault();
                return;
              }
              if (onSelect) {
                onSelect(event);
              } else if (editorOpen) void closeEditor();
              else void onEditorOpenChange(true);
            }}
            aria-label={`Open ${visibleTitle}`}
            aria-expanded={bulkSelection ? undefined : editorOpen}
            aria-pressed={bulkSelection?.selected}
          >
            <span className="truncate">{visibleTitle}</span>
            <RecurrencePrototypeMetadata
              definition={definition}
              revision={revision}
              areas={areas}
              planningDate={planningDate}
              waiting={waiting}
            />
          </button>}
          {!bulkSelection ? <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={actionMenuTriggerRef}
                type="button"
                variant="clear"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label={`Actions for ${visibleTitle}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const trigger = actionMenuTriggerRef.current;
                window.queueMicrotask(() => {
                  if (document.activeElement === trigger) trigger?.blur();
                });
              }}
            >
              <DropdownMenuItem onSelect={() => void openRepeatEditor()}>
                Edit Repeat
              </DropdownMenuItem>
              {onGoToInstance ? (
                <DropdownMenuItem onSelect={onGoToInstance}>
                  Go to Instance
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => void deletePrototype()}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> : null}
          {draggable && showDragHandles ? (
            <TaskImmediateDragHandle
              label={`Reorder ${visibleTitle}`}
              scope="tasks"
              previewRef={summaryRowRef}
              onStart={beginDrag}
              onDrop={() => {
                if (onImmediateDrop) onImmediateDrop();
                else onDragEnd?.();
              }}
              onCancel={onDragEnd}
            />
          ) : null}
        </div>
        {editorOpen ? (
          <SharedRecurrencePrototypeEditor
            definition={definition}
            revision={revision}
            areas={areas}
            onSave={savePrototype}
            onTitleChange={setVisibleTitle}
            onRegisterFlush={(flush) => {
              editorFlushRef.current = flush ?? (async () => undefined);
              onRegisterEditorFlush(definition.id, flush);
            }}
            onEditRepeat={() => void openRepeatEditor()}
            showDragHandles={showDragHandles}
          />
        ) : null}
        </div>
      </article>
      <TaskRepeatDialog
        task={null}
        definition={repeatOpen ? currentDefinitionRef.current : definition}
        revision={repeatOpen ? currentRevisionRef.current : revision}
        planningDate={planningDate}
        open={repeatOpen}
        onOpenChange={setRepeatOpen}
        onEdit={onEdit}
        areas={areas}
      />
    </>
  );
}

function RecurrencePrototypeMetadata({
  definition,
  revision,
  areas,
  planningDate,
  waiting,
}: {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  areas: ReadonlyArray<{ id: string; title: string }>;
  planningDate: string;
  waiting: boolean;
}) {
  const prototype = revision.prototype_snapshot.root;
  const areaLabel = areas.find(({ id }) => id === revision.target_area_id)?.title ?? null;
  const deadline = revision.deadline_offset_days !== null
    ? definition.next_occurrence_date
    : null;
  const hasMetadata = waiting
    || areaLabel !== null
    || prototype.actionability !== 'actionable'
    || deadline !== null
    || prototype.notes.length > 0
    || prototype.checklist.length > 0;
  if (!hasMetadata) return null;

  return (
    <span
      className="mt-px flex min-w-0 items-center gap-x-2.5 overflow-hidden whitespace-nowrap text-xs font-normal leading-4 text-muted-foreground"
      data-task-row-metadata
    >
      {areaLabel ? (
        <span className="min-w-0 shrink truncate" title={areaLabel} data-task-metadata-kind="area">
          {areaLabel}
        </span>
      ) : null}
      {waiting ? (
        <span className="rounded bg-foreground/[0.08] px-1.5 py-0.5" data-task-metadata-kind="recurrence-waiting">
          Waiting
        </span>
      ) : null}
      {prototype.actionability === 'waiting' ? (
        <MetadataIcon label="Waiting" kind="actionability" className="text-admin">
          <TASK_ICONS.Waiting className="h-3.5 w-3.5" aria-hidden="true" />
        </MetadataIcon>
      ) : prototype.actionability === 'rechecking' ? (
        <MetadataIcon label="Rechecking" kind="actionability" className="text-admin">
          <TASK_ICONS.Rechecking className="h-3.5 w-3.5" aria-hidden="true" />
        </MetadataIcon>
      ) : null}
      {deadline ? (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1',
            deadline <= planningDate && 'text-destructive',
          )}
          aria-label={`Deadline ${formatTaskRelativeCalendarDate(deadline, planningDate)}`}
          data-task-metadata-kind="deadline"
        >
          <TASK_ICONS.Deadline className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sm:hidden" aria-hidden="true" data-task-deadline-compact>
            {formatTaskCompactCalendarDayOffset(deadline, planningDate)}
          </span>
          <span className="hidden sm:inline" aria-hidden="true" data-task-deadline-full>
            {formatTaskRelativeCalendarDate(deadline, planningDate)}
          </span>
        </span>
      ) : null}
      {prototype.notes.length > 0 ? (
        <MetadataIcon label="Notes" kind="notes">
          <TASK_ICONS.Notes className="h-3.5 w-3.5" aria-hidden="true" />
        </MetadataIcon>
      ) : null}
      {prototype.checklist.length > 0 ? (
        <MetadataIcon label="Checklist" kind="checklist">
          <TASK_ICONS.TaskChecklist className="h-3.5 w-3.5" aria-hidden="true" />
        </MetadataIcon>
      ) : null}
    </span>
  );
}

function MetadataIcon({
  label,
  kind,
  className,
  children,
}: {
  label: string;
  kind: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      aria-label={label}
      title={label}
      data-task-metadata-kind={kind}
    >
      {children}
    </span>
  );
}

function SharedRecurrencePrototypeEditor({
  definition,
  revision,
  areas,
  onSave,
  onTitleChange,
  onRegisterFlush,
  onEditRepeat,
  showDragHandles,
}: {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  areas: ReadonlyArray<{ id: string; title: string }>;
  onSave: (patch: RecurrencePrototypeMetadataPatch) => Promise<void>;
  onTitleChange: (title: string) => void;
  onRegisterFlush: (flush: (() => Promise<void>) | null) => void;
  onEditRepeat: () => void;
  showDragHandles: boolean;
}) {
  const prototype = revision.prototype_snapshot.root;
  const [title, setTitle] = useState(prototype.title);
  const [notes, setNotes] = useState(prototype.notes);
  const [primaryLink, setPrimaryLink] = useState(prototype.primary_link ?? '');
  const [actionability, setActionability] = useState(prototype.actionability);
  const [targetAreaId, setTargetAreaId] = useState(revision.target_area_id);
  const [checklist, setChecklist] = useState(prototype.checklist);
  const [checklistContentPresent, setChecklistContentPresent] = useState(
    prototype.checklist.length > 0,
  );
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textRootPatchRef = useRef<Partial<TaskRecurrencePrototypeSnapshot['root']>>({});
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const checklistFlushRef = useRef<(() => Promise<void>) | null>(null);

  const flushRoot = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const root = textRootPatchRef.current;
    textRootPatchRef.current = {};
    if (Object.keys(root).length > 0) {
      const save = saveQueueRef.current.then(() => onSave({ root }));
      saveQueueRef.current = save.catch(() => undefined);
    }
    await saveQueueRef.current;
  }, [onSave]);

  const flush = useCallback(async () => {
    await flushRoot();
    await checklistFlushRef.current?.();
  }, [flushRoot]);

  const scheduleRootPatch = useCallback((root: Partial<TaskRecurrencePrototypeSnapshot['root']>) => {
    textRootPatchRef.current = { ...textRootPatchRef.current, ...root };
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushRoot();
    }, TEXT_AUTOSAVE_DELAY_MS);
  }, [flushRoot]);

  const saveImmediate = useCallback(async (patch: RecurrencePrototypeMetadataPatch) => {
    await flushRoot();
    const save = saveQueueRef.current.then(() => onSave(patch));
    saveQueueRef.current = save.catch(() => undefined);
    await save;
  }, [flushRoot, onSave]);

  useLayoutEffect(() => {
    const input = titleInputRef.current;
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  useLayoutEffect(() => {
    onRegisterFlush(flush);
    return () => onRegisterFlush(null);
  }, [flush, onRegisterFlush]);

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    void flush();
  }, [flush]);

  const persistChecklist = useCallback(async (
    nextItems: readonly TaskChecklistEditorItem[],
  ) => {
    const ordered = nextItems.map((item, index) => ({
      node_id: item.id,
      title: item.title,
      completed: item.completed,
      order_key: String((index + 1) * 1024).padStart(12, '0'),
    }));
    setChecklist(ordered);
    setChecklistContentPresent(ordered.length > 0);
    await saveImmediate({ root: { checklist: ordered } });
    return ordered.map(prototypeChecklistEditorItem);
  }, [saveImmediate]);

  const checklistController: TaskChecklistEditorController = {
    items: checklist.map(prototypeChecklistEditorItem),
    loading: false,
    createItem: async (itemTitle, destinationIndex = checklist.length) => {
      const item: TaskChecklistEditorItem = {
        id: crypto.randomUUID(),
        title: itemTitle,
        completed: false,
        order_key: '',
      };
      const next = checklist.map(prototypeChecklistEditorItem);
      next.splice(Math.max(0, Math.min(destinationIndex, next.length)), 0, item);
      const saved = await persistChecklist(next);
      return saved.find(({ id }) => id === item.id) ?? item;
    },
    createItems: async (titles, destinationIndex = checklist.length) => {
      const created = titles.map((itemTitle) => ({
        id: crypto.randomUUID(),
        title: itemTitle.trim(),
        completed: false,
        order_key: '',
      })).filter(({ title: itemTitle }) => itemTitle.length > 0);
      const next = checklist.map(prototypeChecklistEditorItem);
      next.splice(Math.max(0, Math.min(destinationIndex, next.length)), 0, ...created);
      const saved = await persistChecklist(next);
      const createdIds = new Set<string>(created.map(({ id }) => id));
      return saved.filter(({ id }) => createdIds.has(id));
    },
    createItemCopies: async (items, destinationIndex = checklist.length) => {
      const created = items.map((item) => ({
        id: crypto.randomUUID(),
        title: item.title.trim(),
        completed: item.completed,
        order_key: '',
      })).filter(({ title: itemTitle }) => itemTitle.length > 0);
      const next = checklist.map(prototypeChecklistEditorItem);
      next.splice(Math.max(0, Math.min(destinationIndex, next.length)), 0, ...created);
      const saved = await persistChecklist(next);
      const createdIds = new Set<string>(created.map(({ id }) => id));
      return saved.filter(({ id }) => createdIds.has(id));
    },
    updateItem: async (itemId, patch) => {
      const next = checklist.map(prototypeChecklistEditorItem).map((item) => (
        item.id === itemId
          ? {
              ...item,
              ...('title' in patch ? { title: patch.title ?? item.title } : {}),
              ...('completed' in patch ? { completed: patch.completed ?? item.completed } : {}),
              ...('order_key' in patch ? { order_key: patch.order_key ?? item.order_key } : {}),
            }
          : item
      ));
      const saved = await persistChecklist(next);
      const item = saved.find(({ id }) => id === itemId);
      if (!item) throw new Error('The checklist item no longer exists');
      return item;
    },
    setCompleted: async (item, completed) => {
      const next = checklist.map(prototypeChecklistEditorItem)
        .filter(({ id }) => id !== item.id);
      const changed = { ...item, completed };
      if (completed) next.push(changed);
      else next.splice(
        Math.max(0, checklist.findIndex(({ node_id }) => node_id === item.id)),
        0,
        changed,
      );
      const saved = await persistChecklist(next);
      return saved.find(({ id }) => id === item.id) ?? changed;
    },
    deleteItem: async (itemId) => {
      await persistChecklist(
        checklist.map(prototypeChecklistEditorItem).filter(({ id }) => id !== itemId),
      );
    },
    deleteItems: async (itemIds) => {
      const deleted = new Set(itemIds);
      await persistChecklist(
        checklist.map(prototypeChecklistEditorItem).filter(({ id }) => !deleted.has(id)),
      );
    },
    reorderItems: async (itemIds, destinationIndex) => {
      const current = checklist.map(prototypeChecklistEditorItem);
      const move = planChecklistGroupMove(
        current.map(({ id }) => id),
        itemIds,
        destinationIndex,
      );
      const byId = new Map(current.map((item) => [item.id, item]));
      return persistChecklist(move.orderedIds.flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      }));
    },
  };

  return (
    <div data-task-recurrence-prototype-editor>
      <TaskMetadataDrawerFields
        editorId={`recurrence-${definition.id}`}
        title={title}
        notes={notes}
        primaryLink={primaryLink}
        checklistContentPresent={checklistContentPresent}
        renderChecklist={(layout) => (
          <TaskChecklistEditorSurface
            controller={checklistController}
            focusRequestTaskId={`recurrence:${definition.id}`}
            emptyActionLayout={layout}
            onContentPresenceChange={setChecklistContentPresent}
            onRegisterFlush={(nextFlush) => {
              checklistFlushRef.current = nextFlush;
            }}
            showDragHandles={showDragHandles}
          />
        )}
        temporalFields={(
          <Button type="button" variant="outline" className="w-full" onClick={onEditRepeat}>
            Edit Repeat...
          </Button>
        )}
        areas={areas}
        areaId={targetAreaId}
        actionability={actionability}
        onTitleChange={(value) => {
          setTitle(value);
          onTitleChange(value);
          if (value.trim()) scheduleRootPatch({ title: value.trim() });
        }}
        onNotesChange={(value) => {
          setNotes(value);
          scheduleRootPatch({ notes: value });
        }}
        onPrimaryLinkChange={(value) => {
          setPrimaryLink(value);
          scheduleRootPatch({ primary_link: value || null });
        }}
        onPrimaryLinkCleared={() => {
          setPrimaryLink('');
          void saveImmediate({ root: { primary_link: null } });
        }}
        onAreaChange={(areaId) => {
          setTargetAreaId(areaId);
          void saveImmediate({ targetAreaId: areaId });
        }}
        onActionabilityChange={(value) => {
          setActionability(value);
          void saveImmediate({ root: { actionability: value } });
        }}
        titleInputRef={titleInputRef}
        className="pt-[6px]"
      />
    </div>
  );
}

function prototypeChecklistEditorItem(
  item: TaskRecurrencePrototypeChecklistItem,
): TaskChecklistEditorItem {
  return {
    id: item.node_id,
    title: item.title,
    completed: item.completed,
    order_key: item.order_key,
  };
}

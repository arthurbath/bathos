import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { ExternalLink, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  TASK_ICONS,
  TASK_PRIMARY_LINK_ICONS,
  TASK_PRIMARY_LINK_LABELS,
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
import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkIconKind,
  taskPrimaryLinkOpensBrowserTab,
} from '@/modules/tasks/domain/taskPrimaryLink';
import type {
  TaskActionability,
  TaskRecurrenceDefinition,
  TaskRecurrencePrototypeChecklistItem,
  TaskRecurrencePrototypeSnapshot,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';

const TaskMarkdownNotes = lazy(async () => {
  const module = await import('@/modules/tasks/components/TaskMarkdownNotes');
  return { default: module.TaskMarkdownNotes };
});

const TEXT_AUTOSAVE_DELAY_MS = 350;

type RecurrencePrototypeMetadataPatch = {
  root?: Partial<TaskRecurrencePrototypeSnapshot['root']>;
  targetAreaId?: string | null;
};

type PrototypeRowSharedProps = {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  planningDate: string;
  onEdit: (input: TaskRecurrenceEditInput) => Promise<TaskRecurrenceSaveResult>;
  areas: ReadonlyArray<{ id: string; title: string }>;
  focusRequested: boolean;
  onFocusFulfilled: () => void;
};

export function WaitingRecurrenceRow({
  onGoToInstance,
  ...props
}: PrototypeRowSharedProps & { onGoToInstance: () => void }) {
  return (
    <RecurrencePrototypeRow
      {...props}
      waiting
      onGoToInstance={onGoToInstance}
    />
  );
}

export function CalendarRecurrencePrototypeRow({
  scheduledDate,
  dragPlacement,
  onDragStart,
  onDragOver,
  onDragEnd,
  ...props
}: PrototypeRowSharedProps & {
  scheduledDate: string;
  dragPlacement: 'before' | 'after' | null;
  onDragStart: () => void;
  onDragOver: (placement: 'before' | 'after') => void;
  onDragEnd: () => void;
}) {
  return (
    <RecurrencePrototypeRow
      {...props}
      scheduledDate={scheduledDate}
      dragPlacement={dragPlacement}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    />
  );
}

function RecurrencePrototypeRow({
  definition,
  revision,
  scheduledDate = null,
  planningDate,
  onEdit,
  areas,
  focusRequested,
  onFocusFulfilled,
  waiting = false,
  onGoToInstance,
  dragPlacement = null,
  onDragStart,
  onDragOver,
  onDragEnd,
}: PrototypeRowSharedProps & {
  scheduledDate?: string | null;
  waiting?: boolean;
  onGoToInstance?: () => void;
  dragPlacement?: 'before' | 'after' | null;
  onDragStart?: () => void;
  onDragOver?: (placement: 'before' | 'after') => void;
  onDragEnd?: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [visibleTitle, setVisibleTitle] = useState(definition.name);
  const rowRef = useRef<HTMLElement>(null);
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

  const closeEditor = async () => {
    await editorFlushRef.current();
    await saveQueueRef.current;
    setEditorOpen(false);
  };

  const draggable = !waiting && onDragStart && onDragOver && onDragEnd;

  return (
    <>
      <article
        ref={rowRef}
        className={cn(
          'relative text-[15px] text-foreground focus:outline-none',
          editorOpen ? 'rounded-md bg-info/10' : 'focus:rounded-md focus:bg-info/10',
        )}
        data-task-waiting-recurrence={waiting ? 'true' : undefined}
        data-task-recurrence-prototype={definition.id}
        data-task-row-id={waiting ? undefined : `recurrence:${definition.id}`}
        data-task-recurrence-scheduled-date={scheduledDate ?? undefined}
        data-drag-placement={dragPlacement ?? undefined}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !editorOpen) return;
          event.preventDefault();
          void closeEditor();
        }}
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
        <div className="flex h-11 items-center gap-2 px-1 pr-1.5">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground"
            aria-label="Repeating Schedule"
          >
            <TASK_ICONS.Recurrence className="h-5 w-5" aria-hidden="true" />
          </span>
          <button
            type="button"
            draggable={Boolean(draggable)}
            data-task-drag-handle={draggable ? 'true' : undefined}
            onDragStart={draggable ? (event: DragEvent<HTMLButtonElement>) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('application/x-bathos-recurrence-id', definition.id);
              event.dataTransfer.setData('text/plain', definition.id);
              suppressClickUntilRef.current = Date.now() + 1_000;
              if (editorOpen) void closeEditor();
              onDragStart();
            } : undefined}
            onDragEnd={draggable ? () => {
              suppressClickUntilRef.current = Date.now() + 250;
              onDragEnd();
            } : undefined}
            className={cn(
              'flex h-full min-w-0 flex-1 flex-col justify-center text-left font-normal focus:outline-none',
              draggable && 'cursor-grab active:cursor-grabbing',
            )}
            onClick={(event) => {
              if (Date.now() <= suppressClickUntilRef.current) {
                event.preventDefault();
                return;
              }
              if (editorOpen) void closeEditor();
              else setEditorOpen(true);
            }}
            aria-label={`Open ${visibleTitle}`}
            aria-expanded={editorOpen}
          >
            <span className="truncate">{visibleTitle}</span>
            <RecurrencePrototypeMetadata
              definition={definition}
              revision={revision}
              areas={areas}
              planningDate={planningDate}
              waiting={waiting}
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="clear"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label={`Actions for ${visibleTitle}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void openRepeatEditor()}>
                Edit Repeat
              </DropdownMenuItem>
              {onGoToInstance ? (
                <DropdownMenuItem onSelect={onGoToInstance}>
                  Go to Instance
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {editorOpen ? (
          <RecurrencePrototypeEditor
            definition={definition}
            revision={revision}
            areas={areas}
            onSave={savePrototype}
            onTitleChange={setVisibleTitle}
            onRegisterFlush={(flush) => {
              editorFlushRef.current = flush ?? (async () => undefined);
            }}
            onEditRepeat={() => void openRepeatEditor()}
          />
        ) : null}
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

function buildRecurrencePrototypeEditInput(
  definition: TaskRecurrenceDefinition,
  revision: TaskRecurrenceRevision,
  patch: RecurrencePrototypeMetadataPatch,
): TaskRecurrenceEditInput {
  const root = { ...revision.prototype_snapshot.root, ...patch.root };
  return {
    definition,
    revision,
    name: root.title.trim() || definition.name,
    ruleMode: revision.rule_mode,
    frequency: revision.frequency,
    intervalCount: revision.interval_count,
    scheduleDate: revision.start_date,
    ruleConfig: revision.rule_config,
    endMode: revision.end_mode,
    endAfterCount: revision.end_after_count,
    endOnDate: revision.end_on_date,
    reminderLocalTime: revision.reminder_local_time,
    deadlineOffsetDays: revision.deadline_offset_days,
    prototypeSnapshot: { ...revision.prototype_snapshot, root },
    ...('targetAreaId' in patch ? { targetAreaId: patch.targetAreaId } : {}),
  };
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

function RecurrencePrototypeEditor({
  definition,
  revision,
  areas,
  onSave,
  onTitleChange,
  onRegisterFlush,
  onEditRepeat,
}: {
  definition: TaskRecurrenceDefinition;
  revision: TaskRecurrenceRevision;
  areas: ReadonlyArray<{ id: string; title: string }>;
  onSave: (patch: RecurrencePrototypeMetadataPatch) => Promise<void>;
  onTitleChange: (title: string) => void;
  onRegisterFlush: (flush: (() => Promise<void>) | null) => void;
  onEditRepeat: () => void;
}) {
  const prototype = revision.prototype_snapshot.root;
  const [title, setTitle] = useState(prototype.title);
  const [notes, setNotes] = useState(prototype.notes);
  const [primaryLink, setPrimaryLink] = useState(prototype.primary_link ?? '');
  const [primaryLinkDisclosed, setPrimaryLinkDisclosed] = useState(prototype.primary_link !== null);
  const [actionability, setActionability] = useState(prototype.actionability);
  const [targetAreaId, setTargetAreaId] = useState(revision.target_area_id);
  const [checklist, setChecklist] = useState(prototype.checklist);
  const [focusPrimaryLink, setFocusPrimaryLink] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const primaryLinkInputRef = useRef<HTMLInputElement>(null);
  const checklistInputRefs = useRef(new Map<string, HTMLInputElement>());
  const textRootPatchRef = useRef<Partial<TaskRecurrencePrototypeSnapshot['root']>>({});
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(async () => {
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

  const scheduleRootPatch = useCallback((root: Partial<TaskRecurrencePrototypeSnapshot['root']>) => {
    textRootPatchRef.current = { ...textRootPatchRef.current, ...root };
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flush();
    }, TEXT_AUTOSAVE_DELAY_MS);
  }, [flush]);

  const saveImmediate = useCallback(async (patch: RecurrencePrototypeMetadataPatch) => {
    await flush();
    const save = saveQueueRef.current.then(() => onSave(patch));
    saveQueueRef.current = save.catch(() => undefined);
    await save;
  }, [flush, onSave]);

  useLayoutEffect(() => {
    titleInputRef.current?.focus({ preventScroll: true });
    const input = titleInputRef.current;
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  useLayoutEffect(() => {
    if (!focusPrimaryLink) return;
    const input = primaryLinkInputRef.current;
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(input.value.length, input.value.length);
    setFocusPrimaryLink(false);
  }, [focusPrimaryLink, primaryLinkDisclosed]);

  useLayoutEffect(() => {
    onRegisterFlush(flush);
    return () => onRegisterFlush(null);
  }, [flush, onRegisterFlush]);

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    void flush();
  }, [flush]);

  const primaryLinkHref = getTaskPrimaryLinkHref(primaryLink);
  const primaryLinkKind = getTaskPrimaryLinkIconKind(primaryLink);
  const PrimaryLinkIcon = primaryLinkKind === null
    ? TASK_ICONS.PrimaryLink
    : TASK_PRIMARY_LINK_ICONS[primaryLinkKind];
  const primaryLinkLabel = primaryLinkKind === null
    ? 'Primary Link'
    : TASK_PRIMARY_LINK_LABELS[primaryLinkKind];
  const pairedDisclosures = !primaryLinkDisclosed && checklist.length === 0;
  const ActionabilityIcon = actionability === 'waiting'
    ? TASK_ICONS.Waiting
    : actionability === 'rechecking'
      ? TASK_ICONS.Rechecking
      : TASK_ICONS.Ready;

  const updateChecklist = (
    next: TaskRecurrencePrototypeChecklistItem[],
    focus?: { id: string; position: number },
  ) => {
    const ordered = next.map((item, index) => ({
      ...item,
      order_key: String((index + 1) * 1024).padStart(12, '0'),
    }));
    setChecklist(ordered);
    scheduleRootPatch({
      checklist: ordered
        .filter((item) => item.title.trim())
        .map((item) => ({ ...item, title: item.title.trim() })),
    });
    if (!focus) return;
    window.requestAnimationFrame(() => {
      const input = checklistInputRefs.current.get(focus.id);
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(focus.position, focus.position);
    });
  };

  const focusChecklist = (item: TaskRecurrencePrototypeChecklistItem, position: number) => {
    const input = checklistInputRefs.current.get(item.node_id);
    input?.focus({ preventScroll: true });
    input?.setSelectionRange(position, position);
  };

  const insertChecklistItem = (index: number, value = '') => {
    const item: TaskRecurrencePrototypeChecklistItem = {
      node_id: crypto.randomUUID(),
      title: value,
      completed: false,
      order_key: '',
    };
    const next = [...checklist];
    next.splice(index, 0, item);
    updateChecklist(next, { id: item.node_id, position: 0 });
  };

  return (
    <div className="flex flex-col gap-3 px-2 pb-3 sm:px-3.5" data-task-recurrence-prototype-editor>
      <Input
        ref={titleInputRef}
        value={title}
        aria-label="Summary"
        placeholder="New Task"
        onChange={(event) => {
          const value = event.target.value;
          setTitle(value);
          onTitleChange(value);
          if (value.trim()) scheduleRootPatch({ title: value.trim() });
        }}
      />
      <Suspense fallback={<div className="min-h-16" aria-label="Loading Task Notes" />}>
        <TaskMarkdownNotes
          id={`task-recurrence-notes-${definition.id}`}
          notes={notes}
          onChange={(value) => {
            setNotes(value);
            scheduleRootPatch({ notes: value });
          }}
          disabled={false}
        />
      </Suspense>
      <div
        data-task-editor-disclosures
        data-layout={pairedDisclosures ? 'paired' : 'stacked'}
        className={pairedDisclosures ? 'relative grid grid-cols-2 gap-0' : 'flex flex-col gap-3'}
      >
        {primaryLinkDisclosed ? (
          <div className="flex gap-2">
            <Input
              ref={primaryLinkInputRef}
              type="url"
              value={primaryLink}
              aria-label="Primary Link"
              placeholder="Primary Link"
              decoration={<PrimaryLinkIcon />}
              inputMode="url"
              onChange={(event) => {
                const value = event.target.value;
                setPrimaryLink(value);
                scheduleRootPatch({ primary_link: value || null });
              }}
            />
            {primaryLink.length > 0 ? (
              <Button
                asChild={primaryLinkHref !== null}
                type={primaryLinkHref === null ? 'button' : undefined}
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 border-[hsl(var(--grid-sticky-line))] bg-background"
                aria-label={`Open ${primaryLinkLabel}`}
                disabled={primaryLinkHref === null}
              >
                {primaryLinkHref === null ? (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <a
                    href={primaryLinkHref}
                    target={taskPrimaryLinkOpensBrowserTab(primaryLink) ? '_blank' : undefined}
                    rel={taskPrimaryLinkOpensBrowserTab(primaryLink) ? 'noopener noreferrer' : undefined}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </Button>
            ) : null}
          </div>
        ) : (
          <DisclosureButton
            label="Add Primary Link"
            icon={<TASK_ICONS.PrimaryLink className="h-4 w-4" aria-hidden="true" />}
            paired={pairedDisclosures}
            onClick={() => {
              setPrimaryLinkDisclosed(true);
              setFocusPrimaryLink(true);
            }}
          />
        )}
        {checklist.length === 0 ? (
          <DisclosureButton
            label="Add Checklist"
            icon={<TASK_ICONS.TaskChecklist className="h-4 w-4" aria-hidden="true" />}
            paired={pairedDisclosures}
            onClick={() => insertChecklistItem(0)}
          />
        ) : (
          <div className="space-y-1" aria-label="Checklist">
            {checklist.map((item, index) => (
              <div key={item.node_id} className="flex items-center gap-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => updateChecklist(checklist.map((candidate) => (
                    candidate.node_id === item.node_id
                      ? { ...candidate, completed: checked === true }
                      : candidate
                  )))}
                  aria-label={`Mark ${item.title || 'Item'} ${item.completed ? 'Incomplete' : 'Complete'}`}
                />
                <Input
                  ref={(input) => {
                    if (input) checklistInputRefs.current.set(item.node_id, input);
                    else checklistInputRefs.current.delete(item.node_id);
                  }}
                  value={item.title}
                  placeholder="Item"
                  aria-label={`Checklist Item ${index + 1}`}
                  data-bathos-field-return-owned="true"
                  onChange={(event) => updateChecklist(checklist.map((candidate) => (
                    candidate.node_id === item.node_id
                      ? { ...candidate, title: event.target.value }
                      : candidate
                  )))}
                  onKeyDown={(event) => {
                    const start = event.currentTarget.selectionStart ?? 0;
                    const end = event.currentTarget.selectionEnd ?? start;
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const inserted: TaskRecurrencePrototypeChecklistItem = {
                        node_id: crypto.randomUUID(),
                        title: item.title.slice(end),
                        completed: false,
                        order_key: '',
                      };
                      const next = checklist.map((candidate) => (
                        candidate.node_id === item.node_id
                          ? { ...candidate, title: item.title.slice(0, start) }
                          : candidate
                      ));
                      next.splice(index + 1, 0, inserted);
                      updateChecklist(next, { id: inserted.node_id, position: 0 });
                      return;
                    }
                    if (event.key === 'ArrowUp' && index > 0) {
                      event.preventDefault();
                      const previous = checklist[index - 1];
                      focusChecklist(previous, previous.title.length);
                    } else if (event.key === 'ArrowDown' && index < checklist.length - 1) {
                      event.preventDefault();
                      const next = checklist[index + 1];
                      focusChecklist(next, next.title.length);
                    } else if (event.key === 'ArrowLeft' && start === 0 && end === 0 && index > 0) {
                      event.preventDefault();
                      const previous = checklist[index - 1];
                      focusChecklist(previous, previous.title.length);
                    } else if (
                      event.key === 'ArrowRight'
                      && start === item.title.length
                      && end === start
                      && index < checklist.length - 1
                    ) {
                      event.preventDefault();
                      focusChecklist(checklist[index + 1], 0);
                    } else if (event.key === 'Backspace' && start === 0 && end === 0 && index > 0) {
                      event.preventDefault();
                      const previous = checklist[index - 1];
                      const boundary = previous.title.length;
                      updateChecklist(
                        checklist
                          .filter((candidate) => candidate.node_id !== item.node_id)
                          .map((candidate) => candidate.node_id === previous.node_id
                            ? { ...candidate, title: `${previous.title}${item.title}` }
                            : candidate),
                        { id: previous.node_id, position: boundary },
                      );
                    } else if (
                      event.key === 'Delete'
                      && start === item.title.length
                      && end === start
                      && index < checklist.length - 1
                    ) {
                      event.preventDefault();
                      const following = checklist[index + 1];
                      const boundary = item.title.length;
                      updateChecklist(
                        checklist
                          .filter((candidate) => candidate.node_id !== following.node_id)
                          .map((candidate) => candidate.node_id === item.node_id
                            ? { ...candidate, title: `${item.title}${following.title}` }
                            : candidate),
                        { id: item.node_id, position: boundary },
                      );
                    }
                  }}
                />
              </div>
            ))}
          </div>
        )}
        {pairedDisclosures ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2 left-1/2 w-px bg-[hsl(var(--grid-sticky-line)/0.35)]"
          />
        ) : null}
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={onEditRepeat}>
        Edit Repeat
      </Button>
      <div className={cn('grid gap-3', areas.length > 0 ? 'grid-cols-2' : 'grid-cols-1')}>
        {areas.length > 0 ? (
          <Select
            value={targetAreaId ?? 'none'}
            onValueChange={(value) => {
              const next = value === 'none' ? null : value;
              setTargetAreaId(next);
              void saveImmediate({ targetAreaId: next });
            }}
          >
            <SelectTrigger aria-label="Area" decoration={<TASK_ICONS.Area />}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-task-editor-owned-surface="true">
              <SelectItem value="none">No Area</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>{area.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select
          value={actionability}
          onValueChange={(value) => {
            const next = value as TaskActionability;
            setActionability(next);
            void saveImmediate({ root: { actionability: next } });
          }}
        >
          <SelectTrigger
            aria-label="Actionability"
            decoration={<ActionabilityIcon />}
            decorationClassName={actionability === 'actionable' ? undefined : 'text-admin'}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent data-task-editor-owned-surface="true">
            <SelectItem value="actionable">Ready</SelectItem>
            <SelectItem value="rechecking">Rechecking</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DisclosureButton({
  label,
  icon,
  paired,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  paired: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        paired ? 'w-full justify-center' : 'w-fit justify-start',
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

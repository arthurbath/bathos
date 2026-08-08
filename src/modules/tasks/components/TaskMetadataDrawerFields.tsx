import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  TASK_ICONS,
  TASK_PRIMARY_LINK_ICONS,
  TASK_PRIMARY_LINK_LABELS,
} from '@/modules/tasks/components/taskIconography';
import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkIconKind,
  taskPrimaryLinkOpensBrowserTab,
} from '@/modules/tasks/domain/taskPrimaryLink';
import {
  getTaskNativeQuickEntryFieldLabel,
  TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS,
} from '@/modules/tasks/domain/taskNativeQuickEntryContract';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const TaskMarkdownNotes = lazy(async () => {
  const module = await import('@/modules/tasks/components/TaskMarkdownNotes');
  return { default: module.TaskMarkdownNotes };
});

export type TaskMetadataDrawerChecklistLayout = 'paired' | 'standalone';

export function TaskMetadataDrawerFields({
  editorId,
  title,
  notes,
  primaryLink,
  checklistContentPresent,
  renderChecklist,
  onChecklistDisclosure,
  focusRequestId = editorId,
  temporalFields,
  areas,
  areasLoading = false,
  areaId,
  actionability,
  onTitleChange,
  onNotesChange,
  onPrimaryLinkChange,
  onPrimaryLinkCleared,
  onAreaChange,
  onActionabilityChange,
  titleInputRef,
  titleAutoFocus = false,
  titleClassName,
  onTitlePointerDown,
  onTitleKeyDown,
  titleOverlay = null,
  nativeSummaryCaptureActive = false,
  className,
}: {
  editorId: string;
  title: string;
  notes: string;
  primaryLink: string;
  checklistContentPresent: boolean;
  renderChecklist: (layout: TaskMetadataDrawerChecklistLayout) => ReactNode;
  onChecklistDisclosure?: () => Promise<void> | void;
  focusRequestId?: string;
  temporalFields: ReactNode;
  areas: ReadonlyArray<{ id: string; title: string }>;
  areasLoading?: boolean;
  areaId: string | null;
  actionability: TaskTodo['actionability'];
  onTitleChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPrimaryLinkChange: (value: string) => void;
  onPrimaryLinkCleared: () => void;
  onAreaChange: (areaId: string | null) => void;
  onActionabilityChange: (value: TaskTodo['actionability']) => void;
  titleInputRef?: RefObject<HTMLInputElement>;
  titleAutoFocus?: boolean;
  titleClassName?: string;
  onTitlePointerDown?: () => void;
  onTitleKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  titleOverlay?: ReactNode;
  nativeSummaryCaptureActive?: boolean;
  className?: string;
}) {
  const [notesDisclosed, setNotesDisclosed] = useState(notes.length > 0);
  const [primaryLinkDisclosed, setPrimaryLinkDisclosed] = useState(primaryLink.length > 0);
  const [checklistDisclosed, setChecklistDisclosed] = useState(checklistContentPresent);
  const [notesFocusRevision, setNotesFocusRevision] = useState(0);
  const [primaryLinkFocusRevision, setPrimaryLinkFocusRevision] = useState(0);
  const primaryLinkInputRef = useRef<HTMLInputElement>(null);
  const optionalContentLabel = (content: 'link' | 'notes' | 'checklist') => (
    getTaskNativeQuickEntryFieldLabel(content)
  );

  useLayoutEffect(() => {
    if (primaryLinkFocusRevision === 0) return;
    const input = primaryLinkInputRef.current;
    if (input === null) return;
    const atEnd = document.activeElement === input
      && input.selectionStart === input.value.length
      && input.selectionEnd === input.value.length;
    const position = atEnd ? 0 : input.value.length;
    input.focus({ preventScroll: true });
    input.setSelectionRange(position, position);
  }, [primaryLinkDisclosed, primaryLinkFocusRevision]);

  useEffect(() => {
    if (notes.length > 0) setNotesDisclosed(true);
  }, [notes.length]);

  useEffect(() => {
    if (primaryLink.length > 0) setPrimaryLinkDisclosed(true);
  }, [primaryLink.length]);

  useEffect(() => {
    if (checklistContentPresent) setChecklistDisclosed(true);
  }, [checklistContentPresent]);

  const focusChecklist = useCallback(async () => {
    setChecklistDisclosed(true);
    try {
      await onChecklistDisclosure?.();
    } catch {
      setChecklistDisclosed(false);
      return;
    }
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent('bathos:task-checklist-focus', {
        detail: { taskId: focusRequestId },
      }));
    }, 0);
  }, [focusRequestId, onChecklistDisclosure]);

  useEffect(() => {
    const handleFieldFocusRequest = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail?.taskId !== focusRequestId) return;
      if (event.detail?.field === 'notes') {
        setNotesDisclosed(true);
        setNotesFocusRevision((current) => current + 1);
      } else if (event.detail?.field === 'link') {
        setPrimaryLinkDisclosed(true);
        setPrimaryLinkFocusRevision((current) => current + 1);
      } else if (event.detail?.field === 'checklist') {
        void focusChecklist();
      }
    };
    document.addEventListener('bathos:task-editor-focus-field', handleFieldFocusRequest);
    return () => document.removeEventListener(
      'bathos:task-editor-focus-field',
      handleFieldFocusRequest,
    );
  }, [focusChecklist, focusRequestId]);

  const primaryLinkHref = getTaskPrimaryLinkHref(primaryLink);
  const primaryLinkIconKind = getTaskPrimaryLinkIconKind(primaryLink);
  const PrimaryLinkIcon = primaryLinkIconKind === null
    ? TASK_ICONS.PrimaryLink
    : TASK_PRIMARY_LINK_ICONS[primaryLinkIconKind];
  const primaryLinkLabel = primaryLinkIconKind === null
    ? 'Link'
    : TASK_PRIMARY_LINK_LABELS[primaryLinkIconKind];
  const primaryLinkOpensBrowserTab = taskPrimaryLinkOpensBrowserTab(primaryLink);
  const missingOptionalContent = [
    !notesDisclosed ? 'notes' as const : null,
    !primaryLinkDisclosed ? 'link' as const : null,
    !checklistDisclosed ? 'checklist' as const : null,
  ].filter((value): value is 'notes' | 'link' | 'checklist' => value !== null);
  const checklistEndsDrawer = missingOptionalContent.length === 0
    && checklistDisclosed
    && checklistContentPresent;
  const ActionabilityIcon = actionability === 'waiting'
    ? TASK_ICONS.Waiting
    : actionability === 'rechecking'
      ? TASK_ICONS.Rechecking
      : TASK_ICONS.Ready;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-3.5',
        checklistEndsDrawer ? 'pb-2' : 'pb-3',
        className,
      )}
      data-task-editor-form
      data-task-metadata-drawer-fields
      data-task-native-quick-entry-layout={TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS
        .map(({ id }) => id)
        .join(',')}
    >
      <div className="contents" data-task-native-quick-entry-layout-section="summary">
        <div
          className="relative w-full"
          data-task-native-summary-capture={nativeSummaryCaptureActive ? 'true' : undefined}
        >
          <Input
            ref={titleInputRef}
            id={`task-title-${editorId}`}
            data-task-editor-title
            autoFocus={titleAutoFocus}
            aria-label="Summary"
            placeholder="New Task"
            aria-keyshortcuts="Meta+Enter Meta+Escape Control+Enter Control+Q Alt+Shift+Q"
            value={title}
            className={titleClassName}
            onPointerDown={onTitlePointerDown}
            onChange={(event) => onTitleChange(event.target.value)}
            onKeyDown={onTitleKeyDown}
          />
          {titleOverlay}
        </div>
      </div>
      <div className="contents" data-task-native-quick-entry-layout-section="temporal">
        {temporalFields}
      </div>
      <div
        className="contents"
        data-task-native-quick-entry-layout-section="identity"
      >
      <div
        data-task-editor-identity-grid
        className={cn('grid gap-3', areas.length > 0 ? 'grid-cols-2' : 'grid-cols-1')}
      >
        {areas.length > 0 ? (
          <div className="min-w-0">
            <Select
              value={areaId ?? 'none'}
              onValueChange={(value) => onAreaChange(value === 'none' ? null : value)}
              disabled={areasLoading}
            >
              <SelectTrigger
                id={`task-organization-${editorId}`}
                aria-label="Area"
                decoration={<TASK_ICONS.Area />}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent data-task-editor-owned-surface="true">
                <SelectItem value="none">No Area</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>{area.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="min-w-0">
          <Select
            value={actionability}
            onValueChange={(value) => onActionabilityChange(
              value as TaskTodo['actionability'],
            )}
          >
            <SelectTrigger
              id={`task-actionability-${editorId}`}
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
      </div>
      <div className="contents" data-task-native-quick-entry-layout-section="optional">
      {notesDisclosed ? (
        <Suspense fallback={<div className="min-h-16" aria-label="Loading Task Notes" />}>
          <TaskMarkdownNotes
            id={`task-notes-${editorId}`}
            notes={notes}
            onChange={onNotesChange}
            disabled={false}
            focusRequestRevision={notesFocusRevision}
          />
        </Suspense>
      ) : null}
      {primaryLinkDisclosed ? (
          <div className="flex gap-2">
            <Input
              ref={primaryLinkInputRef}
              id={`task-primary-link-${editorId}`}
              type="url"
              value={primaryLink}
              aria-label="Link"
              placeholder="Link"
              decoration={<PrimaryLinkIcon />}
              inputMode="url"
              onChange={(event) => onPrimaryLinkChange(event.target.value)}
              onBlur={() => {
                if (primaryLink !== '') return;
                onPrimaryLinkCleared();
              }}
            />
            {primaryLink.length > 0 ? (
              <Button
                asChild={primaryLinkHref !== null}
                type={primaryLinkHref === null ? 'button' : undefined}
                variant="outline-info"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label={`Open ${primaryLinkLabel}`}
                disabled={primaryLinkHref === null}
              >
                {primaryLinkHref === null ? (
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <a
                    href={primaryLinkHref}
                    target={primaryLinkOpensBrowserTab ? '_blank' : undefined}
                    rel={primaryLinkOpensBrowserTab ? 'noopener noreferrer' : undefined}
                    title={primaryLink}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </Button>
            ) : null}
          </div>
      ) : null}
      {checklistDisclosed ? renderChecklist('standalone') : null}
      {missingOptionalContent.length > 0 ? (
        <div
          data-task-editor-disclosures
          data-layout="optional-content"
          className={cn(
            'grid min-h-9 w-full gap-2',
            missingOptionalContent.length === 1 && 'grid-cols-1',
            missingOptionalContent.length === 2 && 'grid-cols-2',
            missingOptionalContent.length === 3 && 'grid-cols-3',
          )}
        >
          {missingOptionalContent.map((content) => (
            <Button
              key={content}
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Add ${optionalContentLabel(content)}`}
              data-task-primary-link-disclosure={content === 'link' ? 'true' : undefined}
              data-task-checklist-disclosure={content === 'checklist' ? 'true' : undefined}
              data-task-notes-disclosure={content === 'notes' ? 'true' : undefined}
              className="min-w-0 w-full px-2 text-center"
              onClick={() => {
                if (content === 'notes') {
                  setNotesDisclosed(true);
                  setNotesFocusRevision((current) => current + 1);
                } else if (content === 'link') {
                  setPrimaryLinkDisclosed(true);
                  setPrimaryLinkFocusRevision((current) => current + 1);
                } else {
                  void focusChecklist();
                }
              }}
            >
              + {optionalContentLabel(content)}
            </Button>
          ))}
        </div>
      ) : null}
      </div>
    </div>
  );
}

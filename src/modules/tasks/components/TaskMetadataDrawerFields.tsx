import {
  lazy,
  Suspense,
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
  quickEntry = false,
  className,
}: {
  editorId: string;
  title: string;
  notes: string;
  primaryLink: string;
  checklistContentPresent: boolean;
  renderChecklist: (layout: TaskMetadataDrawerChecklistLayout) => ReactNode;
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
  quickEntry?: boolean;
  className?: string;
}) {
  const [primaryLinkDisclosed, setPrimaryLinkDisclosed] = useState(primaryLink.length > 0);
  const [focusPrimaryLink, setFocusPrimaryLink] = useState(false);
  const primaryLinkInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!focusPrimaryLink) return;
    const input = primaryLinkInputRef.current;
    if (input === null) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    setFocusPrimaryLink(false);
  }, [focusPrimaryLink, primaryLinkDisclosed]);

  const primaryLinkHref = getTaskPrimaryLinkHref(primaryLink);
  const primaryLinkIconKind = getTaskPrimaryLinkIconKind(primaryLink);
  const PrimaryLinkIcon = primaryLinkIconKind === null
    ? TASK_ICONS.PrimaryLink
    : TASK_PRIMARY_LINK_ICONS[primaryLinkIconKind];
  const primaryLinkLabel = primaryLinkIconKind === null
    ? 'Primary Link'
    : TASK_PRIMARY_LINK_LABELS[primaryLinkIconKind];
  const primaryLinkOpensBrowserTab = taskPrimaryLinkOpensBrowserTab(primaryLink);
  const pairedMetadataDisclosures = !primaryLinkDisclosed && !checklistContentPresent;
  const checklistLayout = pairedMetadataDisclosures ? 'paired' : 'standalone';
  const ActionabilityIcon = actionability === 'waiting'
    ? TASK_ICONS.Waiting
    : actionability === 'rechecking'
      ? TASK_ICONS.Rechecking
      : TASK_ICONS.Ready;

  return (
    <div
      className={cn(
        quickEntry
          ? 'flex flex-col gap-2 p-1'
          : 'flex flex-col gap-3 px-2 pb-3 sm:px-3.5',
        className,
      )}
      data-task-editor-form
      data-task-metadata-drawer-fields
    >
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
      <Suspense fallback={<div className="min-h-16" aria-label="Loading Task Notes" />}>
        <TaskMarkdownNotes
          id={`task-notes-${editorId}`}
          notes={notes}
          onChange={onNotesChange}
          disabled={false}
        />
      </Suspense>
      <div
        data-task-editor-disclosures
        data-layout={pairedMetadataDisclosures ? 'paired' : 'stacked'}
        className={pairedMetadataDisclosures
          ? 'relative grid grid-cols-2 gap-0'
          : 'flex flex-col gap-3'}
      >
        {primaryLinkDisclosed ? (
          <div className="flex gap-2">
            <Input
              ref={primaryLinkInputRef}
              id={`task-primary-link-${editorId}`}
              type="url"
              value={primaryLink}
              aria-label="Primary Link"
              placeholder="Primary Link"
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
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 border-input bg-background"
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
        ) : (
          <button
            type="button"
            aria-label="Add Primary Link"
            data-task-primary-link-disclosure
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              pairedMetadataDisclosures ? 'w-full justify-center' : 'w-fit justify-start',
            )}
            onClick={() => {
              setPrimaryLinkDisclosed(true);
              setFocusPrimaryLink(true);
            }}
          >
            <TASK_ICONS.PrimaryLink className="h-4 w-4" aria-hidden="true" />
            Add Primary Link
          </button>
        )}
        {renderChecklist(checklistLayout)}
        {pairedMetadataDisclosures ? (
          <span
            aria-hidden="true"
            data-task-editor-disclosure-divider
            className="pointer-events-none absolute inset-y-2 left-1/2 w-px bg-[hsl(var(--grid-sticky-line)/0.35)]"
          />
        ) : null}
      </div>
      {temporalFields}
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
  );
}

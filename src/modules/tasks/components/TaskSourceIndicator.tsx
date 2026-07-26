import type { LucideIcon } from 'lucide-react';

import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import type { TaskSourceKind, TaskTodo } from '@/modules/tasks/types/tasks';
import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkKind,
} from '@/modules/tasks/domain/taskPrimaryLink';

type SourcePresentation = {
  icon: LucideIcon;
  label: string;
};

const sourcePresentations: Record<TaskSourceKind, SourcePresentation> = {
  webpage: { icon: TASK_ICONS.WebpageSource, label: 'Webpage' },
  mail_message: { icon: TASK_ICONS.MailSource, label: 'Mail Message' },
  file: { icon: TASK_ICONS.FileSource, label: 'File' },
  selected_text: { icon: TASK_ICONS.SelectedTextSource, label: 'Selected Text' },
  reading_item: { icon: TASK_ICONS.ReadingItemSource, label: 'Reading Item' },
  template: { icon: TASK_ICONS.TemplateSource, label: 'Template' },
  other: { icon: TASK_ICONS.OtherSource, label: 'Source' },
};

export function TaskSourceIndicator({
  task,
  compact = false,
}: {
  task: TaskTodo;
  compact?: boolean;
}) {
  const primaryLinkKind = getTaskPrimaryLinkKind(task.primary_link);
  const href = getTaskPrimaryLinkHref(task.primary_link);
  const className = `inline-flex ${compact ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;
  if (primaryLinkKind !== null && href !== null) {
    const Icon = primaryLinkKind === 'mail'
      ? TASK_ICONS.MailSource
      : TASK_ICONS.OtherSource;
    const label = primaryLinkKind === 'mail'
      ? `Open Mail Link for ${task.title}`
      : `Open Primary Link for ${task.title}`;
    const opensBrowserTab = primaryLinkKind === 'link';
    return (
      <a
        href={href}
        target={opensBrowserTab ? '_blank' : undefined}
        rel={opensBrowserTab ? 'noopener noreferrer' : undefined}
        aria-label={label}
        title={task.primary_link?.trim() || label}
        className={className}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }

  if (!task.source_kind) return null;

  const presentation = sourcePresentations[task.source_kind];
  const Icon = presentation.icon;
  const accessibleLabel = `${presentation.label} Source for ${task.title}`;
  const title = task.source_title?.trim()
    ? `${presentation.label}: ${task.source_title.trim()}`
    : accessibleLabel;
  const content = <Icon className="h-4 w-4" aria-hidden="true" />;
  return (
    <span className={className} role="img" aria-label={accessibleLabel} title={title}>
      {content}
    </span>
  );
}

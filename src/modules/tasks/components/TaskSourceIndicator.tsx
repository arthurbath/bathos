import {
  BookOpen,
  File,
  Globe2,
  LayoutTemplate,
  Link2,
  Mail,
  TextQuote,
  type LucideIcon,
} from 'lucide-react';

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
  webpage: { icon: Globe2, label: 'Webpage' },
  mail_message: { icon: Mail, label: 'Mail Message' },
  file: { icon: File, label: 'File' },
  selected_text: { icon: TextQuote, label: 'Selected Text' },
  reading_item: { icon: BookOpen, label: 'Reading Item' },
  template: { icon: LayoutTemplate, label: 'Template' },
  other: { icon: Link2, label: 'Source' },
};

export function TaskSourceIndicator({ task }: { task: TaskTodo }) {
  const primaryLinkKind = getTaskPrimaryLinkKind(task.primary_link);
  const href = getTaskPrimaryLinkHref(task.primary_link);
  const className = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  if (primaryLinkKind !== null && href !== null) {
    const Icon = primaryLinkKind === 'mail' ? Mail : Link2;
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

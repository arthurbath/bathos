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

type SourcePresentation = {
  icon: LucideIcon;
  label: string;
  protocols: ReadonlySet<string>;
};

const webProtocols = new Set(['http:', 'https:']);
const localFileProtocols = new Set(['file:']);
const mailProtocols = new Set(['message:']);
const generalSourceProtocols = new Set(['file:', 'http:', 'https:', 'message:']);

const sourcePresentations: Record<TaskSourceKind, SourcePresentation> = {
  webpage: { icon: Globe2, label: 'Webpage', protocols: webProtocols },
  mail_message: { icon: Mail, label: 'Mail Message', protocols: mailProtocols },
  file: { icon: File, label: 'File', protocols: localFileProtocols },
  selected_text: { icon: TextQuote, label: 'Selected Text', protocols: generalSourceProtocols },
  reading_item: { icon: BookOpen, label: 'Reading Item', protocols: webProtocols },
  template: { icon: LayoutTemplate, label: 'Template', protocols: generalSourceProtocols },
  other: { icon: Link2, label: 'Source', protocols: generalSourceProtocols },
};

function getSafeSourceHref(task: TaskTodo, protocols: ReadonlySet<string>): string | null {
  const candidate = task.source_url?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return protocols.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function TaskSourceIndicator({ task }: { task: TaskTodo }) {
  if (!task.source_kind) return null;

  const presentation = sourcePresentations[task.source_kind];
  const href = getSafeSourceHref(task, presentation.protocols);
  const Icon = presentation.icon;
  const accessibleLabel = href
    ? `Open ${presentation.label} for ${task.title}`
    : `${presentation.label} Source for ${task.title}`;
  const title = task.source_title?.trim()
    ? `${presentation.label}: ${task.source_title.trim()}`
    : accessibleLabel;
  const className = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const content = <Icon className="h-4 w-4" aria-hidden="true" />;

  if (!href) {
    return (
      <span className={className} role="img" aria-label={accessibleLabel} title={title}>
        {content}
      </span>
    );
  }

  const opensBrowserTab = href.startsWith('http://') || href.startsWith('https://');
  return (
    <a
      href={href}
      target={opensBrowserTab ? '_blank' : undefined}
      rel={opensBrowserTab ? 'noreferrer' : undefined}
      aria-label={accessibleLabel}
      title={title}
      className={className}
    >
      {content}
    </a>
  );
}

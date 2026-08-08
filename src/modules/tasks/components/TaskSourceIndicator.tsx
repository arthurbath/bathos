import {
  TASK_PRIMARY_LINK_ICONS,
  TASK_PRIMARY_LINK_LABELS,
} from '@/modules/tasks/components/taskIconography';
import type { TaskTodo } from '@/modules/tasks/types/tasks';
import {
  getTaskPrimaryLinkHref,
  getTaskPrimaryLinkIconKind,
  getTaskPrimaryLinkKind,
  taskPrimaryLinkOpensBrowserTab,
} from '@/modules/tasks/domain/taskPrimaryLink';
import type { MouseEvent } from 'react';

export function TaskSourceIndicator({
  task,
  compact = false,
  onOrdinaryActivate,
}: {
  task: TaskTodo;
  compact?: boolean;
  onOrdinaryActivate?: () => void;
}) {
  const primaryLinkKind = getTaskPrimaryLinkKind(task.primary_link);
  const primaryLinkIconKind = getTaskPrimaryLinkIconKind(task.primary_link);
  const href = getTaskPrimaryLinkHref(task.primary_link);
  const className = `inline-flex ${compact ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;
  if (primaryLinkKind !== null && primaryLinkIconKind !== null && href !== null) {
    const Icon = TASK_PRIMARY_LINK_ICONS[primaryLinkIconKind];
    const label = `Open ${TASK_PRIMARY_LINK_LABELS[primaryLinkIconKind]} for ${task.title}`;
    const opensBrowserTab = taskPrimaryLinkOpensBrowserTab(href);
    return (
      <a
        href={href}
        target={opensBrowserTab ? '_blank' : undefined}
        rel={opensBrowserTab ? 'noopener noreferrer' : undefined}
        aria-label={label}
        title={task.primary_link?.trim() || label}
        data-task-primary-link-task-id={task.id}
        className={`${className} text-info`}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (
            event.button !== 0
            || event.metaKey
            || event.ctrlKey
            || event.shiftKey
            || event.altKey
          ) return;
          onOrdinaryActivate?.();
        }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  }

  return null;
}

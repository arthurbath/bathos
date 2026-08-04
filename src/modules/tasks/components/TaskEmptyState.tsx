import { cn } from '@/lib/utils';
import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';

export function TaskEmptyState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center text-muted-foreground',
        compact ? 'py-8' : 'py-12',
      )}
      data-task-empty-state
    >
      <TASK_ICONS.EmptyState
        className="h-8 w-8"
        aria-hidden="true"
        data-task-empty-state-icon
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}

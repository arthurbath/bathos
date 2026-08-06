import { TASK_ICONS } from '@/modules/tasks/components/taskIconography';
import {
  formatTaskCompactCalendarDayOffset,
  formatTaskRelativeCalendarDate,
} from '@/modules/tasks/domain/taskDates';

export function TaskStartMetadata({
  startDate,
  planningDate,
}: {
  startDate: string;
  planningDate: string;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      aria-label={`Start ${formatTaskRelativeCalendarDate(startDate, planningDate)}`}
      data-task-metadata-kind="start"
    >
      <TASK_ICONS.Start className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sm:hidden" aria-hidden="true" data-task-start-compact>
        {formatTaskCompactCalendarDayOffset(startDate, planningDate)}
      </span>
      <span className="hidden sm:inline" aria-hidden="true" data-task-start-full>
        {formatTaskRelativeCalendarDate(startDate, planningDate)}
      </span>
    </span>
  );
}

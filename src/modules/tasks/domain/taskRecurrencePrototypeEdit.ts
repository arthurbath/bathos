import type { TaskRecurrenceEditInput } from '@/modules/tasks/data/taskRecurrenceService';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrencePrototypeSnapshot,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';

export type RecurrencePrototypeMetadataPatch = {
  root?: Partial<TaskRecurrencePrototypeSnapshot['root']>;
  targetAreaId?: string | null;
};

export function buildRecurrencePrototypeEditInput(
  definition: TaskRecurrenceDefinition,
  revision: TaskRecurrenceRevision,
  patch: RecurrencePrototypeMetadataPatch,
): TaskRecurrenceEditInput {
  const root = { ...revision.prototype_snapshot.root, ...patch.root };
  return {
    definition,
    revision,
    ruleMode: revision.rule_mode,
    frequency: revision.frequency,
    intervalCount: revision.interval_count,
    nextStartDate: revision.date_basis === 'deadline' && revision.deadline_after_start_days !== null
      ? addTaskCalendarDays(revision.start_date, -revision.deadline_after_start_days)
      : revision.start_date,
    dateBasis: revision.date_basis,
    ruleConfig: revision.rule_config,
    endMode: revision.end_mode,
    endAfterCount: revision.end_after_count,
    endOnDate: revision.end_on_date,
    reminderLocalTime: revision.reminder_local_time,
    deadlineAfterStartDays: revision.deadline_after_start_days,
    prototypeSnapshot: { ...revision.prototype_snapshot, root },
    ...('targetAreaId' in patch ? { targetAreaId: patch.targetAreaId } : {}),
  };
}

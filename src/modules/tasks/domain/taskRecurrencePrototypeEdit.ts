import type { TaskRecurrenceEditInput } from '@/modules/tasks/data/taskRecurrenceService';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrencePrototypeSnapshot,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';

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

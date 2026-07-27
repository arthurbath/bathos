import type {
  CreateTaskInput,
  EditableTaskPatch,
} from '@/modules/tasks/data/taskRepository';
import type {
  TaskDestination,
  TaskTodaySection,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import { addTaskCalendarDays } from '@/modules/tasks/domain/taskDates';

export const NEW_TASK_DRAFT_ID = 'task-draft:new';

export type TaskCreationView = TaskDestination | 'today' | 'upcoming';
export type TaskCreationPlacement =
  | { todaySection: TaskTodaySection; startDate?: never }
  | { startDate: string; todaySection?: never }
  | { areaId: string; startDate?: never; todaySection?: never };
export type TaskCreationInput = Omit<CreateTaskInput, 'ownerId' | 'orderKey'> & {
  atTop: true;
};

export type TaskCreationDraft = {
  view: TaskCreationView;
  task: TaskTodo;
  persistedTaskId: string | null;
  pendingReminder: {
    localTime: string;
    ambiguityChoice: 'earlier' | 'later';
  } | null;
};

export function createTaskCreationDraft(
  ownerId: string,
  view: TaskCreationView,
  timestamp = new Date().toISOString(),
  placement?: TaskCreationPlacement,
): TaskCreationDraft {
  const destination = view === 'someday' ? 'someday' : 'anytime';
  const todaySection = placement && 'todaySection' in placement
    ? placement.todaySection
    : view === 'today' ? 'now' : null;
  const startDate = placement && 'startDate' in placement
    ? placement.startDate
    : null;
  const areaId = placement && 'areaId' in placement
    ? placement.areaId
    : null;
  return {
    view,
    persistedTaskId: null,
    pendingReminder: null,
    task: {
      id: NEW_TASK_DRAFT_ID,
      owner_id: ownerId,
      area_id: areaId,
      title: '',
      notes: '',
      lifecycle: 'open',
      completed_at: null,
      canceled_at: null,
      disposition: 'present',
      deleted_at: null,
      deletion_root_id: null,
      destination,
      today_section: todaySection,
      actionability: 'actionable',
      order_key: 'draft',
      hierarchy_order_key: null,
      start_date: startDate,
      deadline: null,
      primary_link: null,
      source_kind: null,
      source_url: null,
      source_title: null,
      source_external_id: null,
      template_definition_id: null,
      template_revision: null,
      template_instantiation_id: null,
      template_node_id: null,
      recurrence_definition_id: null,
      recurrence_revision: null,
      recurrence_occurrence_id: null,
      recurrence_logical_key: null,
      undo_source_event_id: null,
      entry_channel: 'web',
      last_mutation_channel: 'web',
      last_actor_type: 'user',
      last_operation_id: null,
      revision: 0,
      client_mutation_id: 'draft',
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
}

export function getFirstTodayTaskCreationPlacement(
  visibleSections: readonly TaskTodaySection[],
): TaskCreationPlacement {
  return { todaySection: visibleSections[0] ?? 'now' };
}

export function getFirstUpcomingTaskCreationPlacement(
  firstSectionDate: string | null | undefined,
  planningDate: string,
): TaskCreationPlacement {
  return {
    startDate: firstSectionDate ?? addTaskCalendarDays(planningDate, 1),
  };
}

export function applyTaskCreationDraftPatch(
  draft: TaskCreationDraft,
  patch: EditableTaskPatch,
): TaskCreationDraft {
  const normalizedPatch = { ...patch };
  if (normalizedPatch.start_date) normalizedPatch.today_section = null;
  else if (normalizedPatch.today_section) normalizedPatch.start_date = null;
  return {
    ...draft,
    task: {
      ...draft.task,
      ...normalizedPatch,
      updated_at: new Date().toISOString(),
    },
  };
}

export function getTaskCreationInput(draft: TaskCreationDraft): TaskCreationInput {
  const { task } = draft;
  return {
    title: task.title,
    notes: task.notes,
    destination: task.destination,
    todaySection: task.today_section,
    startDate: task.start_date,
    deadline: task.deadline,
    primaryLink: task.primary_link,
    actionability: task.actionability,
    areaId: task.area_id,
    atTop: true,
  };
}

import type {
  CreateTaskInput,
  EditableTaskPatch,
} from '@/modules/tasks/data/taskRepository';
import type { TaskDestination, TaskTodo } from '@/modules/tasks/types/tasks';

export const NEW_TASK_DRAFT_ID = 'task-draft:new';

export type TaskCreationView = TaskDestination | 'today' | 'upcoming';
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
): TaskCreationDraft {
  const destination = view === 'someday' ? 'someday' : 'anytime';
  const todaySection = view === 'today' ? 'now' : null;
  return {
    view,
    persistedTaskId: null,
    pendingReminder: null,
    task: {
      id: NEW_TASK_DRAFT_ID,
      owner_id: ownerId,
      area_id: null,
      project_id: null,
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
      start_date: null,
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
      revision: 0,
      client_mutation_id: 'draft',
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
}

export function applyTaskCreationDraftPatch(
  draft: TaskCreationDraft,
  patch: EditableTaskPatch,
): TaskCreationDraft {
  return {
    ...draft,
    task: {
      ...draft.task,
      ...patch,
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
    projectId: task.project_id,
    atTop: true,
  };
}

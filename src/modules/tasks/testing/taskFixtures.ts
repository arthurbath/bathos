import type {
  TaskArea,
  TaskChecklistItem,
  TaskHeading,
  TaskProject,
  TaskRecurrenceDefinition,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
  TaskReminder,
  TaskTemplate,
  TaskTemplateRevision,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

const timestamp = '2026-07-20T04:00:00.000Z';

export function taskTodoFixture(patch: Partial<TaskTodo> = {}): TaskTodo {
  return {
    id: 'task-a',
    owner_id: 'owner-a',
    area_id: null,
    project_id: null,
    heading_id: null,
    title: 'Task',
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: 'later',
    actionability: 'actionable',
    order_key: 'a0',
    hierarchy_order_key: null,
    start_date: null,
    deadline: null,
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
    revision: 1,
    client_mutation_id: 'mutation-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskAreaFixture(patch: Partial<TaskArea> = {}): TaskArea {
  return {
    id: 'area-a',
    owner_id: 'owner-a',
    title: 'Area',
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: 'mutation-area-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskProjectFixture(patch: Partial<TaskProject> = {}): TaskProject {
  return {
    id: 'project-a',
    owner_id: 'owner-a',
    area_id: null,
    title: 'Project',
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: 'none',
    order_key: 'a0',
    planning_order_key: 'a0',
    start_date: null,
    deadline: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: 'mutation-project-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskHeadingFixture(patch: Partial<TaskHeading> = {}): TaskHeading {
  return {
    id: 'heading-a',
    owner_id: 'owner-a',
    project_id: 'project-a',
    title: 'Heading',
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: 'mutation-heading-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskChecklistItemFixture(
  patch: Partial<TaskChecklistItem> = {},
): TaskChecklistItem {
  return {
    id: 'checklist-a',
    owner_id: 'owner-a',
    task_id: 'task-a',
    title: 'Checklist Item',
    completed: false,
    completed_at: null,
    order_key: 'a0',
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: 'mutation-checklist-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskTemplateFixture(patch: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 'template-a',
    owner_id: 'owner-a',
    name: 'Template',
    kind: 'todo',
    current_revision: 1,
    archived_at: null,
    record_revision: 1,
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    client_mutation_id: 'mutation-template-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskTemplateRevisionFixture(
  patch: Partial<TaskTemplateRevision> = {},
): TaskTemplateRevision {
  return {
    id: 'template-revision-a',
    owner_id: 'owner-a',
    template_id: 'template-a',
    revision: 1,
    source_type: 'todo',
    source_id: 'task-a',
    source_revision: 1,
    name: 'Template',
    anchor_date: '2026-07-20',
    snapshot: {
      version: 1,
      kind: 'todo',
      root: {
        node_id: 'template-node-a',
        title: 'Template Task',
        notes: '',
        actionability: 'actionable',
        destination: 'anytime',
        today_section: 'later',
        order_key: 'a0',
        start_offset_days: null,
        deadline_offset_days: null,
        checklist: [],
      },
    },
    client_mutation_id: 'mutation-template-revision-a',
    created_at: timestamp,
    ...patch,
  };
}

export function taskRecurrenceDefinitionFixture(
  patch: Partial<TaskRecurrenceDefinition> = {},
): TaskRecurrenceDefinition {
  return {
    id: 'recurrence-a',
    owner_id: 'owner-a',
    name: 'Recurrence',
    status: 'active',
    current_revision: 1,
    evaluated_through_date: '2026-07-19',
    archived_at: null,
    record_revision: 1,
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    client_mutation_id: 'mutation-recurrence-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

export function taskRecurrenceRevisionFixture(
  patch: Partial<TaskRecurrenceRevision> = {},
): TaskRecurrenceRevision {
  return {
    id: 'recurrence-revision-a',
    owner_id: 'owner-a',
    recurrence_id: 'recurrence-a',
    revision: 1,
    name: 'Recurrence',
    template_id: 'template-a',
    template_revision: 1,
    rule_mode: 'calendar',
    frequency: 'daily',
    interval_count: 1,
    start_date: '2026-07-20',
    planning_timezone: 'America/Los_Angeles',
    missed_policy: 'latest',
    catch_up_limit: 30,
    target_area_id: null,
    client_mutation_id: 'mutation-recurrence-revision-a',
    created_at: timestamp,
    ...patch,
  };
}

export function taskRecurrenceOccurrenceFixture(
  patch: Partial<TaskRecurrenceOccurrence> = {},
): TaskRecurrenceOccurrence {
  return {
    id: 'recurrence-occurrence-a',
    owner_id: 'owner-a',
    recurrence_id: 'recurrence-a',
    recurrence_revision: 1,
    scheduled_date: '2026-07-20',
    logical_key: 'recurrence-a:2026-07-20',
    predecessor_occurrence_id: null,
    root_type: 'todo',
    root_id: 'task-a',
    template_instantiation_id: 'template-instantiation-a',
    client_mutation_id: 'mutation-recurrence-occurrence-a',
    generated_at: timestamp,
    ...patch,
  };
}

export function taskReminderFixture(patch: Partial<TaskReminder> = {}): TaskReminder {
  return {
    id: 'reminder-a',
    owner_id: 'owner-a',
    root_type: 'todo',
    task_id: 'task-a',
    project_id: null,
    status: 'active',
    local_date: '2026-07-20',
    local_time: '09:00:00',
    time_zone: 'America/Los_Angeles',
    ambiguity_choice: 'earlier',
    resolved_at: '2026-07-20T16:00:00.000Z',
    resolution_kind: 'exact',
    record_revision: 1,
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    client_mutation_id: 'mutation-reminder-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
}

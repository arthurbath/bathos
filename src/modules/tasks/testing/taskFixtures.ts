import type {
  TaskArea,
  TaskChecklistItem,
  TaskRecurrenceDefinition,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
  TaskReminder,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

const timestamp = '2026-07-20T04:00:00.000Z';

export function taskTodoFixture(patch: Partial<TaskTodo> = {}): TaskTodo {
  const fixture: TaskTodo = {
    id: 'task-a',
    owner_id: 'owner-a',
    area_id: null,
    title: 'Task',
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: null,
    actionability: 'actionable',
    order_key: 'a0',
    upcoming_order_key: 'a0',
    hierarchy_order_key: null,
    start_date: null,
    deadline: null,
    primary_link: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    recurrence_superseded_at: null,
    undo_source_event_id: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    last_operation_id: null,
    revision: 1,
    client_mutation_id: 'mutation-a',
    created_at: timestamp,
    updated_at: timestamp,
    ...patch,
  };
  return {
    ...fixture,
    upcoming_order_key: patch.upcoming_order_key ?? patch.order_key ?? fixture.upcoming_order_key,
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
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    last_operation_id: 'mutation-checklist-a',
    revision: 1,
    client_mutation_id: 'mutation-checklist-a',
    created_at: timestamp,
    updated_at: timestamp,
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
    next_occurrence_date: '2026-07-20',
    archived_at: null,
    record_revision: 1,
    upcoming_order_key: 'a0',
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
    prototype_snapshot: {
      version: 2,
      kind: 'todo',
      root: {
        node_id: 'prototype-node-a',
        title: 'Recurrence',
        notes: '',
        primary_link: null,
        actionability: 'actionable',
        destination: 'anytime',
        today_section: null,
        order_key: 'a0',
        start_offset_days: 0,
        deadline_offset_days: null,
        checklist: [],
      },
    },
    rule_mode: 'calendar',
    frequency: 'daily',
    interval_count: 1,
    start_date: '2026-07-20',
    date_basis: 'start',
    deadline_after_start_days: null,
    planning_timezone: 'America/Los_Angeles',
    missed_policy: 'latest',
    catch_up_limit: 30,
    rule_config: {},
    end_mode: 'never',
    end_after_count: null,
    end_on_date: null,
    reminder_local_time: null,
    deadline_offset_days: null,
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
    origin: 'generated',
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

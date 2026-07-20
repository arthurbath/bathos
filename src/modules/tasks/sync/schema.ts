import { column, Schema, Table } from '@powersync/web';

const taskTodos = new Table(
  {
    owner_id: column.text,
    actionability: column.text,
    area_id: column.text,
    project_id: column.text,
    heading_id: column.text,
    title: column.text,
    notes: column.text,
    lifecycle: column.text,
    completed_at: column.text,
    canceled_at: column.text,
    disposition: column.text,
    deleted_at: column.text,
    deletion_root_id: column.text,
    destination: column.text,
    today_section: column.text,
    order_key: column.text,
    hierarchy_order_key: column.text,
    start_date: column.text,
    deadline: column.text,
    entry_channel: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    undo_source_event_id: column.text,
    source_kind: column.text,
    source_url: column.text,
    source_title: column.text,
    source_external_id: column.text,
    template_definition_id: column.text,
    template_revision: column.integer,
    template_instantiation_id: column.text,
    template_node_id: column.text,
    recurrence_definition_id: column.text,
    recurrence_revision: column.integer,
    recurrence_occurrence_id: column.text,
    recurrence_logical_key: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      ownerDestinationOrder: [
        'owner_id',
        'destination',
        'today_section',
        'disposition',
        'lifecycle',
        'order_key',
      ],
      ownerStartDate: ['owner_id', 'start_date', 'disposition', 'lifecycle', 'order_key'],
      ownerDeadline: ['owner_id', 'deadline', 'disposition', 'lifecycle'],
      ownerActionability: [
        'owner_id',
        'actionability',
        'disposition',
        'lifecycle',
        'destination',
        'order_key',
      ],
      ownerUpdated: ['owner_id', '-updated_at'],
      ownerContainerOrder: [
        'owner_id',
        'area_id',
        'project_id',
        'heading_id',
        'disposition',
        'hierarchy_order_key',
      ],
    },
  },
);

const taskAreas = new Table(
  {
    owner_id: column.text,
    title: column.text,
    order_key: column.text,
    disposition: column.text,
    deleted_at: column.text,
    deletion_root_id: column.text,
    entry_channel: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { ownerOrder: ['owner_id', 'disposition', 'order_key'] } },
);

const taskProjects = new Table(
  {
    owner_id: column.text,
    area_id: column.text,
    title: column.text,
    notes: column.text,
    lifecycle: column.text,
    completed_at: column.text,
    canceled_at: column.text,
    disposition: column.text,
    deleted_at: column.text,
    deletion_root_id: column.text,
    destination: column.text,
    today_section: column.text,
    order_key: column.text,
    planning_order_key: column.text,
    start_date: column.text,
    deadline: column.text,
    template_definition_id: column.text,
    template_revision: column.integer,
    template_instantiation_id: column.text,
    template_node_id: column.text,
    recurrence_definition_id: column.text,
    recurrence_revision: column.integer,
    recurrence_occurrence_id: column.text,
    recurrence_logical_key: column.text,
    entry_channel: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      ownerAreaOrder: ['owner_id', 'area_id', 'disposition', 'order_key'],
      ownerPlanningOrder: [
        'owner_id',
        'destination',
        'today_section',
        'disposition',
        'lifecycle',
        'planning_order_key',
      ],
    },
  },
);

const taskHeadings = new Table(
  {
    owner_id: column.text,
    project_id: column.text,
    title: column.text,
    order_key: column.text,
    disposition: column.text,
    deleted_at: column.text,
    deletion_root_id: column.text,
    template_definition_id: column.text,
    template_revision: column.integer,
    template_instantiation_id: column.text,
    template_node_id: column.text,
    entry_channel: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { ownerProjectOrder: ['owner_id', 'project_id', 'disposition', 'order_key'] } },
);

const taskChecklistItems = new Table(
  {
    owner_id: column.text,
    task_id: column.text,
    title: column.text,
    completed: column.integer,
    completed_at: column.text,
    order_key: column.text,
    disposition: column.text,
    deleted_at: column.text,
    deletion_root_id: column.text,
    template_definition_id: column.text,
    template_revision: column.integer,
    template_instantiation_id: column.text,
    template_node_id: column.text,
    entry_channel: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { ownerTaskOrder: ['owner_id', 'task_id', 'disposition', 'order_key'] } },
);

const taskHistoryEvents = new Table(
  {
    owner_id: column.text,
    task_id: column.text,
    client_mutation_id: column.text,
    actor_type: column.text,
    mutation_channel: column.text,
    affected_ids: column.text,
    base_revision: column.integer,
    result_revision: column.integer,
    transition: column.text,
    occurred_at: column.text,
    outcome: column.text,
    code: column.text,
    before_state: column.text,
    after_state: column.text,
  },
  {
    indexes: {
      ownerOccurred: ['owner_id', '-occurred_at'],
      ownerTaskOccurred: ['owner_id', 'task_id', '-occurred_at'],
    },
  },
);

const taskHierarchyOperations = new Table(
  {
    owner_id: column.text,
    root_type: column.text,
    root_id: column.text,
    operation: column.text,
    descendant_policy: column.text,
    expected_revisions: column.text,
    actor_type: column.text,
    mutation_channel: column.text,
    requested_at: column.text,
    outcome: column.text,
    code: column.text,
    affected_ids: column.text,
    result_revisions: column.text,
    completed_at: column.text,
  },
  {
    indexes: {
      ownerRequested: ['owner_id', '-requested_at'],
      ownerRootRequested: ['owner_id', 'root_type', 'root_id', '-requested_at'],
    },
  },
);

const taskHierarchyHistoryEvents = new Table(
  {
    owner_id: column.text,
    entity_type: column.text,
    entity_id: column.text,
    client_mutation_id: column.text,
    operation_id: column.text,
    actor_type: column.text,
    mutation_channel: column.text,
    affected_ids: column.text,
    base_revision: column.integer,
    result_revision: column.integer,
    transition: column.text,
    occurred_at: column.text,
    before_state: column.text,
    after_state: column.text,
  },
  {
    indexes: {
      ownerOccurred: ['owner_id', '-occurred_at'],
      ownerEntityOccurred: ['owner_id', 'entity_type', 'entity_id', '-occurred_at'],
    },
  },
);

const taskUserSettings = new Table(
  {
    owner_id: column.text,
    planning_timezone: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      owner: ['owner_id'],
    },
  },
);

const taskTemplates = new Table(
  {
    owner_id: column.text,
    kind: column.text,
    name: column.text,
    current_revision: column.integer,
    record_revision: column.integer,
    archived_at: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      ownerKindName: ['owner_id', 'archived_at', 'kind', 'name'],
    },
  },
);

const taskTemplateRevisions = new Table(
  {
    owner_id: column.text,
    template_id: column.text,
    revision: column.integer,
    name: column.text,
    source_type: column.text,
    source_id: column.text,
    source_revision: column.integer,
    anchor_date: column.text,
    snapshot: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      ownerTemplateRevision: ['owner_id', 'template_id', '-revision'],
    },
  },
);

const taskTemplateInstantiations = new Table(
  {
    owner_id: column.text,
    template_id: column.text,
    template_revision: column.integer,
    anchor_date: column.text,
    entry_channel: column.text,
    actor_type: column.text,
    target_area_id: column.text,
    root_type: column.text,
    root_id: column.text,
    result: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      ownerTemplateCreated: ['owner_id', 'template_id', '-created_at'],
    },
  },
);

const taskRecurrenceDefinitions = new Table(
  {
    owner_id: column.text,
    name: column.text,
    status: column.text,
    current_revision: column.integer,
    record_revision: column.integer,
    evaluated_through_date: column.text,
    archived_at: column.text,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      ownerStatusUpdated: ['owner_id', 'status', '-updated_at'],
    },
  },
);

const taskRecurrenceRevisions = new Table(
  {
    owner_id: column.text,
    recurrence_id: column.text,
    revision: column.integer,
    name: column.text,
    template_id: column.text,
    template_revision: column.integer,
    rule_mode: column.text,
    frequency: column.text,
    interval_count: column.integer,
    start_date: column.text,
    planning_timezone: column.text,
    missed_policy: column.text,
    catch_up_limit: column.integer,
    target_area_id: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      ownerDefinitionRevision: ['owner_id', 'recurrence_id', '-revision'],
    },
  },
);

const taskRecurrenceOccurrences = new Table(
  {
    owner_id: column.text,
    recurrence_id: column.text,
    recurrence_revision: column.integer,
    logical_key: column.text,
    scheduled_date: column.text,
    predecessor_occurrence_id: column.text,
    template_instantiation_id: column.text,
    root_type: column.text,
    root_id: column.text,
    client_mutation_id: column.text,
    generated_at: column.text,
  },
  {
    indexes: {
      ownerDefinitionSchedule: ['owner_id', 'recurrence_id', '-scheduled_date'],
      ownerRoot: ['owner_id', 'root_type', 'root_id'],
    },
  },
);

const taskRecurrenceEvaluations = new Table(
  {
    owner_id: column.text,
    recurrence_id: column.text,
    through_date: column.text,
    result: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      ownerDefinitionCreated: ['owner_id', 'recurrence_id', '-created_at'],
    },
  },
);

const taskRecurrenceStatusEvents = new Table(
  {
    owner_id: column.text,
    recurrence_id: column.text,
    requested_status: column.text,
    base_record_revision: column.integer,
    result_record_revision: column.integer,
    result: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      ownerDefinitionCreated: ['owner_id', 'recurrence_id', '-created_at'],
    },
  },
);

const taskReminders = new Table(
  {
    owner_id: column.text,
    root_type: column.text,
    task_id: column.text,
    project_id: column.text,
    local_date: column.text,
    local_time: column.text,
    time_zone: column.text,
    ambiguity_choice: column.text,
    resolved_at: column.text,
    resolution_kind: column.text,
    status: column.text,
    record_revision: column.integer,
    last_mutation_channel: column.text,
    last_actor_type: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  {
    indexes: {
      ownerRoot: ['owner_id', 'root_type', 'task_id', 'project_id', 'status'],
      ownerResolved: ['owner_id', 'status', 'resolved_at'],
    },
  },
);

const taskReminderOccurrences = new Table(
  {
    owner_id: column.text,
    reminder_id: column.text,
    reminder_revision: column.integer,
    resolved_at: column.text,
    status: column.text,
    client_mutation_id: column.text,
    created_at: column.text,
  },
  { indexes: { ownerDue: ['owner_id', 'status', 'resolved_at'] } },
);

const taskDeliveryTargets = new Table(
  {
    owner_id: column.text,
    channel: column.text,
    endpoint_key: column.text,
    label: column.text,
    capability_status: column.text,
    configuration: column.text,
    last_error_code: column.text,
    last_seen_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { ownerChannel: ['owner_id', 'channel', 'capability_status'] } },
);

const taskReminderDeliveries = new Table(
  {
    owner_id: column.text,
    occurrence_id: column.text,
    target_id: column.text,
    status: column.text,
    attempt_count: column.integer,
    last_attempted_at: column.text,
    provider_accepted_at: column.text,
    acknowledged_at: column.text,
    provider_message_id: column.text,
    last_error_code: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { ownerStatus: ['owner_id', 'status', '-updated_at'] } },
);

const taskReminderClaims = new Table(
  {
    owner_id: column.text,
    through_at: column.text,
    result: column.text,
    created_at: column.text,
  },
  { indexes: { ownerCreated: ['owner_id', '-created_at'] } },
);

const taskSyncIssues = new Table(
  {
    task_id: column.text,
    kind: column.text,
    operation: column.text,
    local_revision: column.integer,
    remote_revision: column.integer,
    detected_at: column.text,
    code: column.text,
  },
  {
    localOnly: true,
    indexes: {
      taskDetected: ['task_id', '-detected_at'],
    },
  },
);

const taskOwnerBinding = new Table(
  {
    owner_id: column.text,
    bound_at: column.text,
  },
  { localOnly: true },
);

export const tasksPowerSyncSchema = new Schema({
  tasks_areas: taskAreas,
  tasks_projects: taskProjects,
  tasks_headings: taskHeadings,
  tasks_todos: taskTodos,
  tasks_checklist_items: taskChecklistItems,
  tasks_history_events: taskHistoryEvents,
  tasks_hierarchy_operations: taskHierarchyOperations,
  tasks_hierarchy_history_events: taskHierarchyHistoryEvents,
  tasks_user_settings: taskUserSettings,
  tasks_templates: taskTemplates,
  tasks_template_revisions: taskTemplateRevisions,
  tasks_template_instantiations: taskTemplateInstantiations,
  tasks_recurrence_definitions: taskRecurrenceDefinitions,
  tasks_recurrence_revisions: taskRecurrenceRevisions,
  tasks_recurrence_occurrences: taskRecurrenceOccurrences,
  tasks_recurrence_evaluations: taskRecurrenceEvaluations,
  tasks_recurrence_status_events: taskRecurrenceStatusEvents,
  tasks_reminders: taskReminders,
  tasks_reminder_occurrences: taskReminderOccurrences,
  tasks_delivery_targets: taskDeliveryTargets,
  tasks_reminder_deliveries: taskReminderDeliveries,
  tasks_reminder_claims: taskReminderClaims,
  tasks_sync_issues: taskSyncIssues,
  tasks_owner_binding: taskOwnerBinding,
});

export type TasksPowerSyncDatabase = (typeof tasksPowerSyncSchema)['types'];

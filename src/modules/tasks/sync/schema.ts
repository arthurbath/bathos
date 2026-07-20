import { column, Schema, Table } from '@powersync/web';

const taskTodos = new Table(
  {
    owner_id: column.text,
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
  tasks_sync_issues: taskSyncIssues,
  tasks_owner_binding: taskOwnerBinding,
});

export type TasksPowerSyncDatabase = (typeof tasksPowerSyncSchema)['types'];

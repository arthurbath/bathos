import { column, Schema, Table } from '@powersync/web';

const taskTodos = new Table(
  {
    owner_id: column.text,
    title: column.text,
    notes: column.text,
    lifecycle: column.text,
    completed_at: column.text,
    canceled_at: column.text,
    disposition: column.text,
    deleted_at: column.text,
    destination: column.text,
    order_key: column.text,
    entry_channel: column.text,
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
      ownerDestinationOrder: ['owner_id', 'destination', 'disposition', 'lifecycle', 'order_key'],
      ownerUpdated: ['owner_id', '-updated_at'],
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
  tasks_todos: taskTodos,
  tasks_sync_issues: taskSyncIssues,
  tasks_owner_binding: taskOwnerBinding,
});

export type TasksPowerSyncDatabase = (typeof tasksPowerSyncSchema)['types'];

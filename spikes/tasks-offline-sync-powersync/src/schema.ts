import { column, Schema, Table } from '@powersync/web';

export const TASKS_TABLE = 'tasks_spike_items';
export const CONFLICTS_TABLE = 'tasks_spike_conflicts';

const tasks = new Table(
  {
    owner_id: column.text,
    title: column.text,
    destination: column.text,
    origin: column.text,
    order_key: column.text,
    completed_at: column.text,
    deleted_at: column.text,
    revision: column.integer,
    client_mutation_id: column.text,
    created_at: column.text,
    updated_at: column.text
  },
  {
    indexes: {
      owner_destination_order: ['owner_id', 'destination', 'order_key']
    }
  }
);

const conflicts = new Table(
  {
    task_id: column.text,
    kind: column.text,
    operation: column.text,
    local_revision: column.integer,
    remote_revision: column.integer,
    detected_at: column.text,
    details: column.text
  },
  { localOnly: true }
);

export const AppSchema = new Schema({
  tasks_spike_items: tasks,
  tasks_spike_conflicts: conflicts
});

export type SpikeDatabase = (typeof AppSchema)['types'];
export type TaskRecord = SpikeDatabase['tasks_spike_items'];
export type ConflictRecord = SpikeDatabase['tasks_spike_conflicts'];

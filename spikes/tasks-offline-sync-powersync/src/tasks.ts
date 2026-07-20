import { generateKeyBetween } from 'fractional-indexing';

import { connector } from './connector';
import { powerSync } from './database';
import { TASKS_TABLE, type TaskRecord } from './schema';

export type TaskDestination = 'inbox' | 'today';

type MutableTaskFields = Pick<TaskRecord, 'title' | 'destination' | 'order_key' | 'completed_at' | 'deleted_at'>;

export async function createTask(title: string, destination: TaskDestination, origin: 'manual' | 'server' = 'manual') {
  const session = connector.currentSession;
  if (!session) {
    throw new Error('Sign in before creating a task');
  }

  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('Title is required');
  }

  const now = new Date().toISOString();
  const last = await powerSync.getOptional<Pick<TaskRecord, 'order_key'>>(
    `SELECT order_key FROM ${TASKS_TABLE}
     WHERE destination = ? AND deleted_at IS NULL AND completed_at IS NULL
     ORDER BY order_key DESC, id DESC LIMIT 1`,
    [destination]
  );

  const record = {
    id: crypto.randomUUID(),
    owner_id: session.user.id,
    title: normalizedTitle,
    destination,
    origin,
    order_key: generateKeyBetween(last?.order_key ?? null, null),
    completed_at: null,
    deleted_at: null,
    revision: 1,
    client_mutation_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now
  };

  if (origin === 'server') {
    const result = await connector.client.from(TASKS_TABLE).insert(record).select('id').single();
    if (result.error) {
      throw result.error;
    }
    return record.id;
  }

  await powerSync.execute(
    `INSERT INTO ${TASKS_TABLE}
      (id, owner_id, title, destination, origin, order_key, completed_at, deleted_at,
       revision, client_mutation_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.owner_id,
      record.title,
      record.destination,
      record.origin,
      record.order_key,
      record.completed_at,
      record.deleted_at,
      record.revision,
      record.client_mutation_id,
      record.created_at,
      record.updated_at
    ]
  );
  return record.id;
}

export async function updateTitle(taskId: string, title: string) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('Title is required');
  }
  await patchTask(taskId, { title: normalizedTitle });
}

export async function completeTask(taskId: string) {
  await patchTask(taskId, { completed_at: new Date().toISOString() });
}

export async function reopenTask(taskId: string) {
  await patchTask(taskId, { completed_at: null });
}

export async function deleteTask(taskId: string) {
  await patchTask(taskId, { deleted_at: new Date().toISOString() });
}

export async function restoreTask(taskId: string) {
  await patchTask(taskId, { deleted_at: null });
}

export async function moveBefore(taskId: string, beforeTaskId: string | null) {
  const rows = await powerSync.getAll<Pick<TaskRecord, 'id' | 'order_key'>>(
    `SELECT id, order_key FROM ${TASKS_TABLE}
     WHERE destination = 'today' AND deleted_at IS NULL AND completed_at IS NULL
     ORDER BY order_key, id`
  );
  const withoutTask = rows.filter((row) => row.id !== taskId);
  const targetIndex = beforeTaskId ? withoutTask.findIndex((row) => row.id === beforeTaskId) : withoutTask.length;
  if (targetIndex < 0) {
    throw new Error('Reorder target was not found');
  }

  const left = targetIndex > 0 ? withoutTask[targetIndex - 1].order_key : null;
  const right = targetIndex < withoutTask.length ? withoutTask[targetIndex].order_key : null;
  await patchTask(taskId, { order_key: generateKeyBetween(left, right) });
}

export async function clearConflicts() {
  await powerSync.execute('DELETE FROM tasks_spike_conflicts');
}

async function patchTask(taskId: string, fields: Partial<MutableTaskFields>) {
  const task = await powerSync.getOptional<Pick<TaskRecord, 'revision'>>(
    `SELECT revision FROM ${TASKS_TABLE} WHERE id = ?`,
    [taskId]
  );
  if (!task) {
    throw new Error('Task was not found');
  }

  const allowed = ['title', 'destination', 'order_key', 'completed_at', 'deleted_at'] as const;
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const field of allowed) {
    if (field in fields) {
      assignments.push(`${field} = ?`);
      values.push(fields[field]);
    }
  }
  assignments.push('revision = ?', 'updated_at = ?');
  values.push(Number(task.revision) + 1, new Date().toISOString(), taskId);

  await powerSync.execute(
    `UPDATE ${TASKS_TABLE} SET ${assignments.join(', ')} WHERE id = ?`,
    values
  );
}

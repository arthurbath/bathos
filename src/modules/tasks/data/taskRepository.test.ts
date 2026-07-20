import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import type { TaskTodo } from '@/modules/tasks/types/tasks';

import {
  InvalidTaskMutationError,
  TaskNotFoundError,
  TaskRepository,
  type TaskRepositoryDatabase,
} from './taskRepository';

const timestamp = '2026-07-20T04:30:00.000Z';

const existingTask: TaskTodo = {
  id: 'task-a',
  owner_id: 'owner-a',
  title: 'Existing task',
  notes: '',
  lifecycle: 'open',
  completed_at: null,
  canceled_at: null,
  disposition: 'present',
  deleted_at: null,
  destination: 'inbox',
  order_key: 'a0',
  entry_channel: 'web',
  source_kind: null,
  source_url: null,
  source_title: null,
  source_external_id: null,
  revision: 1,
  client_mutation_id: 'mutation-a',
  created_at: '2026-07-20T04:00:00.000Z',
  updated_at: '2026-07-20T04:00:00.000Z',
};

function createHarness(queryResult: unknown | null) {
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
    getOptional: vi.fn().mockResolvedValue(queryResult),
  } as unknown as Transaction;
  const database = {
    writeTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  } as unknown as TaskRepositoryDatabase;
  const ids = ['task-new', 'mutation-new', 'mutation-next'];
  const repository = new TaskRepository(database, {
    createId: () => ids.shift() ?? 'mutation-fallback',
    now: () => timestamp,
  });

  return { database, repository, transaction };
}

describe('task repository', () => {
  it('creates a complete offline row after the current destination tail', async () => {
    const { repository, transaction } = createHarness({ order_key: 'a0' });

    const task = await repository.createTask({
      ownerId: 'owner-a',
      title: '  New task  ',
      destination: 'today',
      entryChannel: 'raycast',
    });

    expect(task).toMatchObject({
      id: 'task-new',
      owner_id: 'owner-a',
      title: 'New task',
      destination: 'today',
      entry_channel: 'raycast',
      revision: 1,
      client_mutation_id: 'mutation-new',
    });
    expect(task.order_key > 'a0').toBe(true);
    expect(transaction.execute).toHaveBeenCalledOnce();
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain('INSERT INTO tasks_todos');
  });

  it('updates editable fields with exactly one revision and a new mutation identifier', async () => {
    const { repository, transaction } = createHarness(existingTask);

    const task = await repository.updateTask('owner-a', 'task-a', {
      title: '  Revised task  ',
      destination: 'today',
    });

    expect(task).toMatchObject({
      title: 'Revised task',
      destination: 'today',
      revision: 2,
      client_mutation_id: 'task-new',
      updated_at: timestamp,
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'revision = ?, client_mutation_id = ?, updated_at = ?',
    );
  });

  it('uses the shared lifecycle contract for completion, deletion, and restoration', async () => {
    const completeHarness = createHarness(existingTask);
    const completed = await completeHarness.repository.transitionTask(
      'owner-a',
      'task-a',
      'complete',
    );
    expect(completed).toMatchObject({
      lifecycle: 'completed',
      completed_at: timestamp,
      revision: 2,
    });

    const deleteHarness = createHarness(completed);
    const deleted = await deleteHarness.repository.transitionTask('owner-a', 'task-a', 'delete');
    expect(deleted).toMatchObject({
      lifecycle: 'completed',
      disposition: 'deleted',
      deleted_at: timestamp,
      revision: 3,
    });

    const restoreHarness = createHarness(deleted);
    const restored = await restoreHarness.repository.transitionTask('owner-a', 'task-a', 'restore');
    expect(restored).toMatchObject({
      lifecycle: 'completed',
      disposition: 'present',
      deleted_at: null,
      revision: 4,
    });
  });

  it('does not enqueue a duplicate mutation for an idempotent state transition', async () => {
    const completed = { ...existingTask, lifecycle: 'completed' as const, completed_at: timestamp };
    const { repository, transaction } = createHarness(completed);

    await expect(repository.transitionTask('owner-a', 'task-a', 'complete')).resolves.toBe(completed);
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  it('rejects invalid source records and missing owned tasks', async () => {
    const invalidHarness = createHarness(null);
    await expect(
      invalidHarness.repository.createTask({
        ownerId: 'owner-a',
        title: 'Read later',
        sourceKind: 'reading_item',
      }),
    ).rejects.toThrow(InvalidTaskMutationError);

    await expect(
      invalidHarness.repository.createTask({
        ownerId: 'owner-a',
        title: 'Unstructured source',
        sourceUrl: 'https://example.com',
      }),
    ).rejects.toThrow('Source details require a structured source kind');

    await expect(
      invalidHarness.repository.updateTask('owner-a', 'missing', { notes: 'No task' }),
    ).rejects.toThrow(TaskNotFoundError);
  });

  it('validates source edits against the complete current record', async () => {
    const sourcedTask = {
      ...existingTask,
      source_kind: 'webpage' as const,
      source_url: 'https://example.com',
    };
    const { repository, transaction } = createHarness(sourcedTask);

    await expect(
      repository.updateTask('owner-a', 'task-a', { source_url: null }),
    ).rejects.toThrow('Web and reading sources require a URL');
    expect(transaction.execute).not.toHaveBeenCalled();
  });
});

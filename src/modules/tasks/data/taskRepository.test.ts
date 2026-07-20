import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { snapshotTask, type TaskHistoryStorageRow } from '@/modules/tasks/domain/taskHistory';

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
  today_section: 'daytime',
  order_key: 'a0',
  start_date: null,
  deadline: null,
  entry_channel: 'web',
  last_mutation_channel: 'web',
  last_actor_type: 'user',
  undo_source_event_id: null,
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
  it('persists one canonical planning time zone per owner', async () => {
    const create = createHarness(null);
    await expect(
      create.repository.ensurePlanningSettings('owner-a', 'America/Los_Angeles'),
    ).resolves.toMatchObject({
      id: 'owner-a',
      owner_id: 'owner-a',
      planning_timezone: 'America/Los_Angeles',
      revision: 1,
      client_mutation_id: 'task-new',
    });
    expect(create.transaction.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tasks_user_settings'),
      expect.any(Array),
    );

    const existing = {
      id: 'owner-a',
      owner_id: 'owner-a',
      planning_timezone: 'America/New_York',
      revision: 2,
      client_mutation_id: 'mutation-settings',
      created_at: timestamp,
      updated_at: timestamp,
    };
    const reuse = createHarness(existing);
    await expect(
      reuse.repository.ensurePlanningSettings('owner-a', 'America/Los_Angeles'),
    ).resolves.toBe(existing);
    expect(reuse.transaction.execute).not.toHaveBeenCalled();

    await expect(
      create.repository.ensurePlanningSettings('owner-a', 'Not/A_Time_Zone'),
    ).rejects.toThrow('A recognized IANA planning time zone is required');
  });

  it('creates a complete offline row after the current destination tail', async () => {
    const { repository, transaction } = createHarness({ order_key: 'a0' });

    const task = await repository.createTask({
      ownerId: 'owner-a',
      title: '  New task  ',
      destination: 'today',
      today_section: 'daytime',
      entryChannel: 'raycast',
    });

    expect(task).toMatchObject({
      id: 'task-new',
      owner_id: 'owner-a',
      title: 'New task',
      destination: 'today',
      entry_channel: 'raycast',
      last_mutation_channel: 'raycast',
      last_actor_type: 'user',
      undo_source_event_id: null,
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
      last_mutation_channel: 'web',
      last_actor_type: 'user',
      undo_source_event_id: null,
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'revision = ?, client_mutation_id = ?, updated_at = ?',
    );
  });

  it('moves work to a Today section at the end of that section order', async () => {
    const { repository, transaction } = createHarness(existingTask);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce({ order_key: 'a0' });

    const moved = await repository.moveTask('owner-a', 'task-a', {
      destination: 'today',
      todaySection: 'evening',
      startDate: '2026-07-20',
    });

    expect(moved).toMatchObject({
      destination: 'today',
      today_section: 'evening',
      start_date: '2026-07-20',
      revision: 2,
    });
    expect(moved.order_key > 'a0').toBe(true);
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain('today_section = ?');
  });

  it('moves active work to Anytime or Someday with destination-scoped planning', async () => {
    const anytimeHarness = createHarness(existingTask);
    vi.mocked(anytimeHarness.transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce({ order_key: 'a0' });

    await expect(anytimeHarness.repository.moveTask('owner-a', 'task-a', {
      destination: 'anytime',
      startDate: '2026-07-24',
    })).resolves.toMatchObject({
      destination: 'anytime',
      today_section: 'daytime',
      start_date: '2026-07-24',
    });

    const scheduledTask = {
      ...existingTask,
      destination: 'today' as const,
      today_section: 'evening' as const,
      start_date: '2026-07-20',
      deadline: '2026-07-24',
    };
    const somedayHarness = createHarness(scheduledTask);
    vi.mocked(somedayHarness.transaction.getOptional)
      .mockResolvedValueOnce(scheduledTask)
      .mockResolvedValueOnce(null);

    await expect(somedayHarness.repository.moveTask('owner-a', 'task-a', {
      destination: 'someday',
      todaySection: 'daytime',
      startDate: null,
    })).resolves.toMatchObject({
      destination: 'someday',
      today_section: 'daytime',
      start_date: null,
      deadline: '2026-07-24',
    });
  });

  it('rejects Today-only placement outside Today and start dates in inactive destinations', async () => {
    const { repository } = createHarness(existingTask);

    await expect(repository.createTask({
      ownerId: 'owner-a',
      title: 'Invalid section',
      destination: 'inbox',
      todaySection: 'evening',
    })).rejects.toThrow('This Evening is available only within Today');
    await expect(repository.moveTask('owner-a', 'task-a', {
      destination: 'inbox',
      startDate: '2026-07-20',
    })).rejects.toThrow('Inbox work cannot retain a start date');
    await expect(repository.createTask({
      ownerId: 'owner-a',
      title: 'Inactive later task',
      destination: 'someday',
      startDate: '2026-07-20',
    })).rejects.toThrow('Someday work cannot retain a start date');

    const somedayTask = { ...existingTask, destination: 'someday' as const };
    const updateHarness = createHarness(somedayTask);
    await expect(updateHarness.repository.updateTask('owner-a', 'task-a', {
      start_date: '2026-07-20',
    })).rejects.toThrow('Someday work cannot retain a start date');
    expect(updateHarness.transaction.execute).not.toHaveBeenCalled();
  });

  it('restores the prior snapshot as a revision-checked inverse mutation', async () => {
    const completedTask: TaskTodo = {
      ...existingTask,
      lifecycle: 'completed',
      completed_at: timestamp,
      revision: 2,
      client_mutation_id: 'mutation-complete',
      updated_at: timestamp,
    };
    const event: TaskHistoryStorageRow = {
      id: 'event-complete',
      owner_id: 'owner-a',
      task_id: 'task-a',
      client_mutation_id: 'mutation-complete',
      actor_type: 'user',
      mutation_channel: 'web',
      affected_ids: JSON.stringify(['task-a']),
      base_revision: 1,
      result_revision: 2,
      transition: 'complete',
      occurred_at: timestamp,
      outcome: 'accepted',
      code: null,
      before_state: JSON.stringify(snapshotTask(existingTask)),
      after_state: JSON.stringify(snapshotTask(completedTask)),
    };
    const { repository, transaction } = createHarness(null);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(completedTask);

    const undone = await repository.undoTask('owner-a', 'event-complete', {
      channel: 'raycast',
    });

    expect(undone).toMatchObject({
      lifecycle: 'open',
      completed_at: null,
      revision: 3,
      client_mutation_id: 'task-new',
      last_mutation_channel: 'raycast',
      last_actor_type: 'user',
      undo_source_event_id: 'event-complete',
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'undo_source_event_id = ?',
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

  it('validates date-only planning ranges against the complete current task', async () => {
    const { repository, transaction } = createHarness({
      ...existingTask,
      destination: 'anytime',
      start_date: '2026-07-20',
    });

    await expect(
      repository.updateTask('owner-a', 'task-a', { deadline: '2026-07-24' }),
    ).resolves.toMatchObject({ start_date: '2026-07-20', deadline: '2026-07-24' });
    expect(transaction.execute).toHaveBeenCalledOnce();

    const invalidHarness = createHarness({
      ...existingTask,
      destination: 'anytime',
      start_date: '2026-07-24',
    });
    await expect(
      invalidHarness.repository.updateTask('owner-a', 'task-a', { deadline: '2026-07-20' }),
    ).rejects.toThrow('Deadline cannot be earlier than the start date');
    expect(invalidHarness.transaction.execute).not.toHaveBeenCalled();
  });
});

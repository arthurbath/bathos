import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import type { TaskTodo } from '@/modules/tasks/types/tasks';
import { snapshotTask, type TaskHistoryStorageRow } from '@/modules/tasks/domain/taskHistory';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

import {
  InvalidTaskMutationError,
  TaskNotFoundError,
  TaskRepository,
  type TaskRepositoryDatabase,
} from './taskRepository';

const timestamp = '2026-07-20T04:30:00.000Z';

const existingTask: TaskTodo = taskTodoFixture({
  id: 'task-a',
  title: 'Existing task',
  today_section: 'next',
  start_date: null,
});

function createHarness(queryResult: unknown | null) {
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
    get: vi.fn().mockResolvedValue(queryResult),
    getAll: vi.fn().mockResolvedValue([]),
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

  it('activates reached local start dates once while retaining their day horizon', async () => {
    const { repository, transaction } = createHarness(null);
    vi.mocked(transaction.getAll).mockResolvedValueOnce([
      { ...existingTask, start_date: '2026-07-20' },
    ]);

    await expect(
      repository.activateDueStartDates('owner-a', '2026-07-20'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'task-a',
        start_date: null,
        today_section: 'next',
        last_mutation_channel: 'native',
        last_actor_type: 'system',
        revision: 2,
      }),
    ]);
    expect(transaction.getAll).toHaveBeenCalledWith(
      expect.stringContaining('start_date <= ?'),
      ['owner-a', '2026-07-20'],
    );
    expect(transaction.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks_todos'),
      expect.arrayContaining([null, 'native', 'system', 'task-a', 'owner-a']),
    );
  });

  it('creates a complete offline row after the current destination tail', async () => {
    const { repository, transaction } = createHarness({ order_key: 'a0' });

    const task = await repository.createTask({
      ownerId: 'owner-a',
      title: '  New task  ',
      destination: 'anytime',
      todaySection: 'next',
      actionability: 'actionable',
      entryChannel: 'raycast',
    });

    expect(task).toMatchObject({
      id: 'task-new',
      owner_id: 'owner-a',
      title: 'New task',
      destination: 'anytime',
      today_section: 'next',
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

  it('places ordinary captures in active Today Next without a Start Date', async () => {
    const { repository } = createHarness(null);

    await expect(repository.createTask({
      ownerId: 'owner-a',
      title: 'Unprocessed capture',
    })).resolves.toMatchObject({
      title: 'Unprocessed capture',
      destination: 'anytime',
      today_section: 'next',
      start_date: null,
    });
  });

  it('requires assigned start dates to be future dates in the owner planning time zone', async () => {
    const rejected = createHarness(null);
    await expect(rejected.repository.createTask({
      ownerId: 'owner-a',
      title: 'Reached start date',
      startDate: '2026-07-20',
    })).rejects.toThrow('Start date must be after today');
    expect(rejected.transaction.execute).not.toHaveBeenCalled();

    const accepted = createHarness(null);
    vi.mocked(accepted.transaction.getAll).mockResolvedValueOnce([
      { planning_timezone: 'America/Los_Angeles' },
    ]);
    await expect(accepted.repository.createTask({
      ownerId: 'owner-a',
      title: 'Tomorrow in the owner time zone',
      startDate: '2026-07-20',
    })).resolves.toMatchObject({
      start_date: '2026-07-20',
      today_section: 'next',
    });
  });

  it('updates editable fields with exactly one revision and a new mutation identifier', async () => {
    const { repository, transaction } = createHarness(existingTask);

    const task = await repository.updateTask('owner-a', 'task-a', {
      title: '  Revised task  ',
      today_section: 'next',
    });

    expect(task).toMatchObject({
      title: 'Revised task',
      destination: 'anytime',
      today_section: 'next',
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

  it('updates structured actionability without changing planning placement', async () => {
    const { repository } = createHarness(existingTask);

    await expect(repository.updateTask('owner-a', 'task-a', {
      actionability: 'rechecking',
    })).resolves.toMatchObject({
      actionability: 'rechecking',
      destination: 'anytime',
      order_key: 'a0',
      revision: 2,
    });
  });

  it('rejects actionability changes on terminal or deleted tasks', async () => {
    for (const current of [
      { ...existingTask, lifecycle: 'completed' as const, completed_at: timestamp },
      { ...existingTask, disposition: 'deleted' as const, deleted_at: timestamp },
    ]) {
      const { repository, transaction } = createHarness(current);
      await expect(repository.updateTask('owner-a', 'task-a', {
        actionability: 'waiting',
      })).rejects.toThrow('Actionability can be changed only on open, present tasks');
      expect(transaction.execute).not.toHaveBeenCalled();
    }
  });

  it('moves work to a Today section at the end of that section order', async () => {
    const { repository, transaction } = createHarness(existingTask);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce({ order_key: 'a0' });

    const moved = await repository.moveTask('owner-a', 'task-a', {
      destination: 'anytime',
      todaySection: 'later',
      startDate: '2026-07-21',
    });

    expect(moved).toMatchObject({
      destination: 'anytime',
      today_section: 'later',
      start_date: '2026-07-21',
      revision: 2,
    });
    expect(moved.order_key > 'a0').toBe(true);
    expect(vi.mocked(transaction.getOptional).mock.calls.at(-1)?.[0]).toContain('today_section IS ?');
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
      today_section: 'next',
      start_date: '2026-07-24',
    });

    const scheduledTask = {
      ...existingTask,
      destination: 'anytime' as const,
      today_section: 'later' as const,
      start_date: '2026-07-20',
      deadline: '2026-07-24',
    };
    const somedayHarness = createHarness(scheduledTask);
    vi.mocked(somedayHarness.transaction.getOptional)
      .mockResolvedValueOnce(scheduledTask)
      .mockResolvedValueOnce(null);

    await expect(somedayHarness.repository.moveTask('owner-a', 'task-a', {
      destination: 'someday',
      todaySection: null,
      startDate: null,
    })).resolves.toMatchObject({
      destination: 'someday',
      today_section: null,
      start_date: null,
      deadline: '2026-07-24',
    });
  });

  it('plans multiple selected tasks atomically and preserves their input order', async () => {
    const secondTask = {
      ...existingTask,
      id: 'task-b',
      title: 'Second task',
      order_key: 'a1',
      client_mutation_id: 'mutation-b',
    };
    const { database, repository, transaction } = createHarness(null);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce(secondTask)
      .mockResolvedValueOnce({ order_key: 'a9' });

    const moved = await repository.moveTasks('owner-a', ['task-a', 'task-b'], {
      destination: 'anytime',
      todaySection: 'later',
      startDate: '2026-07-21',
    });

    expect(database.writeTransaction).toHaveBeenCalledOnce();
    expect(moved).toHaveLength(2);
    expect(moved.map(({ id }) => id)).toEqual(['task-a', 'task-b']);
    expect(moved[0]).toMatchObject({
      destination: 'anytime',
      today_section: 'later',
      start_date: '2026-07-21',
      revision: 2,
    });
    expect(moved[1].order_key > moved[0].order_key).toBe(true);
    expect(transaction.execute).toHaveBeenCalledTimes(2);
    expect(vi.mocked(transaction.getOptional).mock.calls[2][0]).toContain(
      'id NOT IN (?, ?)',
    );
  });

  it('rejects an invalid bulk member before writing any selected task', async () => {
    const completedTask = {
      ...existingTask,
      id: 'task-b',
      lifecycle: 'completed' as const,
      completed_at: timestamp,
    };
    const { repository, transaction } = createHarness(null);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce(completedTask);

    await expect(repository.moveTasks('owner-a', ['task-a', 'task-b'], {
      destination: 'anytime',
      startDate: null,
    })).rejects.toThrow('Bulk planning applies only to open, present tasks');
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  it('allows a bulk start date beyond a selected deadline', async () => {
    const constrainedTask = {
      ...existingTask,
      id: 'task-b',
      title: 'Deadline-constrained task',
      deadline: '2026-07-20',
      client_mutation_id: 'mutation-b',
    };
    const { repository, transaction } = createHarness(null);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce(constrainedTask);

    await expect(repository.moveTasks('owner-a', ['task-a', 'task-b'], {
      destination: 'anytime',
      todaySection: 'next',
      startDate: '2026-07-21',
    })).resolves.toHaveLength(2);
    expect(transaction.execute).toHaveBeenCalledTimes(2);
  });

  it('moves a task into one owned project without changing planning order', async () => {
    const { repository, transaction } = createHarness(existingTask);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce({ id: 'project-a' });

    await expect(repository.moveTaskToContainer('owner-a', 'task-a', {
      projectId: 'project-a',
      hierarchyOrderKey: 'a1',
    })).resolves.toMatchObject({
      project_id: 'project-a',
      hierarchy_order_key: 'a1',
      destination: 'anytime',
      order_key: 'a0',
      revision: 2,
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'project_id = ?, hierarchy_order_key = ?',
    );
  });

  it('assigns a hierarchy tail key when an edit places a task into a project', async () => {
    const { repository, transaction } = createHarness(existingTask);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(existingTask)
      .mockResolvedValueOnce({ id: 'project-a' })
      .mockResolvedValueOnce({ hierarchy_order_key: 'a0' });

    const moved = await repository.updateTask('owner-a', 'task-a', {
      area_id: null,
      project_id: 'project-a',
    });

    expect(moved).toMatchObject({
      area_id: null,
      project_id: 'project-a',
      destination: 'anytime',
      order_key: 'a0',
    });
    expect(moved.hierarchy_order_key! > 'a0').toBe(true);
    expect(vi.mocked(transaction.getOptional).mock.calls.at(-1)?.[0]).toContain(
      'hierarchy_order_key IS NOT NULL',
    );
  });

  it('rejects Today membership and start dates in inactive Someday', async () => {
    const { repository } = createHarness(existingTask);

    await expect(repository.createTask({
      ownerId: 'owner-a',
      title: 'Invalid section',
      destination: 'someday',
      todaySection: 'later',
    })).rejects.toThrow('Someday work cannot retain planning dates');
    await expect(repository.createTask({
      ownerId: 'owner-a',
      title: 'Inactive later task',
      destination: 'someday',
      todaySection: null,
      startDate: '2026-07-20',
    })).rejects.toThrow('Someday work cannot retain planning dates');

    const somedayTask = {
      ...existingTask, destination: 'someday' as const, today_section: null, start_date: null,
    };
    const updateHarness = createHarness(somedayTask);
    await expect(updateHarness.repository.updateTask('owner-a', 'task-a', {
      start_date: '2026-07-20',
    })).rejects.toThrow('Someday work cannot retain planning dates');
    expect(updateHarness.transaction.execute).not.toHaveBeenCalled();
  });

  it('restores the prior snapshot as an exact-state-checked inverse mutation', async () => {
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

  it('reapplies the source after-state as a guarded redo mutation', async () => {
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
    const undoneTask: TaskTodo = {
      ...existingTask,
      revision: 3,
      client_mutation_id: 'mutation-undo',
      updated_at: timestamp,
    };
    const { repository, transaction } = createHarness(null);
    vi.mocked(transaction.getOptional)
      .mockResolvedValueOnce(event)
      .mockResolvedValueOnce(undoneTask);

    const redone = await repository.redoTask('owner-a', 'event-complete');

    expect(redone).toMatchObject({
      lifecycle: 'completed',
      completed_at: timestamp,
      revision: 4,
      undo_source_event_id: 'event-complete',
    });
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
    vi.mocked(deleteHarness.transaction.getAll).mockResolvedValueOnce([{
      entity_type: 'todo', id: 'task-a', revision: 2,
    }]);
    vi.mocked(deleteHarness.transaction.getOptional).mockResolvedValueOnce({
      ...completed,
      disposition: 'deleted',
      deleted_at: timestamp,
      deletion_root_id: 'task-a',
      revision: 3,
    });
    const deleted = await deleteHarness.repository.transitionTask('owner-a', 'task-a', 'delete');
    expect(deleted).toMatchObject({
      lifecycle: 'completed',
      disposition: 'deleted',
      deleted_at: timestamp,
      revision: 3,
    });

    const restoreHarness = createHarness(deleted);
    vi.mocked(restoreHarness.transaction.getAll).mockResolvedValueOnce([{
      entity_type: 'todo', id: 'task-a', revision: 3,
    }]);
    vi.mocked(restoreHarness.transaction.get).mockResolvedValueOnce(deleted);
    vi.mocked(restoreHarness.transaction.getOptional).mockResolvedValueOnce({
      ...deleted,
      disposition: 'present',
      deleted_at: null,
      deletion_root_id: null,
      revision: 4,
    });
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

  it('allows start dates after deadlines while retaining both facts', async () => {
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
    ).resolves.toMatchObject({ start_date: '2026-07-24', deadline: '2026-07-20' });
    expect(invalidHarness.transaction.execute).toHaveBeenCalledOnce();
  });
});

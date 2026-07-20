import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import type { TaskChecklistItem } from '@/modules/tasks/types/tasks';

import {
  TaskHierarchyRepository,
  type TaskHierarchyRepositoryDatabase,
} from './taskHierarchyRepository';

const timestamp = '2026-07-20T06:30:00.000Z';

function createHarness(results: unknown[] = []) {
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
    getOptional: vi.fn(),
  } as unknown as Transaction;
  for (const result of results) {
    vi.mocked(transaction.getOptional).mockResolvedValueOnce(result);
  }
  const database = {
    writeTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) =>
      callback(transaction)),
  } as unknown as TaskHierarchyRepositoryDatabase;
  const ids = [
    'entity-new',
    'mutation-new',
    'entity-next',
    'mutation-next',
    'mutation-update',
  ];
  const repository = new TaskHierarchyRepository(database, {
    createId: () => ids.shift() ?? 'mutation-fallback',
    now: () => timestamp,
  });
  return { repository, transaction };
}

describe('task hierarchy repository', () => {
  it('creates an area with owner-scoped order and mutation metadata', async () => {
    const { repository, transaction } = createHarness([{ order_key: 'a0' }]);

    await expect(repository.createArea({
      ownerId: 'owner-a',
      title: '  Work  ',
      entryChannel: 'raycast',
    })).resolves.toMatchObject({
      id: 'entity-new',
      owner_id: 'owner-a',
      title: 'Work',
      entry_channel: 'raycast',
      last_mutation_channel: 'raycast',
      revision: 1,
      client_mutation_id: 'mutation-new',
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'INSERT INTO tasks_areas',
    );
  });

  it('keeps project hierarchy and planning order independent', async () => {
    const { repository, transaction } = createHarness([
      { id: 'area-a' },
      { order_key: 'a0' },
      { planning_order_key: 'a1' },
    ]);

    const project = await repository.createProject({
      ownerId: 'owner-a',
      areaId: 'area-a',
      title: 'Launch project',
    });

    expect(project.area_id).toBe('area-a');
    expect(project.order_key > 'a0').toBe(true);
    expect(project.planning_order_key > 'a1').toBe(true);
    expect(project.order_key).not.toBe(project.planning_order_key);
    expect(vi.mocked(transaction.getOptional).mock.calls[1][0]).toContain('area_id IS ?');
    expect(vi.mocked(transaction.getOptional).mock.calls[2][0]).toContain(
      'planning_order_key',
    );
  });

  it('creates headings and checklist items beneath one explicit parent', async () => {
    const { repository, transaction } = createHarness([
      { id: 'project-a' },
      null,
      { id: 'task-a' },
      null,
    ]);

    const heading = await repository.createHeading({
      ownerId: 'owner-a',
      projectId: 'project-a',
      title: 'First phase',
    });
    const item = await repository.createChecklistItem({
      ownerId: 'owner-a',
      taskId: 'task-a',
      title: 'Confirm details',
    });

    expect(heading).toMatchObject({ project_id: 'project-a', disposition: 'present' });
    expect(item).toMatchObject({ task_id: 'task-a', completed: false });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'INSERT INTO tasks_headings',
    );
    expect(vi.mocked(transaction.execute).mock.calls[1][0]).toContain(
      'INSERT INTO tasks_checklist_items',
    );
  });

  it('completes a checklist item with one revision-safe mutation', async () => {
    const existing: TaskChecklistItem = {
      id: 'item-a',
      owner_id: 'owner-a',
      task_id: 'task-a',
      title: 'Confirm details',
      completed: false,
      completed_at: null,
      order_key: 'a0',
      disposition: 'present',
      deleted_at: null,
      entry_channel: 'web',
      last_mutation_channel: 'web',
      last_actor_type: 'user',
      revision: 1,
      client_mutation_id: 'mutation-old',
      created_at: '2026-07-20T06:00:00.000Z',
      updated_at: '2026-07-20T06:00:00.000Z',
    };
    const { repository, transaction } = createHarness([existing]);

    await expect(
      repository.completeChecklistItem('owner-a', 'item-a', true),
    ).resolves.toMatchObject({
      completed: true,
      completed_at: timestamp,
      revision: 2,
      client_mutation_id: 'entity-new',
    });
    expect(vi.mocked(transaction.execute).mock.calls[0][0]).toContain(
      'revision = ?, client_mutation_id = ?',
    );
  });
});

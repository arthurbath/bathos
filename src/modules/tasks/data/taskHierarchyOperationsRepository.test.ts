import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import {
  TaskHierarchyOperationRejectedError,
  TaskHierarchyOperationsRepository,
} from './taskHierarchyOperationsRepository';

const timestamp = '2026-07-20T08:30:00.000Z';

function createHarness(options: {
  all?: unknown[][];
  optional?: unknown[];
} = {}) {
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
    get: vi.fn(),
    getAll: vi.fn(),
    getOptional: vi.fn(),
  } as unknown as Transaction;
  for (const result of options.all ?? []) {
    vi.mocked(transaction.getAll).mockResolvedValueOnce(result);
  }
  for (const result of options.optional ?? []) {
    vi.mocked(transaction.getOptional).mockResolvedValueOnce(result);
  }
  const database = {
    writeTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) => (
      callback(transaction)
    )),
  };
  const ids = ['operation-a', 'mutation-project', 'mutation-task', 'mutation-other'];
  const repository = new TaskHierarchyOperationsRepository(database, {
    createId: () => ids.shift() ?? 'mutation-fallback',
    now: () => timestamp,
  });
  return { repository, transaction };
}

describe('task hierarchy operations repository', () => {
  it('rejects a project terminal transition without an explicit descendant policy', async () => {
    const { repository } = createHarness({
      all: [[{ entity_type: 'project', id: 'project-a', revision: 3 }]],
      optional: [{ id: 'task-a' }],
    });

    await expect(repository.request({
      ownerId: 'owner-a',
      rootType: 'project',
      rootId: 'project-a',
      operation: 'complete_project',
    })).rejects.toEqual(expect.objectContaining({
      name: TaskHierarchyOperationRejectedError.name,
      code: 'open_descendants',
    }));
  });

  it('queues one revision-set operation beside an optimistic project cascade', async () => {
    const { repository, transaction } = createHarness({
      all: [
        [{ entity_type: 'project', id: 'project-a', revision: 3 }],
        [{ entity_type: 'todo', id: 'task-a', revision: 7 }],
      ],
    });

    await expect(repository.request({
      ownerId: 'owner-a',
      rootType: 'project',
      rootId: 'project-a',
      operation: 'complete_project',
      descendantPolicy: 'cascade',
    })).resolves.toEqual({
      id: 'operation-a',
      affectedIds: ['project-a', 'task-a'],
    });

    const calls = vi.mocked(transaction.execute).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toContain('UPDATE tasks_projects');
    expect(calls[1][0]).toContain('UPDATE tasks_todos');
    expect(calls[2][0]).toContain('INSERT INTO tasks_hierarchy_operations');
    expect(calls[2][1]).toContain(JSON.stringify({ 'project-a': 3, 'task-a': 7 }));
  });

  it('marks every optimistic deletion with the selected root before queuing upload', async () => {
    const { repository, transaction } = createHarness({
      all: [[
        { entity_type: 'project', id: 'project-a', revision: 2 },
        { entity_type: 'heading', id: 'heading-a', revision: 1 },
        { entity_type: 'todo', id: 'task-a', revision: 4 },
        { entity_type: 'checklist_item', id: 'item-a', revision: 1 },
      ]],
    });

    await repository.request({
      ownerId: 'owner-a',
      rootType: 'project',
      rootId: 'project-a',
      operation: 'delete',
      descendantPolicy: 'cascade',
    });

    const calls = vi.mocked(transaction.execute).mock.calls;
    expect(calls).toHaveLength(5);
    for (const [query, parameters] of calls.slice(0, 4)) {
      expect(query).toContain('deletion_root_id = ?');
      expect(parameters).toContain('project-a');
    }
    expect(calls[4][0]).toContain('INSERT INTO tasks_hierarchy_operations');
  });
});

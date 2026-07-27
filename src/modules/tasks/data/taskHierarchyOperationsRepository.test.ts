import type { Transaction } from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import {
  TaskHierarchyOperationRejectedError,
  TaskHierarchyOperationsRepository,
} from './taskHierarchyOperationsRepository';

const timestamp = '2026-07-20T08:30:00.000Z';

function createHarness(options: {
  all?: unknown[][];
  get?: unknown[];
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
  for (const result of options.get ?? []) {
    vi.mocked(transaction.get).mockResolvedValueOnce(result);
  }
  for (const result of options.optional ?? []) {
    vi.mocked(transaction.getOptional).mockResolvedValueOnce(result);
  }
  const database = {
    writeTransaction: vi.fn(async (callback: (value: Transaction) => Promise<unknown>) => (
      callback(transaction)
    )),
  } as unknown as ConstructorParameters<typeof TaskHierarchyOperationsRepository>[0];
  const ids = ['operation-a', 'mutation-area', 'mutation-task', 'mutation-item'];
  const repository = new TaskHierarchyOperationsRepository(database, {
    createId: () => ids.shift() ?? 'mutation-fallback',
    now: () => timestamp,
  });
  return { repository, transaction };
}

describe('task hierarchy operations repository', () => {
  it('rejects a hierarchy operation when the root is unavailable', async () => {
    const { repository } = createHarness({ all: [[]] });

    await expect(repository.request({
      ownerId: 'owner-a',
      rootType: 'area',
      rootId: 'area-a',
      operation: 'delete',
      descendantPolicy: 'cascade',
    })).rejects.toEqual(expect.objectContaining({
      name: TaskHierarchyOperationRejectedError.name,
      code: 'root_not_found',
    }));
  });

  it('marks an Area hierarchy deleted and queues one revision-set operation', async () => {
    const { repository, transaction } = createHarness({
      all: [[
        { entity_type: 'area', id: 'area-a', revision: 2 },
        { entity_type: 'todo', id: 'task-a', revision: 4 },
        { entity_type: 'checklist_item', id: 'item-a', revision: 1 },
      ]],
    });

    await expect(repository.request({
      ownerId: 'owner-a',
      rootType: 'area',
      rootId: 'area-a',
      operation: 'delete',
      descendantPolicy: 'cascade',
    })).resolves.toEqual({
      id: 'operation-a',
      affectedIds: ['area-a', 'task-a', 'item-a'],
    });

    const calls = vi.mocked(transaction.execute).mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0][0]).toContain('UPDATE tasks_areas');
    expect(calls[1][0]).toContain('UPDATE tasks_todos');
    expect(calls[2][0]).toContain('UPDATE tasks_checklist_items');
    for (const [query, parameters] of calls.slice(0, 3)) {
      expect(query).toContain('deletion_root_id = ?');
      expect(parameters).toContain('area-a');
    }
    expect(calls[3][0]).toContain('INSERT INTO tasks_hierarchy_operations');
    expect(calls[3][1]).toContain(JSON.stringify({
      'area-a': 2,
      'task-a': 4,
      'item-a': 1,
    }));
  });

  it('restores an already-detached task without an empty SQL assignment', async () => {
    const { repository, transaction } = createHarness({
      all: [[{ entity_type: 'todo', id: 'task-a', revision: 4 }]],
      get: [{ area_id: null }],
    });

    await repository.request({
      ownerId: 'owner-a',
      rootType: 'todo',
      rootId: 'task-a',
      operation: 'restore',
      descendantPolicy: 'cascade',
    });

    const [restoreQuery] = vi.mocked(transaction.execute).mock.calls[0];
    expect(restoreQuery).toContain("disposition = 'present'");
    expect(restoreQuery).not.toContain('SET\n          ,');
  });
});

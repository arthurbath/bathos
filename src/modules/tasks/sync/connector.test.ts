import {
  CrudEntry,
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudTransaction,
} from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import {
  TasksSyncConnector,
  TasksTransientSyncError,
  type TasksRemoteStore,
  type TasksRemoteWriteOutcome,
} from './connector';

const detectedAt = '2026-07-20T05:00:00.000Z';

function taskInsertEntry(destination: 'inbox' | 'today' | 'anytime' | 'someday' = 'inbox') {
  return new CrudEntry(1, UpdateType.PUT, 'tasks_todos', 'task-a', 1, {
    owner_id: 'owner-a',
    title: 'Offline task',
    notes: '',
    lifecycle: 'open',
    disposition: 'present',
    destination,
    today_section: 'daytime',
    actionability: 'actionable',
    order_key: 'a0',
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    undo_source_event_id: null,
    revision: 1,
    client_mutation_id: 'mutation-a',
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  });
}

function taskPatchEntry(data: Record<string, unknown> = {}) {
  return new CrudEntry(2, UpdateType.PATCH, 'tasks_todos', 'task-a', 2, {
    title: 'Revised task',
    revision: 2,
    client_mutation_id: 'mutation-b',
    updated_at: '2026-07-20T04:30:00.000Z',
    ...data,
  });
}

function settingsInsertEntry() {
  return new CrudEntry(3, UpdateType.PUT, 'tasks_user_settings', 'owner-a', 3, {
    owner_id: 'owner-a',
    planning_timezone: 'America/Los_Angeles',
    revision: 1,
    client_mutation_id: 'mutation-settings',
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  });
}

function areaInsertEntry() {
  return new CrudEntry(4, UpdateType.PUT, 'tasks_areas', 'area-a', 4, {
    owner_id: 'owner-a',
    title: 'Work',
    order_key: 'a0',
    disposition: 'present',
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: 'mutation-area',
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
  });
}

function checklistPatchEntry() {
  return new CrudEntry(5, UpdateType.PATCH, 'tasks_checklist_items', 'item-a', 5, {
    completed: 1,
    completed_at: '2026-07-20T05:00:00.000Z',
    revision: 2,
    client_mutation_id: 'mutation-checklist',
    updated_at: '2026-07-20T05:00:00.000Z',
  });
}

function hierarchyOperationEntry() {
  return new CrudEntry(6, UpdateType.PUT, 'tasks_hierarchy_operations', 'operation-a', 6, {
    owner_id: 'owner-a',
    root_type: 'project',
    root_id: 'project-a',
    operation: 'complete_project',
    descendant_policy: 'cascade',
    expected_revisions: JSON.stringify({ 'project-a': 2, 'task-a': 4 }),
    actor_type: 'user',
    mutation_channel: 'web',
    requested_at: detectedAt,
    outcome: 'pending',
    affected_ids: '[]',
    result_revisions: '{}',
  });
}

function createHarness(
  entry: CrudEntry | CrudEntry[],
  outcome: TasksRemoteWriteOutcome | Error = { status: 'applied' },
) {
  const complete = vi.fn().mockResolvedValue(undefined);
  const transaction = {
    crud: Array.isArray(entry) ? entry : [entry],
    complete,
  } as unknown as CrudTransaction;
  const database = {
    getNextCrudTransaction: vi.fn().mockResolvedValue(transaction),
    execute: vi.fn().mockResolvedValue({ rows: undefined, rowsAffected: 1 }),
  } as unknown as AbstractPowerSyncDatabase;
  const resolve = () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome));
  const remoteStore: TasksRemoteStore = {
    insertTask: vi.fn(resolve),
    updateTask: vi.fn(resolve),
    insertSettings: vi.fn(resolve),
    updateSettings: vi.fn(resolve),
    insertArea: vi.fn(resolve),
    updateArea: vi.fn(resolve),
    insertProject: vi.fn(resolve),
    updateProject: vi.fn(resolve),
    insertHeading: vi.fn(resolve),
    updateHeading: vi.fn(resolve),
    insertChecklistItem: vi.fn(resolve),
    updateChecklistItem: vi.fn(resolve),
    insertHierarchyOperation: vi.fn(resolve),
  };
  const connector = new TasksSyncConnector({
    endpoint: 'https://sync.example.test',
    remoteStore,
    now: () => detectedAt,
    getCredentials: vi.fn().mockResolvedValue({
      endpoint: 'https://sync.example.test',
      token: 'token',
    }),
  });

  return { complete, connector, database, remoteStore };
}

describe('task sync connector', () => {
  it('uploads the owner planning time zone through the same durable queue', async () => {
    const { connector, database, remoteStore } = createHarness(settingsInsertEntry());

    await connector.uploadData(database);

    expect(remoteStore.insertSettings).toHaveBeenCalledWith({
      id: 'owner-a',
      owner_id: 'owner-a',
      planning_timezone: 'America/Los_Angeles',
      revision: 1,
      client_mutation_id: 'mutation-settings',
      created_at: '2026-07-20T04:00:00.000Z',
      updated_at: '2026-07-20T04:00:00.000Z',
    });
  });

  it('uploads hierarchy inserts through the same revision-safe queue', async () => {
    const { connector, database, remoteStore } = createHarness(areaInsertEntry());

    await connector.uploadData(database);

    expect(remoteStore.insertArea).toHaveBeenCalledWith(expect.objectContaining({
      id: 'area-a',
      owner_id: 'owner-a',
      title: 'Work',
      revision: 1,
      client_mutation_id: 'mutation-area',
    }));
  });

  it('normalizes checklist booleans and uses the prior hierarchy revision', async () => {
    const { connector, database, remoteStore } = createHarness(checklistPatchEntry());

    await connector.uploadData(database);

    expect(remoteStore.updateChecklistItem).toHaveBeenCalledWith(
      'item-a',
      1,
      expect.objectContaining({ completed: true, revision: 2 }),
    );
  });

  it('uploads one atomic hierarchy operation instead of its optimistic row patches', async () => {
    const { connector, database, remoteStore } = createHarness([
      taskPatchEntry({ lifecycle: 'completed', completed_at: detectedAt }),
      hierarchyOperationEntry(),
    ]);

    await connector.uploadData(database);

    expect(remoteStore.updateTask).not.toHaveBeenCalled();
    expect(remoteStore.insertHierarchyOperation).toHaveBeenCalledWith({
      id: 'operation-a',
      owner_id: 'owner-a',
      root_type: 'project',
      root_id: 'project-a',
      operation: 'complete_project',
      descendant_policy: 'cascade',
      expected_revisions: { 'project-a': 2, 'task-a': 4 },
      actor_type: 'user',
      mutation_channel: 'web',
      requested_at: detectedAt,
    });
  });

  it('uploads complete inserts and restores omitted null fields', async () => {
    const { complete, connector, database, remoteStore } = createHarness(taskInsertEntry());

    await connector.uploadData(database);

    expect(remoteStore.insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-a',
        owner_id: 'owner-a',
        title: 'Offline task',
        completed_at: null,
        canceled_at: null,
        deleted_at: null,
        today_section: 'daytime',
        actionability: 'actionable',
        start_date: null,
        deadline: null,
        source_kind: null,
        last_mutation_channel: 'web',
        last_actor_type: 'user',
        undo_source_event_id: null,
      }),
    );
    expect(database.execute).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
  });

  it('uploads Anytime and Someday as durable planning destinations', async () => {
    for (const destination of ['anytime', 'someday'] as const) {
      const { connector, database, remoteStore } = createHarness(taskInsertEntry(destination));

      await connector.uploadData(database);

      expect(remoteStore.insertTask).toHaveBeenCalledWith(
        expect.objectContaining({ destination }),
      );
    }
  });

  it('uses the prior revision as the optimistic update precondition', async () => {
    const { complete, connector, database, remoteStore } = createHarness(taskPatchEntry());

    await connector.uploadData(database);

    expect(remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({ revision: 2, client_mutation_id: 'mutation-b' }),
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('uploads structured waiting state and rejects invalid actionability', async () => {
    const valid = createHarness(taskPatchEntry({ actionability: 'waiting' }));
    await valid.connector.uploadData(valid.database);
    expect(valid.remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({ actionability: 'waiting' }),
    );

    const invalid = createHarness(taskPatchEntry({ actionability: 'blocked' }));
    await invalid.connector.uploadData(invalid.database);
    expect(invalid.remoteStore.updateTask).not.toHaveBeenCalled();
    expect(invalid.database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO tasks_sync_issues'),
      expect.arrayContaining(['invalid_local_mutation']),
    );
  });

  it('uploads inverse-mutation metadata with an undo patch', async () => {
    const { connector, database, remoteStore } = createHarness(taskPatchEntry({
      last_mutation_channel: 'raycast',
      last_actor_type: 'user',
      undo_source_event_id: 'event-a',
    }));

    await connector.uploadData(database);

    expect(remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({
        last_mutation_channel: 'raycast',
        last_actor_type: 'user',
        undo_source_event_id: 'event-a',
      }),
    );
  });

  it('records content-free conflict diagnostics and drains the handled transaction', async () => {
    const { complete, connector, database } = createHarness(taskPatchEntry(), {
      status: 'conflict',
      remoteRevision: 3,
    });

    await connector.uploadData(database);

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO tasks_sync_issues'),
      ['crud-2', 'task-a', 'conflict', 'PATCH', 2, 3, detectedAt, 'revision_conflict'],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('never uploads a physical delete', async () => {
    const entry = new CrudEntry(3, UpdateType.DELETE, 'tasks_todos', 'task-a', 3);
    const { complete, connector, database, remoteStore } = createHarness(entry);

    await connector.uploadData(database);

    expect(remoteStore.insertTask).not.toHaveBeenCalled();
    expect(remoteStore.updateTask).not.toHaveBeenCalled();
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO tasks_sync_issues'),
      [
        'crud-3',
        'task-a',
        'rejected_operation',
        'DELETE',
        null,
        null,
        detectedAt,
        'hard_delete_not_supported',
      ],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('records malformed local writes without exposing task content', async () => {
    const { complete, connector, database, remoteStore } = createHarness(
      taskPatchEntry({ owner_id: 'owner-b' }),
    );

    await connector.uploadData(database);

    expect(remoteStore.updateTask).not.toHaveBeenCalled();
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO tasks_sync_issues'),
      [
        'crud-2',
        'task-a',
        'rejected_operation',
        'PATCH',
        2,
        null,
        detectedAt,
        'invalid_local_mutation',
      ],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('leaves transient failures queued for PowerSync retry', async () => {
    const transient = new TasksTransientSyncError('Network unavailable', '08006');
    const { complete, connector, database } = createHarness(taskInsertEntry(), transient);

    await expect(connector.uploadData(database)).rejects.toBe(transient);
    expect(complete).not.toHaveBeenCalled();
    expect(database.execute).not.toHaveBeenCalled();
  });

  it('rejects credentials issued for a different endpoint', async () => {
    const { connector } = createHarness(taskInsertEntry());
    const mismatched = new TasksSyncConnector({
      endpoint: 'https://sync.example.test',
      remoteStore: {} as TasksRemoteStore,
      getCredentials: async () => ({ endpoint: 'https://other.example.test', token: 'token' }),
    });

    await expect(connector.fetchCredentials()).resolves.toMatchObject({ token: 'token' });
    await expect(mismatched.fetchCredentials()).rejects.toThrow('does not match');
  });
});

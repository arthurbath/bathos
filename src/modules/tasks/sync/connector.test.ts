import {
  CrudEntry,
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudTransaction,
} from '@powersync/web';
import { describe, expect, it, vi } from 'vitest';

import {
  TasksSupabaseRemoteStore,
  TasksSyncConnector,
  TasksTransientSyncError,
  type TasksRemoteStore,
  type TasksRemoteWriteOutcome,
} from './connector';

const detectedAt = '2026-07-20T05:00:00.000Z';

function taskInsertEntry(
  destination: 'anytime' | 'someday' = 'anytime',
  todaySection: 'inbox' | 'now' | 'next' | 'later' | null = destination === 'someday'
    ? null
    : 'later',
) {
  return new CrudEntry(1, UpdateType.PUT, 'tasks_todos', 'task-a', 1, {
    owner_id: 'owner-a',
    title: 'Offline task',
    notes: '',
    lifecycle: 'open',
    disposition: 'present',
    destination,
    today_section: todaySection,
    actionability: 'actionable',
    order_key: 'a0',
    upcoming_order_key: 'a0',
    start_date: null,
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    last_operation_id: 'mutation-a',
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

function areaInsertEntry(data: Record<string, unknown> = {}) {
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
    ...data,
  });
}

function checklistPatchEntry() {
  return new CrudEntry(5, UpdateType.PATCH, 'tasks_checklist_items', 'item-a', 5, {
    completed: 1,
    completed_at: '2026-07-20T05:00:00.000Z',
    last_operation_id: 'operation-checklist',
    revision: 2,
    client_mutation_id: 'mutation-checklist',
    updated_at: '2026-07-20T05:00:00.000Z',
  });
}

function hierarchyOperationEntry() {
  return new CrudEntry(6, UpdateType.PUT, 'tasks_hierarchy_operations', 'operation-a', 6, {
    owner_id: 'owner-a',
    root_type: 'todo',
    root_id: 'task-a',
    operation: 'delete',
    descendant_policy: 'cascade',
    expected_revisions: JSON.stringify({ 'task-a': 4 }),
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
  outcome: TasksRemoteWriteOutcome | Error | Array<TasksRemoteWriteOutcome | Error> = {
    status: 'applied',
  },
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
  const outcomes = Array.isArray(outcome) ? [...outcome] : [outcome];
  const resolve = () => {
    const nextOutcome = outcomes.shift() ?? outcomes.at(-1) ?? { status: 'applied' as const };
    return nextOutcome instanceof Error
      ? Promise.reject(nextOutcome)
      : Promise.resolve(nextOutcome);
  };
  const remoteStore: TasksRemoteStore = {
    insertTask: vi.fn(resolve),
    updateTask: vi.fn(resolve),
    insertSettings: vi.fn(resolve),
    updateSettings: vi.fn(resolve),
    insertArea: vi.fn(resolve),
    updateArea: vi.fn(resolve),
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
      automatic_list_sorting: false,
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

  it('rejects unsupported Area operation metadata before remote upload', async () => {
    const { connector, database, remoteStore } = createHarness(areaInsertEntry({
      last_operation_id: 'operation-area',
    }));

    await connector.uploadData(database);

    expect(remoteStore.insertArea).not.toHaveBeenCalled();
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      expect.arrayContaining(['invalid_local_mutation']),
    );
  });

  it('normalizes checklist booleans and uses the prior hierarchy revision', async () => {
    const { connector, database, remoteStore } = createHarness(checklistPatchEntry());

    await connector.uploadData(database);

    expect(remoteStore.updateChecklistItem).toHaveBeenCalledWith(
      'item-a',
      1,
      expect.objectContaining({
        completed: true,
        last_operation_id: 'operation-checklist',
        revision: 2,
      }),
    );
  });

  it('rebases a stale checklist patch before draining its local transaction', async () => {
    const { complete, connector, database, remoteStore } = createHarness(
      checklistPatchEntry(),
      [
        { status: 'conflict', remoteRevision: 3 },
        { status: 'applied' },
      ],
    );

    await connector.uploadData(database);

    expect(remoteStore.updateChecklistItem).toHaveBeenNthCalledWith(
      1,
      'item-a',
      1,
      expect.objectContaining({
        completed: true,
        revision: 2,
      }),
    );
    expect(remoteStore.updateChecklistItem).toHaveBeenNthCalledWith(
      2,
      'item-a',
      3,
      expect.objectContaining({
        completed: true,
        completed_at: '2026-07-20T05:00:00.000Z',
        revision: 4,
        updated_at: detectedAt,
      }),
    );
    const rebasedPatch = vi.mocked(remoteStore.updateChecklistItem).mock.calls[1]?.[2];
    expect(rebasedPatch).not.toHaveProperty('title');
    expect(rebasedPatch).not.toHaveProperty('order_key');
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      expect.arrayContaining(['revision_conflict_recovered']),
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('keeps a repeatedly conflicting checklist patch queued', async () => {
    const { complete, connector, database, remoteStore } = createHarness(
      checklistPatchEntry(),
      [
        { status: 'conflict', remoteRevision: 3 },
        { status: 'conflict', remoteRevision: 4 },
        { status: 'conflict', remoteRevision: 5 },
        { status: 'conflict', remoteRevision: 6 },
      ],
    );

    await expect(connector.uploadData(database)).rejects.toMatchObject({
      name: 'TasksTransientSyncError',
      code: 'revision_conflict_retry_pending',
    });

    expect(remoteStore.updateChecklistItem).toHaveBeenCalledTimes(4);
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      expect.arrayContaining(['revision_conflict_retry_pending']),
    );
    expect(complete).not.toHaveBeenCalled();
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
      root_type: 'todo',
      root_id: 'task-a',
      operation: 'delete',
      descendant_policy: 'cascade',
      expected_revisions: { 'task-a': 4 },
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
        today_section: 'later',
        actionability: 'actionable',
        upcoming_order_key: 'a0',
        start_date: null,
        deadline: null,
        source_kind: null,
        last_mutation_channel: 'web',
        last_actor_type: 'user',
        last_operation_id: 'mutation-a',
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

  it('preserves an explicit null Today horizon for unplanned inserts', async () => {
    const { connector, database, remoteStore } = createHarness(
      taskInsertEntry('anytime', null),
    );

    await connector.uploadData(database);

    expect(remoteStore.insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'anytime',
        today_section: null,
        start_date: null,
      }),
    );
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

  it('uploads an Upcoming reorder rank instead of rejecting it as an unknown field', async () => {
    const { complete, connector, database, remoteStore } = createHarness(taskPatchEntry({
      upcoming_order_key: 'a0V',
    }));

    await connector.uploadData(database);

    expect(remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({
        upcoming_order_key: 'a0V',
        revision: 2,
        client_mutation_id: 'mutation-b',
      }),
    );
    expect(database.execute).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
  });

  it('uploads every structured non-actionable state and rejects invalid actionability', async () => {
    const valid = createHarness(taskPatchEntry({ actionability: 'waiting' }));
    await valid.connector.uploadData(valid.database);
    expect(valid.remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({ actionability: 'waiting' }),
    );

    const rechecking = createHarness(taskPatchEntry({ actionability: 'rechecking' }));
    await rechecking.connector.uploadData(rechecking.database);
    expect(rechecking.remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({ actionability: 'rechecking' }),
    );

    const invalid = createHarness(taskPatchEntry({ actionability: 'blocked' }));
    await invalid.connector.uploadData(invalid.database);
    expect(invalid.remoteStore.updateTask).not.toHaveBeenCalled();
    expect(invalid.database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      expect.arrayContaining(['invalid_local_mutation']),
    );
  });

  it('uploads inverse-mutation metadata with an undo patch', async () => {
    const { connector, database, remoteStore } = createHarness(taskPatchEntry({
      last_mutation_channel: 'raycast',
      last_actor_type: 'user',
      last_operation_id: 'operation-a',
      undo_source_event_id: 'event-a',
    }));

    await connector.uploadData(database);

    expect(remoteStore.updateTask).toHaveBeenCalledWith(
      'task-a',
      1,
      expect.objectContaining({
        last_mutation_channel: 'raycast',
        last_actor_type: 'user',
        last_operation_id: 'operation-a',
        undo_source_event_id: 'event-a',
      }),
    );
  });

  it('rebases a stale field-level patch and drains it only after recovery', async () => {
    const { complete, connector, database, remoteStore } = createHarness(taskPatchEntry({
      deadline: '2026-08-05',
    }), [
      { status: 'conflict', remoteRevision: 3 },
      { status: 'applied' },
    ]);

    await connector.uploadData(database);

    expect(remoteStore.updateTask).toHaveBeenNthCalledWith(
      1,
      'task-a',
      1,
      expect.objectContaining({
        title: 'Revised task',
        deadline: '2026-08-05',
        revision: 2,
        client_mutation_id: 'mutation-b',
      }),
    );
    expect(remoteStore.updateTask).toHaveBeenNthCalledWith(
      2,
      'task-a',
      3,
      expect.objectContaining({
        title: 'Revised task',
        deadline: '2026-08-05',
        revision: 4,
        client_mutation_id: 'mutation-b',
        updated_at: detectedAt,
      }),
    );
    expect(vi.mocked(remoteStore.updateTask).mock.calls[1]?.[2]).not.toHaveProperty('start_date');
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      [
        'crud-2',
        'task-a',
        'conflict',
        'PATCH',
        2,
        4,
        detectedAt,
        'revision_conflict_recovered',
      ],
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it('preserves a planning edit that races due-task activation', async () => {
    const { connector, database, remoteStore } = createHarness(taskPatchEntry({
      start_date: '2026-08-05',
      deadline: '2026-08-07',
      today_section: null,
    }), [
      { status: 'conflict', remoteRevision: 80 },
      { status: 'applied' },
    ]);

    await connector.uploadData(database);

    expect(remoteStore.updateTask).toHaveBeenNthCalledWith(
      2,
      'task-a',
      80,
      expect.objectContaining({
        start_date: '2026-08-05',
        deadline: '2026-08-07',
        today_section: null,
        revision: 81,
        client_mutation_id: 'mutation-b',
      }),
    );
    const rebasedPatch = vi.mocked(remoteStore.updateTask).mock.calls[1]?.[2];
    expect(rebasedPatch).not.toHaveProperty('area_id');
    expect(rebasedPatch).not.toHaveProperty('actionability');
    expect(rebasedPatch).not.toHaveProperty('primary_link');
  });

  it('keeps a repeatedly conflicting task patch queued after bounded retries', async () => {
    const { complete, connector, database, remoteStore } = createHarness(taskPatchEntry(), [
      { status: 'conflict', remoteRevision: 3 },
      { status: 'conflict', remoteRevision: 4 },
      { status: 'conflict', remoteRevision: 5 },
      { status: 'conflict', remoteRevision: 6 },
    ]);

    await expect(connector.uploadData(database)).rejects.toMatchObject({
      name: 'TasksTransientSyncError',
      code: 'revision_conflict_retry_pending',
    });

    expect(remoteStore.updateTask).toHaveBeenCalledTimes(4);
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      [
        'crud-2',
        'task-a',
        'conflict',
        'PATCH',
        2,
        6,
        detectedAt,
        'revision_conflict_retry_pending',
      ],
    );
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps a patch queued when the authoritative task is unavailable', async () => {
    const { complete, connector, database, remoteStore } = createHarness(taskPatchEntry(), {
      status: 'conflict',
      remoteRevision: null,
    });

    await expect(connector.uploadData(database)).rejects.toMatchObject({
      code: 'revision_conflict_retry_pending',
    });

    expect(remoteStore.updateTask).toHaveBeenCalledTimes(1);
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      expect.arrayContaining(['revision_conflict_retry_pending']),
    );
    expect(complete).not.toHaveBeenCalled();
  });

  it('marks a pending receipt recovered when a prior rebased write is already applied', async () => {
    const { complete, connector, database } = createHarness(taskPatchEntry(), {
      status: 'already_applied',
    });

    await connector.uploadData(database);

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("code = 'revision_conflict_recovered'"),
      [detectedAt, 'crud-2'],
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
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
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

  it('rejects writes to tables outside the synchronized task contract', async () => {
    const entry = new CrudEntry(7, UpdateType.PUT, 'legacy_task_store', 'legacy-a', 7, {
      owner_id: 'owner-a',
      name: 'Unsafe Direct Write',
    });
    const { complete, connector, database, remoteStore } = createHarness(entry);

    await connector.uploadData(database);

    expect(remoteStore.insertTask).not.toHaveBeenCalled();
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
      [
        'crud-7',
        'legacy-a',
        'rejected_operation',
        'PUT',
        null,
        null,
        detectedAt,
        'unsupported_table',
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
      expect.stringContaining('INSERT OR REPLACE INTO tasks_sync_issues'),
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

describe('Tasks Supabase remote store', () => {
  it('recognizes the original mutation identity after its revision was rebased', async () => {
    const updateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle }),
    };
    updateQuery.eq.mockReturnValue(updateQuery);
    const readMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'task-a',
        revision: 4,
        client_mutation_id: 'mutation-b',
      },
      error: null,
    });
    const readQuery = {
      eq: vi.fn().mockReturnValue({ maybeSingle: readMaybeSingle }),
    };
    const table = {
      update: vi.fn().mockReturnValue(updateQuery),
      select: vi.fn().mockReturnValue(readQuery),
    };
    const supabase = { from: vi.fn().mockReturnValue(table) };
    const store = new TasksSupabaseRemoteStore(supabase as never);

    await expect(store.updateTask('task-a', 1, {
      title: 'Revised task',
      revision: 2,
      client_mutation_id: 'mutation-b',
      updated_at: detectedAt,
    })).resolves.toEqual({ status: 'already_applied' });

    expect(table.update).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
    expect(readQuery.eq).toHaveBeenCalledWith('id', 'task-a');
  });
});

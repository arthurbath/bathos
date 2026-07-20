import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/web';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type TaskInsert = TablesInsert<'tasks_todos'>;
type TaskUpdate = TablesUpdate<'tasks_todos'>;

export type TasksRemoteWriteOutcome =
  | { status: 'applied' | 'already_applied' }
  | { status: 'conflict'; remoteRevision: number | null }
  | { status: 'rejected'; code: string };

export interface TasksRemoteStore {
  insertTask(task: TaskInsert): Promise<TasksRemoteWriteOutcome>;
  updateTask(
    taskId: string,
    baseRevision: number,
    patch: TaskUpdate,
  ): Promise<TasksRemoteWriteOutcome>;
}

export type TasksSyncConnectorOptions = {
  endpoint: string;
  remoteStore: TasksRemoteStore;
  getCredentials: () => Promise<PowerSyncCredentials | null>;
  now?: () => string;
};

export class TasksSyncConnector implements PowerSyncBackendConnector {
  private readonly now: () => string;

  constructor(private readonly options: TasksSyncConnectorOptions) {
    if (!options.endpoint) {
      throw new Error('A PowerSync endpoint is required');
    }
    this.now = options.now ?? (() => new Date().toISOString());
  }

  fetchCredentials = async (): Promise<PowerSyncCredentials | null> => {
    const credentials = await this.options.getCredentials();
    if (credentials === null) {
      return null;
    }
    if (credentials.endpoint !== this.options.endpoint) {
      throw new Error('The task sync credential endpoint does not match the configured endpoint');
    }
    return credentials;
  };

  uploadData = async (database: AbstractPowerSyncDatabase): Promise<void> => {
    const transaction = await database.getNextCrudTransaction();
    if (transaction === null) {
      return;
    }

    for (const entry of transaction.crud) {
      await this.uploadEntry(database, entry);
    }

    await transaction.complete();
  };

  private async uploadEntry(database: AbstractPowerSyncDatabase, entry: CrudEntry): Promise<void> {
    if (entry.table !== 'tasks_todos') {
      await recordSyncIssue(database, entry, {
        kind: 'rejected_operation',
        code: 'unsupported_table',
      }, this.now());
      return;
    }

    if (entry.op === UpdateType.DELETE) {
      await recordSyncIssue(database, entry, {
        kind: 'rejected_operation',
        code: 'hard_delete_not_supported',
      }, this.now());
      return;
    }

    let outcome: TasksRemoteWriteOutcome;
    try {
      if (entry.op === UpdateType.PUT) {
        outcome = await this.options.remoteStore.insertTask(parseTaskInsert(entry));
      } else if (entry.op === UpdateType.PATCH) {
        const patch = parseTaskUpdate(entry);
        outcome = await this.options.remoteStore.updateTask(
          entry.id,
          requirePositiveInteger(patch.revision, 'revision') - 1,
          patch,
        );
      } else {
        throw new InvalidTasksCrudEntryError('Unsupported task mutation operation');
      }
    } catch (error) {
      if (!(error instanceof InvalidTasksCrudEntryError)) {
        throw error;
      }
      await recordSyncIssue(database, entry, {
        kind: 'rejected_operation',
        code: 'invalid_local_mutation',
      }, this.now());
      return;
    }

    if (outcome.status === 'conflict') {
      await recordSyncIssue(database, entry, {
        kind: 'conflict',
        code: 'revision_conflict',
        remoteRevision: outcome.remoteRevision,
      }, this.now());
    } else if (outcome.status === 'rejected') {
      await recordSyncIssue(database, entry, {
        kind: 'remote_rejection',
        code: outcome.code,
      }, this.now());
    }
  }
}

export function createTasksSupabaseConnector(options: {
  endpoint: string;
  supabase: SupabaseClient<Database>;
  now?: () => string;
}): TasksSyncConnector {
  const remoteStore = new TasksSupabaseRemoteStore(options.supabase);
  return new TasksSyncConnector({
    endpoint: options.endpoint,
    remoteStore,
    now: options.now,
    getCredentials: async () => {
      const { data, error } = await options.supabase.auth.getSession();
      if (error) {
        throw error;
      }
      if (data.session === null) {
        return null;
      }

      return {
        endpoint: options.endpoint,
        token: data.session.access_token,
        expiresAt:
          data.session.expires_at === undefined
            ? undefined
            : new Date(data.session.expires_at * 1000),
      };
    },
  });
}

export class TasksSupabaseRemoteStore implements TasksRemoteStore {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async insertTask(task: TaskInsert): Promise<TasksRemoteWriteOutcome> {
    const { error } = await this.supabase.from('tasks_todos').insert(task);
    if (!error) {
      return { status: 'applied' };
    }

    if (error.code !== '23505') {
      return classifyRemoteError(error);
    }

    const current = await this.getRemoteState(task.id, task.client_mutation_id);
    return current?.id === task.id &&
      current.revision === task.revision &&
      current.client_mutation_id === task.client_mutation_id
      ? { status: 'already_applied' }
      : { status: 'conflict', remoteRevision: current?.revision ?? null };
  }

  async updateTask(
    taskId: string,
    baseRevision: number,
    patch: TaskUpdate,
  ): Promise<TasksRemoteWriteOutcome> {
    const { data, error } = await this.supabase
      .from('tasks_todos')
      .update(patch)
      .eq('id', taskId)
      .eq('revision', baseRevision)
      .select('id, revision, client_mutation_id')
      .maybeSingle();

    if (error) {
      return classifyRemoteError(error);
    }
    if (data !== null) {
      return { status: 'applied' };
    }

    const expectedRevision = requirePositiveInteger(patch.revision, 'revision');
    const expectedMutationId = requireText(patch.client_mutation_id, 'client_mutation_id');
    const current = await this.getRemoteState(taskId, expectedMutationId);
    return current?.id === taskId &&
      current.revision === expectedRevision &&
      current.client_mutation_id === expectedMutationId
      ? { status: 'already_applied' }
      : { status: 'conflict', remoteRevision: current?.revision ?? null };
  }

  private async getRemoteState(
    taskId: string,
    mutationId: string,
  ): Promise<{ id: string; revision: number; client_mutation_id: string } | null> {
    const byId = await this.supabase
      .from('tasks_todos')
      .select('id, revision, client_mutation_id')
      .eq('id', taskId)
      .maybeSingle();
    if (byId.error) {
      throwRemoteReadError(byId.error);
    }
    if (byId.data !== null) {
      return byId.data;
    }

    const byMutation = await this.supabase
      .from('tasks_todos')
      .select('id, revision, client_mutation_id')
      .eq('client_mutation_id', mutationId)
      .maybeSingle();
    if (byMutation.error) {
      throwRemoteReadError(byMutation.error);
    }
    return byMutation.data;
  }
}

function parseTaskInsert(entry: CrudEntry): TaskInsert {
  const data = entry.opData ?? {};
  const entryChannel = optionalText(data.entry_channel) ?? 'web';
  return {
    id: entry.id,
    owner_id: requireText(data.owner_id, 'owner_id'),
    title: requireText(data.title, 'title'),
    notes: optionalText(data.notes) ?? '',
    lifecycle: optionalText(data.lifecycle) ?? 'open',
    completed_at: optionalText(data.completed_at),
    canceled_at: optionalText(data.canceled_at),
    disposition: optionalText(data.disposition) ?? 'present',
    deleted_at: optionalText(data.deleted_at),
    destination: optionalText(data.destination) ?? 'inbox',
    order_key: requireText(data.order_key, 'order_key'),
    entry_channel: entryChannel,
    last_mutation_channel: optionalText(data.last_mutation_channel) ?? entryChannel,
    last_actor_type: optionalText(data.last_actor_type) ?? 'user',
    undo_source_event_id: optionalText(data.undo_source_event_id),
    source_kind: optionalText(data.source_kind),
    source_url: optionalText(data.source_url),
    source_title: optionalText(data.source_title),
    source_external_id: optionalText(data.source_external_id),
    revision: requirePositiveInteger(data.revision, 'revision'),
    client_mutation_id: requireText(data.client_mutation_id, 'client_mutation_id'),
    created_at: requireText(data.created_at, 'created_at'),
    updated_at: requireText(data.updated_at, 'updated_at'),
  } as TaskInsert;
}

function parseTaskUpdate(entry: CrudEntry): TaskUpdate {
  const data = entry.opData ?? {};
  const allowedColumns = new Set([
    'title',
    'notes',
    'lifecycle',
    'completed_at',
    'canceled_at',
    'disposition',
    'deleted_at',
    'destination',
    'order_key',
    'last_mutation_channel',
    'last_actor_type',
    'undo_source_event_id',
    'source_kind',
    'source_url',
    'source_title',
    'source_external_id',
    'revision',
    'client_mutation_id',
    'updated_at',
  ]);

  if (Object.keys(data).some((columnName) => !allowedColumns.has(columnName))) {
    throw new InvalidTasksCrudEntryError('The task update contains an immutable or unknown field');
  }

  requirePositiveInteger(data.revision, 'revision');
  requireText(data.client_mutation_id, 'client_mutation_id');
  return { ...data } as TaskUpdate;
}

async function recordSyncIssue(
  database: AbstractPowerSyncDatabase,
  entry: CrudEntry,
  issue: {
    kind: 'conflict' | 'rejected_operation' | 'remote_rejection';
    code: string;
    remoteRevision?: number | null;
  },
  detectedAt: string,
): Promise<void> {
  await database.execute(
    `INSERT OR IGNORE INTO tasks_sync_issues
      (id, task_id, kind, operation, local_revision, remote_revision, detected_at, code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `crud-${entry.clientId}`,
      entry.id,
      issue.kind,
      entry.op,
      integerOrNull(entry.opData?.revision),
      issue.remoteRevision ?? null,
      detectedAt,
      issue.code,
    ],
  );
}

function classifyRemoteError(error: { code?: string; message: string }): TasksRemoteWriteOutcome {
  const code = error.code ?? '';
  if (
    !code ||
    code.startsWith('08') ||
    code.startsWith('53') ||
    code.startsWith('PGRST0') ||
    code === '40001' ||
    code === '40P01' ||
    code === '57P01'
  ) {
    throw new TasksTransientSyncError(error.message, code);
  }
  return { status: 'rejected', code };
}

function throwRemoteReadError(error: { code?: string; message: string }): never {
  const outcome = classifyRemoteError(error);
  throw new TasksRemoteReadError(error.message, outcome.code);
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidTasksCrudEntryError(`The task mutation requires ${field}`);
  }
  return value;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new InvalidTasksCrudEntryError('The task mutation contains invalid text');
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new InvalidTasksCrudEntryError(`The task mutation requires a valid ${field}`);
  }
  return value;
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

class InvalidTasksCrudEntryError extends Error {}

export class TasksTransientSyncError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'TasksTransientSyncError';
  }
}

export class TasksRemoteReadError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'TasksRemoteReadError';
  }
}

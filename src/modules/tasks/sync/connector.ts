import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/web';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

const supportedUploadTables = new Set([
  'tasks_todos',
  'tasks_user_settings',
  'tasks_areas',
  'tasks_projects',
  'tasks_headings',
  'tasks_checklist_items',
  'tasks_hierarchy_operations',
]);

type HierarchyTable =
  | 'tasks_areas'
  | 'tasks_projects'
  | 'tasks_headings'
  | 'tasks_checklist_items';

type TaskInsert = TablesInsert<'tasks_todos'>;
type TaskUpdate = TablesUpdate<'tasks_todos'>;
type TaskSettingsInsert = TablesInsert<'tasks_user_settings'>;
type TaskSettingsUpdate = TablesUpdate<'tasks_user_settings'>;
type TaskAreaInsert = TablesInsert<'tasks_areas'>;
type TaskAreaUpdate = TablesUpdate<'tasks_areas'>;
type TaskProjectInsert = TablesInsert<'tasks_projects'>;
type TaskProjectUpdate = TablesUpdate<'tasks_projects'>;
type TaskHeadingInsert = TablesInsert<'tasks_headings'>;
type TaskHeadingUpdate = TablesUpdate<'tasks_headings'>;
type TaskChecklistItemInsert = TablesInsert<'tasks_checklist_items'>;
type TaskChecklistItemUpdate = TablesUpdate<'tasks_checklist_items'>;
type TaskHierarchyOperationInsert = TablesInsert<'tasks_hierarchy_operations'>;

export type TasksRemoteWriteOutcome =
  | { status: 'applied' | 'already_applied' }
  | { status: 'conflict'; remoteRevision: number | null; code?: string }
  | { status: 'rejected'; code: string };

export interface TasksRemoteStore {
  insertTask(task: TaskInsert): Promise<TasksRemoteWriteOutcome>;
  updateTask(
    taskId: string,
    baseRevision: number,
    patch: TaskUpdate,
  ): Promise<TasksRemoteWriteOutcome>;
  insertSettings(settings: TaskSettingsInsert): Promise<TasksRemoteWriteOutcome>;
  updateSettings(
    settingsId: string,
    baseRevision: number,
    patch: TaskSettingsUpdate,
  ): Promise<TasksRemoteWriteOutcome>;
  insertArea(area: TaskAreaInsert): Promise<TasksRemoteWriteOutcome>;
  updateArea(id: string, baseRevision: number, patch: TaskAreaUpdate): Promise<TasksRemoteWriteOutcome>;
  insertProject(project: TaskProjectInsert): Promise<TasksRemoteWriteOutcome>;
  updateProject(id: string, baseRevision: number, patch: TaskProjectUpdate): Promise<TasksRemoteWriteOutcome>;
  insertHeading(heading: TaskHeadingInsert): Promise<TasksRemoteWriteOutcome>;
  updateHeading(id: string, baseRevision: number, patch: TaskHeadingUpdate): Promise<TasksRemoteWriteOutcome>;
  insertChecklistItem(item: TaskChecklistItemInsert): Promise<TasksRemoteWriteOutcome>;
  updateChecklistItem(
    id: string,
    baseRevision: number,
    patch: TaskChecklistItemUpdate,
  ): Promise<TasksRemoteWriteOutcome>;
  insertHierarchyOperation(
    operation: TaskHierarchyOperationInsert,
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

    const operationEntries = transaction.crud.filter(
      (entry) => entry.table === 'tasks_hierarchy_operations',
    );
    if (operationEntries.length > 0) {
      if (operationEntries.length !== 1 || operationEntries[0].op !== UpdateType.PUT) {
        await recordSyncIssue(database, operationEntries[0], {
          kind: 'rejected_operation',
          code: 'invalid_hierarchy_operation_transaction',
        }, this.now());
        await transaction.complete();
        return;
      }
      await this.uploadEntry(database, operationEntries[0]);
      await transaction.complete();
      return;
    }

    for (const entry of transaction.crud) {
      await this.uploadEntry(database, entry);
    }

    await transaction.complete();
  };

  private async uploadEntry(database: AbstractPowerSyncDatabase, entry: CrudEntry): Promise<void> {
    if (!supportedUploadTables.has(entry.table)) {
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
      if (entry.table === 'tasks_todos') {
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
      } else if (entry.table === 'tasks_user_settings' && entry.op === UpdateType.PUT) {
        outcome = await this.options.remoteStore.insertSettings(parseSettingsInsert(entry));
      } else if (entry.table === 'tasks_user_settings' && entry.op === UpdateType.PATCH) {
        const patch = parseSettingsUpdate(entry);
        outcome = await this.options.remoteStore.updateSettings(
          entry.id,
          requirePositiveInteger(patch.revision, 'revision') - 1,
          patch,
        );
      } else if (entry.table === 'tasks_areas') {
        outcome = await uploadHierarchyEntry(
          entry,
          parseAreaInsert,
          parseAreaUpdate,
          this.options.remoteStore.insertArea.bind(this.options.remoteStore),
          this.options.remoteStore.updateArea.bind(this.options.remoteStore),
        );
      } else if (entry.table === 'tasks_projects') {
        outcome = await uploadHierarchyEntry(
          entry,
          parseProjectInsert,
          parseProjectUpdate,
          this.options.remoteStore.insertProject.bind(this.options.remoteStore),
          this.options.remoteStore.updateProject.bind(this.options.remoteStore),
        );
      } else if (entry.table === 'tasks_headings') {
        outcome = await uploadHierarchyEntry(
          entry,
          parseHeadingInsert,
          parseHeadingUpdate,
          this.options.remoteStore.insertHeading.bind(this.options.remoteStore),
          this.options.remoteStore.updateHeading.bind(this.options.remoteStore),
        );
      } else if (entry.table === 'tasks_checklist_items') {
        outcome = await uploadHierarchyEntry(
          entry,
          parseChecklistItemInsert,
          parseChecklistItemUpdate,
          this.options.remoteStore.insertChecklistItem.bind(this.options.remoteStore),
          this.options.remoteStore.updateChecklistItem.bind(this.options.remoteStore),
        );
      } else if (entry.table === 'tasks_hierarchy_operations'
        && entry.op === UpdateType.PUT) {
        outcome = await this.options.remoteStore.insertHierarchyOperation(
          parseHierarchyOperationInsert(entry),
        );
      } else {
        throw new InvalidTasksCrudEntryError('Unsupported task settings mutation operation');
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
        code: outcome.code ?? 'revision_conflict',
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

  async insertSettings(settings: TaskSettingsInsert): Promise<TasksRemoteWriteOutcome> {
    const { error } = await this.supabase.from('tasks_user_settings').insert(settings);
    if (!error) {
      return { status: 'applied' };
    }
    if (error.code !== '23505') {
      return classifyRemoteError(error);
    }
    return this.classifySettingsRetry(
      settings.id,
      requirePositiveInteger(settings.revision, 'revision'),
      settings.client_mutation_id,
    );
  }

  async updateSettings(
    settingsId: string,
    baseRevision: number,
    patch: TaskSettingsUpdate,
  ): Promise<TasksRemoteWriteOutcome> {
    const { data, error } = await this.supabase
      .from('tasks_user_settings')
      .update(patch)
      .eq('id', settingsId)
      .eq('revision', baseRevision)
      .select('id, revision, client_mutation_id')
      .maybeSingle();
    if (error) {
      return classifyRemoteError(error);
    }
    if (data !== null) {
      return { status: 'applied' };
    }
    return this.classifySettingsRetry(
      settingsId,
      requirePositiveInteger(patch.revision, 'revision'),
      requireText(patch.client_mutation_id, 'client_mutation_id'),
    );
  }

  insertArea(area: TaskAreaInsert): Promise<TasksRemoteWriteOutcome> {
    return this.insertHierarchy('tasks_areas', area);
  }

  updateArea(
    id: string,
    baseRevision: number,
    patch: TaskAreaUpdate,
  ): Promise<TasksRemoteWriteOutcome> {
    return this.updateHierarchy('tasks_areas', id, baseRevision, patch);
  }

  insertProject(project: TaskProjectInsert): Promise<TasksRemoteWriteOutcome> {
    return this.insertHierarchy('tasks_projects', project);
  }

  updateProject(
    id: string,
    baseRevision: number,
    patch: TaskProjectUpdate,
  ): Promise<TasksRemoteWriteOutcome> {
    return this.updateHierarchy('tasks_projects', id, baseRevision, patch);
  }

  insertHeading(heading: TaskHeadingInsert): Promise<TasksRemoteWriteOutcome> {
    return this.insertHierarchy('tasks_headings', heading);
  }

  updateHeading(
    id: string,
    baseRevision: number,
    patch: TaskHeadingUpdate,
  ): Promise<TasksRemoteWriteOutcome> {
    return this.updateHierarchy('tasks_headings', id, baseRevision, patch);
  }

  insertChecklistItem(item: TaskChecklistItemInsert): Promise<TasksRemoteWriteOutcome> {
    return this.insertHierarchy('tasks_checklist_items', item);
  }

  updateChecklistItem(
    id: string,
    baseRevision: number,
    patch: TaskChecklistItemUpdate,
  ): Promise<TasksRemoteWriteOutcome> {
    return this.updateHierarchy('tasks_checklist_items', id, baseRevision, patch);
  }

  async insertHierarchyOperation(
    operation: TaskHierarchyOperationInsert,
  ): Promise<TasksRemoteWriteOutcome> {
    const { error } = await this.supabase
      .from('tasks_hierarchy_operations')
      .insert(operation);
    if (error && error.code !== '23505') return classifyRemoteError(error);

    const current = await this.supabase
      .from('tasks_hierarchy_operations')
      .select('outcome, code')
      .eq('id', operation.id)
      .maybeSingle();
    if (current.error) throwRemoteReadError(current.error);
    if (current.data === null) {
      return { status: 'conflict', remoteRevision: null, code: 'operation_missing' };
    }
    if (current.data.outcome === 'accepted' || current.data.outcome === 'noop') {
      return { status: error ? 'already_applied' : 'applied' };
    }
    if (current.data.outcome === 'conflict') {
      return {
        status: 'conflict',
        remoteRevision: null,
        code: current.data.code ?? 'revision_set_changed',
      };
    }
    return {
      status: 'rejected',
      code: current.data.code ?? 'hierarchy_operation_rejected',
    };
  }

  private async insertHierarchy<T extends HierarchyTable>(
    table: T,
    row: TablesInsert<T>,
  ): Promise<TasksRemoteWriteOutcome> {
    const { error } = await this.supabase.from(table).insert(row as never);
    if (!error) return { status: 'applied' };
    if (error.code !== '23505') return classifyRemoteError(error);
    return this.classifyHierarchyRetry(
      table,
      row.id,
      requirePositiveInteger(row.revision ?? 1, 'revision'),
      row.client_mutation_id,
    );
  }

  private async updateHierarchy<T extends HierarchyTable>(
    table: T,
    id: string,
    baseRevision: number,
    patch: TablesUpdate<T>,
  ): Promise<TasksRemoteWriteOutcome> {
    const query = await this.supabase
      .from(table)
      .update(patch as never)
      .match({ id, revision: baseRevision } as never)
      .select('id, revision, client_mutation_id')
      .maybeSingle();
    if (query.error) return classifyRemoteError(query.error);
    if (query.data !== null) return { status: 'applied' };
    return this.classifyHierarchyRetry(
      table,
      id,
      requirePositiveInteger(patch.revision, 'revision'),
      requireText(patch.client_mutation_id, 'client_mutation_id'),
    );
  }

  private async classifyHierarchyRetry(
    table: HierarchyTable,
    id: string,
    expectedRevision: number,
    expectedMutationId: string,
  ): Promise<TasksRemoteWriteOutcome> {
    const current = await this.supabase
      .from(table)
      .select('id, revision, client_mutation_id')
      .eq('id', id)
      .maybeSingle();
    if (current.error) throwRemoteReadError(current.error);
    const row = current.data as {
      revision: number;
      client_mutation_id: string;
    } | null;
    return row?.revision === expectedRevision
      && row.client_mutation_id === expectedMutationId
      ? { status: 'already_applied' }
      : { status: 'conflict', remoteRevision: row?.revision ?? null };
  }

  private async classifySettingsRetry(
    settingsId: string,
    expectedRevision: number,
    expectedMutationId: string,
  ): Promise<TasksRemoteWriteOutcome> {
    const current = await this.supabase
      .from('tasks_user_settings')
      .select('id, revision, client_mutation_id')
      .eq('id', settingsId)
      .maybeSingle();
    if (current.error) {
      throwRemoteReadError(current.error);
    }
    return current.data?.revision === expectedRevision
      && current.data.client_mutation_id === expectedMutationId
      ? { status: 'already_applied' }
      : { status: 'conflict', remoteRevision: current.data?.revision ?? null };
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
    actionability: parseTaskActionability(data.actionability),
    area_id: optionalText(data.area_id),
    project_id: optionalText(data.project_id),
    heading_id: optionalText(data.heading_id),
    title: requireText(data.title, 'title'),
    notes: optionalText(data.notes) ?? '',
    lifecycle: optionalText(data.lifecycle) ?? 'open',
    completed_at: optionalText(data.completed_at),
    canceled_at: optionalText(data.canceled_at),
    disposition: optionalText(data.disposition) ?? 'present',
    deleted_at: optionalText(data.deleted_at),
    deletion_root_id: optionalText(data.deletion_root_id),
    destination: optionalText(data.destination) ?? 'anytime',
    today_section: optionalText(data.today_section) ?? 'inbox',
    order_key: requireText(data.order_key, 'order_key'),
    hierarchy_order_key: optionalText(data.hierarchy_order_key),
    start_date: optionalText(data.start_date),
    deadline: optionalText(data.deadline),
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
    'actionability',
    'title',
    'notes',
    'lifecycle',
    'completed_at',
    'canceled_at',
    'disposition',
    'deleted_at',
    'deletion_root_id',
    'destination',
    'today_section',
    'order_key',
    'area_id',
    'project_id',
    'heading_id',
    'hierarchy_order_key',
    'start_date',
    'deadline',
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
  if (data.actionability !== undefined) {
    parseTaskActionability(data.actionability);
  }
  return { ...data } as TaskUpdate;
}

function parseTaskActionability(value: unknown): 'actionable' | 'waiting' {
  const actionability = optionalText(value) ?? 'actionable';
  if (actionability !== 'actionable' && actionability !== 'waiting') {
    throw new InvalidTasksCrudEntryError('Task actionability must be actionable or waiting');
  }
  return actionability;
}

function parseSettingsInsert(entry: CrudEntry): TaskSettingsInsert {
  const data = entry.opData ?? {};
  return {
    id: entry.id,
    owner_id: requireText(data.owner_id, 'owner_id'),
    planning_timezone: requireText(data.planning_timezone, 'planning_timezone'),
    revision: requirePositiveInteger(data.revision, 'revision'),
    client_mutation_id: requireText(data.client_mutation_id, 'client_mutation_id'),
    created_at: requireText(data.created_at, 'created_at'),
    updated_at: requireText(data.updated_at, 'updated_at'),
  };
}

function parseSettingsUpdate(entry: CrudEntry): TaskSettingsUpdate {
  const data = entry.opData ?? {};
  const allowedColumns = new Set([
    'planning_timezone',
    'revision',
    'client_mutation_id',
    'updated_at',
  ]);
  if (Object.keys(data).some((columnName) => !allowedColumns.has(columnName))) {
    throw new InvalidTasksCrudEntryError(
      'The task settings update contains an immutable or unknown field',
    );
  }
  requireText(data.planning_timezone, 'planning_timezone');
  requirePositiveInteger(data.revision, 'revision');
  requireText(data.client_mutation_id, 'client_mutation_id');
  requireText(data.updated_at, 'updated_at');
  return { ...data } as TaskSettingsUpdate;
}

async function uploadHierarchyEntry<I, U extends { revision?: number }>(
  entry: CrudEntry,
  parseInsert: (entry: CrudEntry) => I,
  parseUpdate: (entry: CrudEntry) => U,
  insert: (row: I) => Promise<TasksRemoteWriteOutcome>,
  update: (id: string, baseRevision: number, patch: U) => Promise<TasksRemoteWriteOutcome>,
): Promise<TasksRemoteWriteOutcome> {
  if (entry.op === UpdateType.PUT) return insert(parseInsert(entry));
  if (entry.op === UpdateType.PATCH) {
    const patch = parseUpdate(entry);
    return update(
      entry.id,
      requirePositiveInteger(patch.revision, 'revision') - 1,
      patch,
    );
  }
  throw new InvalidTasksCrudEntryError('Unsupported task hierarchy mutation operation');
}

function parseAreaInsert(entry: CrudEntry): TaskAreaInsert {
  return parseHierarchyInsert(entry, ['title', 'order_key']) as TaskAreaInsert;
}

function parseProjectInsert(entry: CrudEntry): TaskProjectInsert {
  return parseHierarchyInsert(entry, ['title', 'order_key', 'planning_order_key']) as TaskProjectInsert;
}

function parseHeadingInsert(entry: CrudEntry): TaskHeadingInsert {
  return parseHierarchyInsert(entry, ['project_id', 'title', 'order_key']) as TaskHeadingInsert;
}

function parseChecklistItemInsert(entry: CrudEntry): TaskChecklistItemInsert {
  const parsed = parseHierarchyInsert(entry, ['task_id', 'title', 'order_key']);
  return {
    ...parsed,
    completed: booleanOrDefault(parsed.completed, false),
  } as TaskChecklistItemInsert;
}

function parseAreaUpdate(entry: CrudEntry): TaskAreaUpdate {
  return parseHierarchyUpdate(entry, hierarchyMutableColumns.area) as TaskAreaUpdate;
}

function parseProjectUpdate(entry: CrudEntry): TaskProjectUpdate {
  return parseHierarchyUpdate(entry, hierarchyMutableColumns.project) as TaskProjectUpdate;
}

function parseHeadingUpdate(entry: CrudEntry): TaskHeadingUpdate {
  return parseHierarchyUpdate(entry, hierarchyMutableColumns.heading) as TaskHeadingUpdate;
}

function parseChecklistItemUpdate(entry: CrudEntry): TaskChecklistItemUpdate {
  const parsed = parseHierarchyUpdate(entry, hierarchyMutableColumns.checklist);
  return {
    ...parsed,
    ...(parsed.completed === undefined
      ? {}
      : { completed: booleanOrDefault(parsed.completed, false) }),
  } as TaskChecklistItemUpdate;
}

function parseHierarchyOperationInsert(entry: CrudEntry): TaskHierarchyOperationInsert {
  const data = entry.opData ?? {};
  return {
    id: entry.id,
    owner_id: requireText(data.owner_id, 'owner_id'),
    root_type: requireText(data.root_type, 'root_type'),
    root_id: requireText(data.root_id, 'root_id'),
    operation: requireText(data.operation, 'operation'),
    descendant_policy: requireText(data.descendant_policy, 'descendant_policy'),
    expected_revisions: requireJsonObject(data.expected_revisions, 'expected_revisions'),
    actor_type: requireText(data.actor_type, 'actor_type'),
    mutation_channel: requireText(data.mutation_channel, 'mutation_channel'),
    requested_at: requireText(data.requested_at, 'requested_at'),
  };
}

const hierarchyMutableColumns = {
  area: ['title', 'order_key', 'disposition', 'deleted_at', 'deletion_root_id'],
  project: [
    'area_id', 'title', 'notes', 'lifecycle', 'completed_at', 'canceled_at',
    'disposition', 'deleted_at', 'deletion_root_id', 'destination', 'today_section', 'order_key',
    'planning_order_key', 'start_date', 'deadline',
  ],
  heading: ['title', 'order_key', 'disposition', 'deleted_at', 'deletion_root_id'],
  checklist: [
    'title', 'completed', 'completed_at', 'order_key', 'disposition', 'deleted_at',
    'deletion_root_id',
  ],
} as const;

const hierarchyMetadataColumns = [
  'last_mutation_channel',
  'last_actor_type',
  'revision',
  'client_mutation_id',
  'updated_at',
] as const;

function parseHierarchyInsert(
  entry: CrudEntry,
  requiredColumns: readonly string[],
): Record<string, unknown> {
  const data = entry.opData ?? {};
  const entryChannel = optionalText(data.entry_channel) ?? 'web';
  const parsed: Record<string, unknown> = {
    id: entry.id,
    ...data,
    owner_id: requireText(data.owner_id, 'owner_id'),
    entry_channel: entryChannel,
    last_mutation_channel: optionalText(data.last_mutation_channel) ?? entryChannel,
    last_actor_type: optionalText(data.last_actor_type) ?? 'user',
    revision: requirePositiveInteger(data.revision, 'revision'),
    client_mutation_id: requireText(data.client_mutation_id, 'client_mutation_id'),
    created_at: requireText(data.created_at, 'created_at'),
    updated_at: requireText(data.updated_at, 'updated_at'),
  };
  for (const columnName of requiredColumns) {
    parsed[columnName] = requireText(data[columnName], columnName);
  }
  return parsed;
}

function parseHierarchyUpdate(
  entry: CrudEntry,
  mutableColumns: readonly string[],
): Record<string, unknown> {
  const data = entry.opData ?? {};
  const allowedColumns = new Set([...mutableColumns, ...hierarchyMetadataColumns]);
  if (Object.keys(data).some((columnName) => !allowedColumns.has(columnName))) {
    throw new InvalidTasksCrudEntryError(
      'The task hierarchy update contains an immutable or unknown field',
    );
  }
  requirePositiveInteger(data.revision, 'revision');
  requireText(data.client_mutation_id, 'client_mutation_id');
  requireText(data.updated_at, 'updated_at');
  return { ...data };
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  throw new InvalidTasksCrudEntryError('The task mutation contains invalid boolean data');
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

function classifyRemoteError(
  error: { code?: string; message: string },
): Extract<TasksRemoteWriteOutcome, { status: 'rejected' }> {
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

function requireJsonObject(value: unknown, field: string): Record<string, number> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new InvalidTasksCrudEntryError(`The task mutation requires valid ${field}`);
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidTasksCrudEntryError(`The task mutation requires valid ${field}`);
  }
  for (const revision of Object.values(parsed)) {
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) {
      throw new InvalidTasksCrudEntryError(`The task mutation requires valid ${field}`);
    }
  }
  return parsed as Record<string, number>;
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

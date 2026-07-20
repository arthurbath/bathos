import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import {
  applyTaskStateTransition,
  type TaskStateTransition,
} from '@/modules/tasks/domain/taskState';
import type {
  TaskDestination,
  TaskEntryChannel,
  TaskSourceKind,
  TaskTodo,
} from '@/modules/tasks/types/tasks';

export type TaskRepositoryDatabase = Pick<AbstractPowerSyncDatabase, 'writeTransaction'>;

export type CreateTaskInput = {
  ownerId: string;
  title: string;
  notes?: string;
  destination?: TaskDestination;
  orderKey?: string;
  entryChannel?: TaskEntryChannel;
  sourceKind?: TaskSourceKind | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceExternalId?: string | null;
};

export type EditableTaskPatch = Partial<
  Pick<
    TaskTodo,
    | 'title'
    | 'notes'
    | 'destination'
    | 'order_key'
    | 'source_kind'
    | 'source_url'
    | 'source_title'
    | 'source_external_id'
  >
>;

export type TaskRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

const insertColumns = [
  'id',
  'owner_id',
  'title',
  'notes',
  'lifecycle',
  'completed_at',
  'canceled_at',
  'disposition',
  'deleted_at',
  'destination',
  'order_key',
  'entry_channel',
  'source_kind',
  'source_url',
  'source_title',
  'source_external_id',
  'revision',
  'client_mutation_id',
  'created_at',
  'updated_at',
] as const;

export class TaskNotFoundError extends Error {
  constructor() {
    super('The task does not exist for the signed-in owner');
    this.name = 'TaskNotFoundError';
  }
}

export class InvalidTaskMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskMutationError';
  }
}

export class TaskRepository {
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(
    private readonly database: TaskRepositoryDatabase,
    options: TaskRepositoryOptions = {},
  ) {
    this.createId = options.createId ?? createUuid;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async createTask(input: CreateTaskInput): Promise<TaskTodo> {
    const title = normalizeTitle(input.title);
    assertOwner(input.ownerId);
    assertSource(
      input.sourceKind ?? null,
      input.sourceUrl ?? null,
      input.sourceTitle ?? null,
      input.sourceExternalId ?? null,
    );

    return this.database.writeTransaction(async (transaction) => {
      const destination = input.destination ?? 'inbox';
      const lastTask = input.orderKey
        ? null
        : await transaction.getOptional<{ order_key: string }>(
            `SELECT order_key
             FROM tasks_todos
             WHERE owner_id = ?
               AND destination = ?
               AND lifecycle = 'open'
               AND disposition = 'present'
             ORDER BY order_key DESC, id DESC
             LIMIT 1`,
            [input.ownerId, destination],
          );
      const timestamp = this.now();
      const task: TaskTodo = {
        id: this.createId(),
        owner_id: input.ownerId,
        title,
        notes: input.notes ?? '',
        lifecycle: 'open',
        completed_at: null,
        canceled_at: null,
        disposition: 'present',
        deleted_at: null,
        destination,
        order_key: input.orderKey ?? generateTaskOrderKey(lastTask?.order_key ?? null, null),
        entry_channel: input.entryChannel ?? 'web',
        source_kind: input.sourceKind ?? null,
        source_url: input.sourceUrl ?? null,
        source_title: input.sourceTitle ?? null,
        source_external_id: input.sourceExternalId ?? null,
        revision: 1,
        client_mutation_id: this.createId(),
        created_at: timestamp,
        updated_at: timestamp,
      };

      await transaction.execute(
        `INSERT INTO tasks_todos (${insertColumns.join(', ')})
         VALUES (${insertColumns.map(() => '?').join(', ')})`,
        insertColumns.map((columnName) => task[columnName]),
      );

      return task;
    });
  }

  async updateTask(ownerId: string, taskId: string, patch: EditableTaskPatch): Promise<TaskTodo> {
    return this.mutateTask(ownerId, taskId, normalizeEditablePatch(patch));
  }

  async transitionTask(
    ownerId: string,
    taskId: string,
    transition: TaskStateTransition,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    return this.database.writeTransaction(async (transaction) => {
      const current = await getOwnedTask(transaction, ownerId, taskId);
      const occurredAt = this.now();
      const result = applyTaskStateTransition(
        {
          lifecycle: current.lifecycle,
          completedAt: current.completed_at,
          canceledAt: current.canceled_at,
          disposition: current.disposition,
          deletedAt: current.deleted_at,
        },
        transition,
        occurredAt,
      );

      if (result.outcome === 'noop') {
        return current;
      }

      return updateOwnedTask(transaction, current, {
        lifecycle: result.state.lifecycle,
        completed_at: result.state.completedAt,
        canceled_at: result.state.canceledAt,
        disposition: result.state.disposition,
        deleted_at: result.state.deletedAt,
      }, this.createId(), occurredAt);
    });
  }

  private async mutateTask(
    ownerId: string,
    taskId: string,
    patch: EditableTaskPatch,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    return this.database.writeTransaction(async (transaction) => {
      const current = await getOwnedTask(transaction, ownerId, taskId);
      if (Object.keys(patch).length === 0) {
        return current;
      }

      assertSource(
        patch.source_kind === undefined ? current.source_kind : patch.source_kind,
        patch.source_url === undefined ? current.source_url : patch.source_url,
        patch.source_title === undefined ? current.source_title : patch.source_title,
        patch.source_external_id === undefined
          ? current.source_external_id
          : patch.source_external_id,
      );

      return updateOwnedTask(transaction, current, patch, this.createId(), this.now());
    });
  }
}

async function getOwnedTask(
  transaction: Transaction,
  ownerId: string,
  taskId: string,
): Promise<TaskTodo> {
  const task = await transaction.getOptional<TaskTodo>(
    'SELECT * FROM tasks_todos WHERE id = ? AND owner_id = ?',
    [taskId, ownerId],
  );
  if (task === null) {
    throw new TaskNotFoundError();
  }
  return task;
}

async function updateOwnedTask(
  transaction: Transaction,
  current: TaskTodo,
  patch: EditableTaskPatch | TaskStatePatch,
  mutationId: string,
  updatedAt: string,
): Promise<TaskTodo> {
  const next = {
    ...current,
    ...patch,
    revision: current.revision + 1,
    client_mutation_id: mutationId,
    updated_at: updatedAt,
  };
  const changedColumns = [
    ...Object.keys(patch),
    'revision',
    'client_mutation_id',
    'updated_at',
  ] as Array<keyof TaskTodo>;

  await transaction.execute(
    `UPDATE tasks_todos
     SET ${changedColumns.map((columnName) => `${columnName} = ?`).join(', ')}
     WHERE id = ? AND owner_id = ?`,
    [...changedColumns.map((columnName) => next[columnName]), current.id, current.owner_id],
  );

  return next;
}

type TaskStatePatch = Pick<
  TaskTodo,
  'lifecycle' | 'completed_at' | 'canceled_at' | 'disposition' | 'deleted_at'
>;

function normalizeEditablePatch(patch: EditableTaskPatch): EditableTaskPatch {
  const normalized = { ...patch };
  if (patch.title !== undefined) {
    normalized.title = normalizeTitle(patch.title);
  }
  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined),
  ) as EditableTaskPatch;
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) {
    throw new InvalidTaskMutationError('A task title is required');
  }
  if (Array.from(normalized).length > 500) {
    throw new InvalidTaskMutationError('A task title cannot exceed 500 characters');
  }
  return normalized;
}

function assertOwner(ownerId: string): void {
  if (!ownerId) {
    throw new InvalidTaskMutationError('A signed-in task owner is required');
  }
}

function assertSource(
  sourceKind: TaskSourceKind | null | undefined,
  sourceUrl: string | null | undefined,
  sourceTitle: string | null | undefined,
  sourceExternalId: string | null | undefined,
): void {
  if (sourceKind === null && (sourceUrl !== null || sourceTitle !== null || sourceExternalId !== null)) {
    throw new InvalidTaskMutationError('Source details require a structured source kind');
  }
  if ((sourceKind === 'webpage' || sourceKind === 'reading_item') && !sourceUrl?.trim()) {
    throw new InvalidTaskMutationError('Web and reading sources require a URL');
  }
}

function createUuid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new InvalidTaskMutationError('Secure task identifiers are unavailable');
  }
  return globalThis.crypto.randomUUID();
}

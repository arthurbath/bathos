import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import {
  checklistJournalSnapshot,
  checklistJournalSnapshotsEqual,
  type TaskChecklistHistorySnapshot,
} from '@/modules/tasks/domain/taskActionJournal';
import {
  InvalidTaskMutationError,
  type TaskMutationContext,
} from '@/modules/tasks/data/taskRepository';
import type {
  TaskArea,
  TaskChecklistItem,
  TaskEntryChannel,
} from '@/modules/tasks/types/tasks';

export type TaskHierarchyRepositoryDatabase = Pick<
  AbstractPowerSyncDatabase,
  'writeTransaction'
>;

export type TaskHierarchyRepositoryOptions = {
  createId?: () => string;
  now?: () => string;
};

type CreateHierarchyInput = {
  ownerId: string;
  title: string;
  orderKey?: string;
  entryChannel?: TaskEntryChannel;
  actorType?: TaskMutationContext['actorType'];
  operationId?: string;
  occurredAt?: string;
};

export type CreateTaskAreaInput = CreateHierarchyInput;

export type CreateTaskChecklistItemInput = CreateHierarchyInput & {
  taskId: string;
};

export type TaskAreaPatch = Partial<Pick<TaskArea, 'title' | 'order_key'>>;

export type TaskChecklistItemPatch = Partial<
  Pick<
    TaskChecklistItem,
    | 'title'
    | 'completed'
    | 'completed_at'
    | 'order_key'
  >
>;

export class TaskHierarchyNotFoundError extends Error {
  constructor(kind: string) {
    super(`The task ${kind} does not exist for the signed-in owner`);
    this.name = 'TaskHierarchyNotFoundError';
  }
}

export class TaskHierarchyRepository {
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(
    private readonly database: TaskHierarchyRepositoryDatabase,
    options: TaskHierarchyRepositoryOptions = {},
  ) {
    this.createId = options.createId ?? createUuid;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async createArea(input: CreateTaskAreaInput): Promise<TaskArea> {
    return this.database.writeTransaction(async (transaction) => {
      const metadata = this.createMetadata(input);
      const area: TaskArea = {
        ...metadata,
        title: normalizeTitle(input.title),
        order_key: input.orderKey ?? await nextOrderKey(
          transaction,
          'tasks_areas',
          input.ownerId,
          [],
        ),
        disposition: 'present',
        deleted_at: null,
        deletion_root_id: null,
      };
      await insertRow(transaction, 'tasks_areas', area);
      return area;
    });
  }

  async createChecklistItem(
    input: CreateTaskChecklistItemInput,
  ): Promise<TaskChecklistItem> {
    requireId(input.taskId, 'A parent task is required for a checklist item');
    return this.database.writeTransaction(async (transaction) => {
      await assertOwnedParent(
        transaction,
        'tasks_todos',
        input.ownerId,
        input.taskId,
        'parent task',
      );
      const metadata = this.createMetadata(input);
      const item: TaskChecklistItem = {
        ...metadata,
        last_operation_id: input.operationId ?? metadata.client_mutation_id,
        task_id: input.taskId,
        title: normalizeTitle(input.title),
        completed: false,
        completed_at: null,
        order_key: input.orderKey ?? await nextOrderKey(
          transaction,
          'tasks_checklist_items',
          input.ownerId,
          [['task_id', input.taskId]],
        ),
        disposition: 'present',
        deleted_at: null,
        deletion_root_id: null,
      };
      await insertRow(transaction, 'tasks_checklist_items', item);
      return item;
    });
  }

  updateArea(
    ownerId: string,
    areaId: string,
    patch: TaskAreaPatch,
    context?: TaskMutationContext,
  ): Promise<TaskArea> {
    return this.updateRow<TaskArea>(
      'tasks_areas', 'area', ownerId, areaId, normalizePatch(patch), context,
    );
  }

  updateChecklistItem(
    ownerId: string,
    itemId: string,
    patch: TaskChecklistItemPatch,
    context?: TaskMutationContext,
  ): Promise<TaskChecklistItem> {
    const normalized = normalizePatch(patch);
    if (normalized.title !== undefined) normalized.title = normalizeTitle(normalized.title);
    return this.updateRow<TaskChecklistItem>(
      'tasks_checklist_items',
      'checklist item',
      ownerId,
      itemId,
      normalized,
      context,
      assertChecklistCompletion,
    );
  }

  completeChecklistItem(
    ownerId: string,
    itemId: string,
    completed: boolean,
    context?: TaskMutationContext,
  ): Promise<TaskChecklistItem> {
    return this.updateChecklistItem(
      ownerId,
      itemId,
      { completed, completed_at: completed ? this.now() : null },
      context,
    );
  }

  replayChecklistItemSnapshot(
    ownerId: string,
    itemId: string,
    expected: TaskChecklistHistorySnapshot,
    target: TaskChecklistHistorySnapshot,
    context?: TaskMutationContext,
  ): Promise<TaskChecklistItem> {
    assertOwner(ownerId);
    requireId(itemId, 'A checklist item identifier is required');
    return this.database.writeTransaction(async (transaction) => {
      const stored = await transaction.getOptional<TaskChecklistItem>(
        'SELECT * FROM tasks_checklist_items WHERE id = ? AND owner_id = ?',
        [itemId, ownerId],
      );
      if (stored === null) throw new TaskHierarchyNotFoundError('checklist item');
      const current = normalizeStoredHierarchyRow('tasks_checklist_items', stored);
      if (!checklistJournalSnapshotsEqual(checklistJournalSnapshot(current), expected)) {
        throw new InvalidTaskMutationError(
          'The checklist item changed after this action and cannot be replayed safely',
        );
      }
      const mutationContext = normalizeContext(context);
      const clientMutationId = this.createId();
      const next: TaskChecklistItem = {
        ...current,
        ...target,
        last_mutation_channel: mutationContext.channel,
        last_actor_type: mutationContext.actorType,
        last_operation_id: mutationContext.operationId || clientMutationId,
        revision: current.revision + 1,
        client_mutation_id: clientMutationId,
        updated_at: context?.occurredAt ?? this.now(),
      };
      assertChecklistCompletion(next);
      const columns: Array<keyof TaskChecklistItem> = [
        'title',
        'completed',
        'completed_at',
        'order_key',
        'last_mutation_channel',
        'last_actor_type',
        'last_operation_id',
        'revision',
        'client_mutation_id',
        'updated_at',
      ];
      await transaction.execute(
        `UPDATE tasks_checklist_items
         SET ${columns.map((columnName) => `${String(columnName)} = ?`).join(', ')}
         WHERE id = ? AND owner_id = ?`,
        [...columns.map((columnName) => toSqliteValue(next[columnName])), itemId, ownerId],
      );
      return next;
    });
  }

  private createMetadata(input: CreateHierarchyInput) {
    assertOwner(input.ownerId);
    const timestamp = input.occurredAt ?? this.now();
    const entryChannel = input.entryChannel ?? 'web';
    const id = this.createId();
    const clientMutationId = this.createId();
    return {
      id,
      owner_id: input.ownerId,
      entry_channel: entryChannel,
      last_mutation_channel: entryChannel,
      last_actor_type: input.actorType ?? 'user' as const,
      revision: 1,
      client_mutation_id: clientMutationId,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  private async updateRow<T extends HierarchyRow>(
    table: HierarchyTable,
    kind: string,
    ownerId: string,
    id: string,
    patch: Partial<T>,
    context?: TaskMutationContext,
    validate?: (next: T, transaction: Transaction) => void | Promise<void>,
  ): Promise<T> {
    assertOwner(ownerId);
    requireId(id, `A ${kind} identifier is required`);
    return this.database.writeTransaction(async (transaction) => {
      const stored = await transaction.getOptional<T>(
        `SELECT * FROM ${table} WHERE id = ? AND owner_id = ?`,
        [id, ownerId],
      );
      if (stored === null) throw new TaskHierarchyNotFoundError(kind);
      const current = normalizeStoredHierarchyRow(table, stored);
      if (Object.keys(patch).length === 0) return current;

      const mutationContext = normalizeContext(context);
      const clientMutationId = this.createId();
      const next = {
        ...current,
        ...patch,
        last_mutation_channel: mutationContext.channel,
        last_actor_type: mutationContext.actorType,
        ...(table === 'tasks_checklist_items'
          ? { last_operation_id: mutationContext.operationId || clientMutationId }
          : {}),
        revision: current.revision + 1,
        client_mutation_id: clientMutationId,
        updated_at: context?.occurredAt ?? this.now(),
      } as T;
      await validate?.(next, transaction);
      const columns = [
        ...Object.keys(patch),
        'last_mutation_channel',
        'last_actor_type',
        ...(table === 'tasks_checklist_items' ? ['last_operation_id'] : []),
        'revision',
        'client_mutation_id',
        'updated_at',
      ] as Array<keyof T>;
      await transaction.execute(
        `UPDATE ${table}
         SET ${columns.map((columnName) => `${String(columnName)} = ?`).join(', ')}
         WHERE id = ? AND owner_id = ?`,
        [...columns.map((columnName) => toSqliteValue(next[columnName])), id, ownerId],
      );
      return next;
    });
  }
}

type HierarchyRow = TaskArea | TaskChecklistItem;
type HierarchyTable =
  | 'tasks_areas'
  | 'tasks_checklist_items';

function normalizeStoredHierarchyRow<T extends HierarchyRow>(
  table: HierarchyTable,
  row: T,
): T {
  if (table !== 'tasks_checklist_items') return row;
  return {
    ...row,
    completed: Boolean((row as TaskChecklistItem).completed),
  } as T;
}

type HierarchyParentTable = 'tasks_areas' | 'tasks_todos';

async function insertRow(
  transaction: Transaction,
  table: HierarchyTable,
  row: HierarchyRow,
): Promise<void> {
  const columns = Object.keys(row) as Array<keyof typeof row>;
  await transaction.execute(
    `INSERT INTO ${table} (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
    columns.map((columnName) => toSqliteValue(row[columnName])),
  );
}

function toSqliteValue(value: unknown): unknown {
  return typeof value === 'boolean' ? Number(value) : value;
}

async function assertOwnedParent(
  transaction: Transaction,
  table: HierarchyParentTable,
  ownerId: string,
  id: string,
  kind: string,
): Promise<void> {
  const parent = await transaction.getOptional<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ? AND owner_id = ?`,
    [id, ownerId],
  );
  if (parent === null) throw new InvalidTaskMutationError(`The ${kind} is unavailable`);
}

async function nextOrderKey(
  transaction: Transaction,
  table: HierarchyTable,
  ownerId: string,
  filters: Array<[string, string | null]>,
): Promise<string> {
  const filterSql = filters.map(([columnName]) => `${columnName} IS ?`).join(' AND ');
  const last = await transaction.getOptional<{ order_key: string }>(
    `SELECT order_key FROM ${table}
     WHERE owner_id = ? AND disposition = 'present'
       ${filterSql ? `AND ${filterSql}` : ''}
     ORDER BY order_key DESC, id DESC LIMIT 1`,
    [ownerId, ...filters.map(([, value]) => value)],
  );
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

function normalizePatch<T extends object>(patch: T): T {
  const normalized = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as T;
  if ('title' in normalized && typeof normalized.title === 'string') {
    normalized.title = normalizeTitle(normalized.title);
  }
  return normalized;
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) throw new InvalidTaskMutationError('A title is required');
  if (Array.from(normalized).length > 500) {
    throw new InvalidTaskMutationError('A title cannot exceed 500 characters');
  }
  return normalized;
}

function assertOwner(ownerId: string): void {
  requireId(ownerId, 'A task owner is required');
}

function requireId(value: string, message: string): void {
  if (!value.trim()) throw new InvalidTaskMutationError(message);
}

function assertChecklistCompletion(patch: TaskChecklistItemPatch): void {
  const isCompleted = patch.completed === true && patch.completed_at != null;
  const isOpen = patch.completed === false && patch.completed_at == null;
  if (!isCompleted && !isOpen) {
    throw new InvalidTaskMutationError(
      'Checklist completion and its timestamp must agree',
    );
  }
}

function normalizeContext(
  context: TaskMutationContext | undefined,
): Required<TaskMutationContext> {
  return {
    channel: context?.channel ?? 'web',
    actorType: context?.actorType ?? 'user',
    operationId: context?.operationId ?? '',
    occurredAt: context?.occurredAt ?? '',
  };
}

function createUuid(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new InvalidTaskMutationError('Secure UUID generation is unavailable');
  }
  return crypto.randomUUID();
}

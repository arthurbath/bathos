import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import {
  assertTaskCalendarRange,
  isTaskPlanningTimeZone,
  normalizeTaskCalendarDate,
} from '@/modules/tasks/domain/taskDates';
import {
  createTaskUndoPatch,
  parseTaskHistoryEvent,
  type TaskHistorySnapshot,
  type TaskHistoryStorageRow,
} from '@/modules/tasks/domain/taskHistory';
import {
  applyTaskStateTransition,
  type TaskStateTransition,
} from '@/modules/tasks/domain/taskState';
import type {
  TaskActorType,
  TaskDestination,
  TaskEntryChannel,
  TaskSourceKind,
  TaskTodo,
  TaskUserSettings,
} from '@/modules/tasks/types/tasks';

export type TaskRepositoryDatabase = Pick<AbstractPowerSyncDatabase, 'writeTransaction'>;

export type CreateTaskInput = {
  ownerId: string;
  title: string;
  notes?: string;
  destination?: TaskDestination;
  orderKey?: string;
  startDate?: string | null;
  deadline?: string | null;
  entryChannel?: TaskEntryChannel;
  sourceKind?: TaskSourceKind | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceExternalId?: string | null;
  actorType?: TaskActorType;
};

export type TaskMutationContext = {
  channel?: TaskEntryChannel;
  actorType?: TaskActorType;
};

export type EditableTaskPatch = Partial<
  Pick<
    TaskTodo,
    | 'title'
    | 'notes'
    | 'destination'
    | 'order_key'
    | 'start_date'
    | 'deadline'
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
  'start_date',
  'deadline',
  'entry_channel',
  'last_mutation_channel',
  'last_actor_type',
  'undo_source_event_id',
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

export class TaskHistoryEventNotFoundError extends Error {
  constructor() {
    super('The history event does not exist for the signed-in owner');
    this.name = 'TaskHistoryEventNotFoundError';
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
    const startDate = normalizeTaskCalendarDate(input.startDate, 'Start date') ?? null;
    const deadline = normalizeTaskCalendarDate(input.deadline, 'Deadline') ?? null;
    assertTaskCalendarRange(startDate, deadline);

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
      const entryChannel = input.entryChannel ?? 'web';
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
        start_date: startDate,
        deadline,
        entry_channel: entryChannel,
        last_mutation_channel: entryChannel,
        last_actor_type: input.actorType ?? 'user',
        undo_source_event_id: null,
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

  async ensurePlanningSettings(
    ownerId: string,
    planningTimeZone: string,
  ): Promise<TaskUserSettings> {
    assertOwner(ownerId);
    if (!isTaskPlanningTimeZone(planningTimeZone)) {
      throw new InvalidTaskMutationError('A recognized IANA planning time zone is required');
    }

    return this.database.writeTransaction(async (transaction) => {
      const existing = await transaction.getOptional<TaskUserSettings>(
        'SELECT * FROM tasks_user_settings WHERE owner_id = ?',
        [ownerId],
      );
      if (existing !== null) {
        return existing;
      }

      const timestamp = this.now();
      const setting: TaskUserSettings = {
        id: ownerId,
        owner_id: ownerId,
        planning_timezone: planningTimeZone,
        revision: 1,
        client_mutation_id: this.createId(),
        created_at: timestamp,
        updated_at: timestamp,
      };
      await transaction.execute(
        `INSERT INTO tasks_user_settings
          (id, owner_id, planning_timezone, revision, client_mutation_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          setting.id,
          setting.owner_id,
          setting.planning_timezone,
          setting.revision,
          setting.client_mutation_id,
          setting.created_at,
          setting.updated_at,
        ],
      );
      return setting;
    });
  }

  async updateTask(
    ownerId: string,
    taskId: string,
    patch: EditableTaskPatch,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    return this.mutateTask(ownerId, taskId, normalizeEditablePatch(patch), context);
  }

  async transitionTask(
    ownerId: string,
    taskId: string,
    transition: TaskStateTransition,
    context?: TaskMutationContext,
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

      return updateOwnedTask(
        transaction,
        current,
        {
          lifecycle: result.state.lifecycle,
          completed_at: result.state.completedAt,
          canceled_at: result.state.canceledAt,
          disposition: result.state.disposition,
          deleted_at: result.state.deletedAt,
        },
        this.createId(),
        occurredAt,
        normalizeMutationContext(context),
      );
    });
  }

  async undoTask(
    ownerId: string,
    eventId: string,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    return this.database.writeTransaction(async (transaction) => {
      const storedEvent = await transaction.getOptional<TaskHistoryStorageRow>(
        'SELECT * FROM tasks_history_events WHERE id = ? AND owner_id = ?',
        [eventId, ownerId],
      );
      if (storedEvent === null) {
        throw new TaskHistoryEventNotFoundError();
      }

      const event = parseTaskHistoryEvent(storedEvent);
      const current = await getOwnedTask(transaction, ownerId, event.task_id);
      const patch = createTaskUndoPatch(current, event);
      assertSource(
        patch.source_kind,
        patch.source_url,
        patch.source_title,
        patch.source_external_id,
      );
      assertTaskCalendarRange(
        patch.start_date === undefined ? current.start_date : patch.start_date,
        patch.deadline === undefined ? current.deadline : patch.deadline,
      );

      return updateOwnedTask(
        transaction,
        current,
        patch,
        this.createId(),
        this.now(),
        normalizeMutationContext(context),
        event.id,
      );
    });
  }

  private async mutateTask(
    ownerId: string,
    taskId: string,
    patch: EditableTaskPatch,
    context?: TaskMutationContext,
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
      assertTaskCalendarRange(
        patch.start_date === undefined ? current.start_date : patch.start_date,
        patch.deadline === undefined ? current.deadline : patch.deadline,
      );

      return updateOwnedTask(
        transaction,
        current,
        patch,
        this.createId(),
        this.now(),
        normalizeMutationContext(context),
      );
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
  patch: EditableTaskPatch | TaskStatePatch | TaskHistorySnapshot,
  mutationId: string,
  updatedAt: string,
  context: Required<TaskMutationContext>,
  undoSourceEventId: string | null = null,
): Promise<TaskTodo> {
  const metadataPatch = {
    last_mutation_channel: context.channel,
    last_actor_type: context.actorType,
    undo_source_event_id: undoSourceEventId,
  };
  const next = {
    ...current,
    ...patch,
    ...metadataPatch,
    revision: current.revision + 1,
    client_mutation_id: mutationId,
    updated_at: updatedAt,
  };
  const changedColumns = [
    ...Object.keys(patch),
    ...Object.keys(metadataPatch),
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

function normalizeMutationContext(
  context: TaskMutationContext | undefined,
): Required<TaskMutationContext> {
  return {
    channel: context?.channel ?? 'web',
    actorType: context?.actorType ?? 'user',
  };
}

function normalizeEditablePatch(patch: EditableTaskPatch): EditableTaskPatch {
  const normalized = { ...patch };
  if (patch.title !== undefined) {
    normalized.title = normalizeTitle(patch.title);
  }
  if (patch.start_date !== undefined) {
    normalized.start_date = normalizeTaskCalendarDate(patch.start_date, 'Start date') ?? null;
  }
  if (patch.deadline !== undefined) {
    normalized.deadline = normalizeTaskCalendarDate(patch.deadline, 'Deadline') ?? null;
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

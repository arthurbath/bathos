import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import { TaskHierarchyOperationsRepository } from '@/modules/tasks/data/taskHierarchyOperationsRepository';
import {
  isTaskPlanningTimeZone,
  normalizeTaskCalendarDate,
  taskCalendarDateInTimeZone,
} from '@/modules/tasks/domain/taskDates';
import { normalizeTaskPrimaryLink } from '@/modules/tasks/domain/taskPrimaryLink';
import {
  createTaskRedoPatch,
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
  TaskActionability,
  TaskDestination,
  TaskEntryChannel,
  TaskSourceKind,
  TaskTodaySection,
  TaskTodo,
  TaskUserSettings,
} from '@/modules/tasks/types/tasks';

export type TaskRepositoryDatabase = Pick<AbstractPowerSyncDatabase, 'writeTransaction'>;

export type CreateTaskInput = {
  ownerId: string;
  title: string;
  notes?: string;
  destination?: TaskDestination;
  todaySection?: TaskTodaySection;
  orderKey?: string;
  startDate?: string | null;
  deadline?: string | null;
  primaryLink?: string | null;
  entryChannel?: TaskEntryChannel;
  sourceKind?: TaskSourceKind | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceExternalId?: string | null;
  actorType?: TaskActorType;
  actionability?: TaskActionability;
  areaId?: string | null;
  projectId?: string | null;
  hierarchyOrderKey?: string | null;
};

export type TaskMutationContext = {
  channel?: TaskEntryChannel;
  actorType?: TaskActorType;
};

export type TaskPlanningMoveInput = {
  destination: TaskDestination;
  todaySection?: TaskTodaySection;
  startDate?: string | null;
};

export type TaskContainerMoveInput = {
  areaId?: string | null;
  projectId?: string | null;
  hierarchyOrderKey?: string | null;
};

export type EditableTaskPatch = Partial<
  Pick<
    TaskTodo,
    | 'title'
    | 'actionability'
    | 'notes'
    | 'destination'
    | 'today_section'
    | 'order_key'
    | 'area_id'
    | 'project_id'
    | 'hierarchy_order_key'
    | 'start_date'
    | 'deadline'
    | 'primary_link'
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
  'actionability',
  'area_id',
  'project_id',
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
  'hierarchy_order_key',
  'start_date',
  'deadline',
  'primary_link',
  'entry_channel',
  'last_mutation_channel',
  'last_actor_type',
  'undo_source_event_id',
  'source_kind',
  'source_url',
  'source_title',
  'source_external_id',
  'template_definition_id',
  'template_revision',
  'template_instantiation_id',
  'template_node_id',
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
  private readonly hierarchyOperations: TaskHierarchyOperationsRepository;

  constructor(
    private readonly database: TaskRepositoryDatabase,
    options: TaskRepositoryOptions = {},
  ) {
    this.createId = options.createId ?? createUuid;
    this.now = options.now ?? (() => new Date().toISOString());
    this.hierarchyOperations = new TaskHierarchyOperationsRepository(database, options);
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
    const destination = input.destination ?? 'anytime';
    if (destination === 'someday' && (input.todaySection != null || input.startDate != null)) {
      throw new InvalidTaskMutationError('Someday work cannot retain planning dates');
    }
    const requestedStartDate = input.startDate;
    const startDate = normalizeTaskCalendarDate(requestedStartDate, 'Start date') ?? null;
    const deadline = normalizeTaskCalendarDate(input.deadline, 'Deadline') ?? null;
    assertTaskContainer(input.areaId ?? null, input.projectId ?? null);

    return this.database.writeTransaction(async (transaction) => {
      const timestamp = this.now();
      const todaySection = destination === 'someday'
        ? null
        : input.todaySection ?? (startDate || input.startDate === undefined ? 'next' : null);
      assertPlanningPlacement(destination, todaySection, startDate);
      await assertFutureStartDate(transaction, input.ownerId, startDate, timestamp);
      await assertOwnedTaskContainer(
        transaction,
        input.ownerId,
        input.areaId ?? null,
        input.projectId ?? null,
      );
      const lastTask = input.orderKey
        ? null
        : await transaction.getOptional<{ order_key: string }>(
            `SELECT order_key
             FROM tasks_todos
             WHERE owner_id = ?
               AND destination = ?
               AND today_section IS ?
               AND lifecycle = 'open'
               AND disposition = 'present'
             ORDER BY order_key DESC, id DESC
             LIMIT 1`,
            [input.ownerId, destination, todaySection],
          );
      const hierarchyOrderKey = input.hierarchyOrderKey !== undefined
        ? input.hierarchyOrderKey
        : await nextHierarchyOrderKey(
          transaction,
          input.ownerId,
          input.areaId ?? null,
          input.projectId ?? null,
        );
      const entryChannel = input.entryChannel ?? 'web';
      const task: TaskTodo = {
        id: this.createId(),
        owner_id: input.ownerId,
        actionability: input.actionability ?? 'actionable',
        area_id: input.areaId ?? null,
        project_id: input.projectId ?? null,
        title,
        notes: input.notes ?? '',
        lifecycle: 'open',
        completed_at: null,
        canceled_at: null,
        disposition: 'present',
        deleted_at: null,
        deletion_root_id: null,
        destination,
        today_section: todaySection,
        order_key: input.orderKey ?? generateTaskOrderKey(lastTask?.order_key ?? null, null),
        hierarchy_order_key: hierarchyOrderKey,
        start_date: startDate,
        deadline,
        primary_link: normalizeTaskPrimaryLink(input.primaryLink),
        entry_channel: entryChannel,
        last_mutation_channel: entryChannel,
        last_actor_type: input.actorType ?? 'user',
        undo_source_event_id: null,
        source_kind: input.sourceKind ?? null,
        source_url: input.sourceUrl ?? null,
        source_title: input.sourceTitle ?? null,
        source_external_id: input.sourceExternalId ?? null,
        template_definition_id: null,
        template_revision: null,
        template_instantiation_id: null,
        template_node_id: null,
        recurrence_definition_id: null,
        recurrence_revision: null,
        recurrence_occurrence_id: null,
        recurrence_logical_key: null,
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

  async activateDueStartDates(ownerId: string, planningDate: string): Promise<TaskTodo[]> {
    assertOwner(ownerId);
    const reachedDate = normalizeTaskCalendarDate(planningDate, 'Planning date');
    if (reachedDate === null) {
      throw new InvalidTaskMutationError('A planning date is required for activation');
    }

    return this.database.writeTransaction(async (transaction) => {
      const dueTasks = await transaction.getAll<TaskTodo>(
        `SELECT * FROM tasks_todos
         WHERE owner_id = ?
           AND destination = 'anytime'
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND start_date IS NOT NULL
           AND start_date <= ?
         ORDER BY start_date, order_key, id`,
        [ownerId, reachedDate],
      );
      const occurredAt = this.now();
      const activated: TaskTodo[] = [];
      for (const current of dueTasks) {
        activated.push(await updateOwnedTask(
          transaction,
          current,
          { start_date: null },
          this.createId(),
          occurredAt,
          { channel: 'native', actorType: 'system' },
        ));
      }
      return activated;
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

  async moveTask(
    ownerId: string,
    taskId: string,
    input: TaskPlanningMoveInput,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    if (input.destination === 'someday' && (input.todaySection != null || input.startDate != null)) {
      throw new InvalidTaskMutationError('Someday work cannot retain planning dates');
    }
    const startDate = normalizeTaskCalendarDate(input.startDate, 'Start date') ?? null;
    const todaySection = input.destination === 'someday'
      ? null
      : input.todaySection ?? (startDate ? 'next' : null);
    assertPlanningPlacement(input.destination, todaySection, startDate);

    return this.database.writeTransaction(async (transaction) => {
      const occurredAt = this.now();
      await assertFutureStartDate(transaction, ownerId, startDate, occurredAt);
      const current = await getOwnedTask(transaction, ownerId, taskId);
      const lastTask = await transaction.getOptional<{ order_key: string }>(
        `SELECT order_key
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = ?
           AND today_section IS ?
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND id <> ?
         ORDER BY order_key DESC, id DESC
         LIMIT 1`,
        [ownerId, input.destination, todaySection, taskId],
      );
      return updateOwnedTask(
        transaction,
        current,
        {
          destination: input.destination,
          today_section: todaySection,
          start_date: startDate,
          order_key: generateTaskOrderKey(lastTask?.order_key ?? null, null),
        },
        this.createId(),
        occurredAt,
        normalizeMutationContext(context),
      );
    });
  }

  async moveTasks(
    ownerId: string,
    taskIds: string[],
    input: TaskPlanningMoveInput,
    context?: TaskMutationContext,
  ): Promise<TaskTodo[]> {
    assertOwner(ownerId);
    if (input.destination === 'someday' && (input.todaySection != null || input.startDate != null)) {
      throw new InvalidTaskMutationError('Someday work cannot retain planning dates');
    }
    const uniqueTaskIds = Array.from(new Set(taskIds));
    if (uniqueTaskIds.length === 0) {
      throw new InvalidTaskMutationError('Select at least one task for bulk planning');
    }
    const startDate = normalizeTaskCalendarDate(input.startDate, 'Start date') ?? null;
    const todaySection = input.destination === 'someday'
      ? null
      : input.todaySection ?? (startDate ? 'next' : null);
    assertPlanningPlacement(input.destination, todaySection, startDate);

    return this.database.writeTransaction(async (transaction) => {
      const occurredAt = this.now();
      await assertFutureStartDate(transaction, ownerId, startDate, occurredAt);
      const currentTasks: TaskTodo[] = [];
      for (const taskId of uniqueTaskIds) {
        const current = await getOwnedTask(transaction, ownerId, taskId);
        if (current.lifecycle !== 'open' || current.disposition !== 'present') {
          throw new InvalidTaskMutationError(
            'Bulk planning applies only to open, present tasks',
          );
        }
        currentTasks.push(current);
      }

      const placeholders = uniqueTaskIds.map(() => '?').join(', ');
      const lastTask = await transaction.getOptional<{ order_key: string }>(
        `SELECT order_key
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = ?
           AND today_section IS ?
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND id NOT IN (${placeholders})
         ORDER BY order_key DESC, id DESC
         LIMIT 1`,
        [ownerId, input.destination, todaySection, ...uniqueTaskIds],
      );
      const mutationContext = normalizeMutationContext(context);
      let previousOrderKey = lastTask?.order_key ?? null;
      const movedTasks: TaskTodo[] = [];

      for (const current of currentTasks) {
        const orderKey = generateTaskOrderKey(previousOrderKey, null);
        const moved = await updateOwnedTask(
          transaction,
          current,
          {
            destination: input.destination,
            today_section: todaySection,
            start_date: startDate,
            order_key: orderKey,
          },
          this.createId(),
          occurredAt,
          mutationContext,
        );
        movedTasks.push(moved);
        previousOrderKey = orderKey;
      }

      return movedTasks;
    });
  }

  async transitionTask(
    ownerId: string,
    taskId: string,
    transition: TaskStateTransition,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    if (transition === 'delete' || transition === 'restore') {
      await this.hierarchyOperations.request({
        ownerId,
        rootType: 'todo',
        rootId: taskId,
        operation: transition,
        descendantPolicy: 'cascade',
        context,
      });
      return this.database.writeTransaction((transaction) => (
        getOwnedTask(transaction, ownerId, taskId)
      ));
    }
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

  async moveTaskToContainer(
    ownerId: string,
    taskId: string,
    input: TaskContainerMoveInput,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    const areaId = input.areaId ?? null;
    const projectId = input.projectId ?? null;
    assertTaskContainer(areaId, projectId);

    return this.database.writeTransaction(async (transaction) => {
      const current = await getOwnedTask(transaction, ownerId, taskId);
      await assertOwnedTaskContainer(
        transaction,
        ownerId,
        areaId,
        projectId,
      );
      const hierarchyOrderKey = input.hierarchyOrderKey !== undefined
        ? input.hierarchyOrderKey
        : await nextHierarchyOrderKey(
          transaction,
          ownerId,
          areaId,
          projectId,
          taskId,
        );
      return updateOwnedTask(
        transaction,
        current,
        {
          area_id: areaId,
          project_id: projectId,
          hierarchy_order_key: hierarchyOrderKey,
        },
        this.createId(),
        this.now(),
        normalizeMutationContext(context),
      );
    });
  }

  async undoTask(
    ownerId: string,
    eventId: string,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    return this.applyHistoryEvent(ownerId, eventId, 'undo', context);
  }

  async redoTask(
    ownerId: string,
    eventId: string,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    return this.applyHistoryEvent(ownerId, eventId, 'redo', context);
  }

  private async applyHistoryEvent(
    ownerId: string,
    eventId: string,
    direction: 'undo' | 'redo',
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
      const patch = direction === 'undo'
        ? createTaskUndoPatch(current, event)
        : createTaskRedoPatch(current, event);
      const occurredAt = this.now();
      assertSource(
        patch.source_kind,
        patch.source_url,
        patch.source_title,
        patch.source_external_id,
      );
      assertPlanningPlacement(
        patch.destination === undefined ? current.destination : patch.destination,
        patch.today_section === undefined ? current.today_section : patch.today_section,
        patch.start_date === undefined ? current.start_date : patch.start_date,
      );
      if (patch.start_date !== undefined) {
        await assertFutureStartDate(transaction, ownerId, patch.start_date, occurredAt);
      }
      assertTaskContainer(
        patch.area_id === undefined ? current.area_id : patch.area_id,
        patch.project_id === undefined ? current.project_id : patch.project_id,
      );
      await assertOwnedTaskContainer(
        transaction,
        ownerId,
        patch.area_id,
        patch.project_id,
      );

      return updateOwnedTask(
        transaction,
        current,
        patch,
        this.createId(),
        occurredAt,
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

      if (
        patch.actionability !== undefined
        && patch.actionability !== current.actionability
        && (current.lifecycle !== 'open' || current.disposition !== 'present')
      ) {
        throw new InvalidTaskMutationError(
          'Actionability can be changed only on open, present tasks',
        );
      }

      assertSource(
        patch.source_kind === undefined ? current.source_kind : patch.source_kind,
        patch.source_url === undefined ? current.source_url : patch.source_url,
        patch.source_title === undefined ? current.source_title : patch.source_title,
        patch.source_external_id === undefined
          ? current.source_external_id
          : patch.source_external_id,
      );
      if (patch.destination === 'someday') {
        patch.start_date = null;
        patch.today_section = null;
      } else if (
        patch.start_date !== undefined
        && patch.today_section === undefined
        && current.today_section === null
      ) {
        patch.today_section = 'next';
      }
      assertPlanningPlacement(
        patch.destination === undefined ? current.destination : patch.destination,
        patch.today_section === undefined ? current.today_section : patch.today_section,
        patch.start_date === undefined ? current.start_date : patch.start_date,
      );
      const occurredAt = this.now();
      if (patch.start_date !== undefined) {
        await assertFutureStartDate(transaction, ownerId, patch.start_date, occurredAt);
      }
      const areaId = patch.area_id === undefined ? current.area_id : patch.area_id;
      const projectId = patch.project_id === undefined ? current.project_id : patch.project_id;
      assertTaskContainer(areaId, projectId);
      const containerChanged = (
        patch.area_id !== undefined
        || patch.project_id !== undefined
      );
      if (containerChanged) {
        await assertOwnedTaskContainer(
          transaction,
          ownerId,
          areaId,
          projectId,
        );
      }

      const preparedPatch = containerChanged && patch.hierarchy_order_key === undefined
        ? {
          ...patch,
          hierarchy_order_key: await nextHierarchyOrderKey(
            transaction,
            ownerId,
            areaId,
            projectId,
            taskId,
          ),
        }
        : patch;

      return updateOwnedTask(
        transaction,
        current,
        preparedPatch,
        this.createId(),
        occurredAt,
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
  if (patch.primary_link !== undefined) {
    normalized.primary_link = normalizeTaskPrimaryLink(patch.primary_link);
    if ((normalized.primary_link?.length ?? 0) > 8000) {
      throw new InvalidTaskMutationError('A Primary Link cannot exceed 8,000 characters');
    }
  }
  if (
    patch.actionability !== undefined
    && patch.actionability !== 'actionable'
    && patch.actionability !== 'waiting'
    && patch.actionability !== 'rechecking'
  ) {
    throw new InvalidTaskMutationError(
      'Task actionability must be actionable, waiting, or rechecking',
    );
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

function assertTaskContainer(
  areaId: string | null,
  projectId: string | null,
): void {
  if (areaId != null && projectId != null) {
    throw new InvalidTaskMutationError(
      'A task cannot belong directly to both an area and a project',
    );
  }
}

async function assertOwnedTaskContainer(
  transaction: Transaction,
  ownerId: string,
  areaId: string | null | undefined,
  projectId: string | null | undefined,
): Promise<void> {
  if (areaId != null) {
    const area = await transaction.getOptional<{ id: string }>(
      'SELECT id FROM tasks_areas WHERE id = ? AND owner_id = ?',
      [areaId, ownerId],
    );
    if (area === null) throw new InvalidTaskMutationError('The task area is unavailable');
  }
  if (projectId != null) {
    const project = await transaction.getOptional<{ id: string }>(
      'SELECT id FROM tasks_projects WHERE id = ? AND owner_id = ?',
      [projectId, ownerId],
    );
    if (project === null) throw new InvalidTaskMutationError('The task project is unavailable');
  }
}

async function nextHierarchyOrderKey(
  transaction: Transaction,
  ownerId: string,
  areaId: string | null,
  projectId: string | null,
  excludeTaskId?: string,
): Promise<string | null> {
  if (areaId === null && projectId === null) return null;
  const excludedTaskClause = excludeTaskId ? 'AND id <> ?' : '';
  const lastTask = await transaction.getOptional<{ hierarchy_order_key: string }>(
    `SELECT hierarchy_order_key
     FROM tasks_todos
     WHERE owner_id = ?
       AND area_id IS ?
       AND project_id IS ?
       AND lifecycle = 'open'
       AND disposition = 'present'
       AND hierarchy_order_key IS NOT NULL
       ${excludedTaskClause}
     ORDER BY hierarchy_order_key DESC, id DESC
     LIMIT 1`,
    [ownerId, areaId, projectId, ...(excludeTaskId ? [excludeTaskId] : [])],
  );
  return generateTaskOrderKey(lastTask?.hierarchy_order_key ?? null, null);
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

function assertPlanningPlacement(
  destination: TaskDestination,
  todaySection: TaskTodaySection | null,
  startDate: string | null,
): void {
  if (destination === 'someday' && (todaySection !== null || startDate !== null)) {
    throw new InvalidTaskMutationError('Someday work cannot retain planning dates');
  }
  if (startDate !== null && todaySection === null) {
    throw new InvalidTaskMutationError('A future start date requires a day horizon');
  }
}

async function assertFutureStartDate(
  transaction: Transaction,
  ownerId: string,
  startDate: string | null,
  now: string,
): Promise<void> {
  if (startDate === null) return;
  const [settings] = await transaction.getAll<Pick<TaskUserSettings, 'planning_timezone'>>(
    `SELECT planning_timezone
     FROM tasks_user_settings
     WHERE owner_id = ?
     LIMIT 1`,
    [ownerId],
  );
  const planningTimeZone = settings?.planning_timezone
    && isTaskPlanningTimeZone(settings.planning_timezone)
    ? settings.planning_timezone
    : 'UTC';
  const planningDate = taskCalendarDateInTimeZone(planningTimeZone, new Date(now));
  if (startDate <= planningDate) {
    throw new InvalidTaskMutationError('Start date must be after today');
  }
}

function createUuid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new InvalidTaskMutationError('Secure task identifiers are unavailable');
  }
  return globalThis.crypto.randomUUID();
}

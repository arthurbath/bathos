import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { deriveTaskAreaSections } from '@/modules/tasks/domain/taskAreaViews';
import { assignMaterializedTaskOrderKeys } from '@/modules/tasks/domain/taskAutomaticOrder';
import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import { TaskHierarchyOperationsRepository } from '@/modules/tasks/data/taskHierarchyOperationsRepository';
import {
  isTaskPlanningTimeZone,
  normalizeTaskCalendarDate,
  taskCalendarDateInTimeZone,
} from '@/modules/tasks/domain/taskDates';
import { normalizeTaskPrimaryLink } from '@/modules/tasks/domain/taskPrimaryLink';
import type { TaskDragHandleVisibility } from '@/modules/tasks/domain/taskDragHandles';
import {
  createTaskRedoPatch,
  createTaskUndoPatch,
  parseTaskHistoryEvent,
  UnsafeTaskRedoError,
  UnsafeTaskUndoError,
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
  TaskArea,
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
  todaySection?: TaskTodaySection | null;
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
  hierarchyOrderKey?: string | null;
  operationId?: string;
};

export type TaskMutationContext = {
  channel?: TaskEntryChannel;
  actorType?: TaskActorType;
  operationId?: string;
  occurredAt?: string;
};

type NormalizedTaskMutationContext = {
  channel: TaskEntryChannel;
  actorType: TaskActorType;
  operationId?: string;
};

export type TaskPlanningMoveInput = {
  destination: TaskDestination;
  todaySection?: TaskTodaySection;
  startDate?: string | null;
};

export type TaskContainerMoveInput = {
  areaId?: string | null;
  hierarchyOrderKey?: string | null;
};

export type TaskBulkPatchInput = {
  taskId: string;
  patch: EditableTaskPatch;
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
    | 'upcoming_order_key'
    | 'area_id'
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
  transientWriteRetryDelaysMs?: readonly number[];
};

const defaultTransientWriteRetryDelaysMs = [50, 250, 750] as const;

const insertColumns = [
  'id',
  'owner_id',
  'actionability',
  'area_id',
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
  'upcoming_order_key',
  'hierarchy_order_key',
  'start_date',
  'deadline',
  'primary_link',
  'entry_channel',
  'last_mutation_channel',
  'last_actor_type',
  'last_operation_id',
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
  private readonly hierarchyOperations: TaskHierarchyOperationsRepository;
  private readonly transientWriteRetryDelaysMs: readonly number[];

  constructor(
    private readonly database: TaskRepositoryDatabase,
    options: TaskRepositoryOptions = {},
  ) {
    this.createId = options.createId ?? createUuid;
    this.now = options.now ?? (() => new Date().toISOString());
    this.transientWriteRetryDelaysMs = options.transientWriteRetryDelaysMs
      ?? defaultTransientWriteRetryDelaysMs;
    this.hierarchyOperations = new TaskHierarchyOperationsRepository(database, options);
  }

  private async writePlanningTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    let retryIndex = 0;
    while (true) {
      try {
        return await this.database.writeTransaction(callback);
      } catch (error) {
        const retryDelayMs = this.transientWriteRetryDelaysMs[retryIndex];
        if (
          retryDelayMs === undefined
          || !isTransientOpfsAccessHandleConflict(error)
        ) {
          throw error;
        }
        retryIndex += 1;
        await waitForRetry(retryDelayMs);
      }
    }
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
    const startDate = normalizeTaskCalendarDate(requestedStartDate, "Start") ?? null;
    const deadline = normalizeTaskCalendarDate(input.deadline, 'Deadline') ?? null;
    return this.database.writeTransaction(async (transaction) => {
      const timestamp = this.now();
      const todaySection = destination === 'someday'
        ? null
        : startDate
          ? null
          : input.todaySection ?? (input.startDate === undefined ? 'next' : null);
      assertPlanningPlacement(destination, todaySection, startDate);
      await assertFutureStartDate(transaction, input.ownerId, startDate, timestamp);
      await assertOwnedTaskArea(transaction, input.ownerId, input.areaId ?? null);
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
      const hierarchyOrderKey = input.hierarchyOrderKey !== undefined
        ? input.hierarchyOrderKey
        : await nextHierarchyOrderKey(
          transaction,
          input.ownerId,
          input.areaId ?? null,
        );
      const entryChannel = input.entryChannel ?? 'web';
      const taskId = this.createId();
      const clientMutationId = this.createId();
      const task: TaskTodo = {
        id: taskId,
        owner_id: input.ownerId,
        actionability: input.actionability ?? 'actionable',
        area_id: input.areaId ?? null,
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
        upcoming_order_key: input.orderKey
          ?? generateTaskOrderKey(lastTask?.order_key ?? null, null),
        hierarchy_order_key: hierarchyOrderKey,
        start_date: startDate,
        deadline,
        primary_link: normalizeTaskPrimaryLink(input.primaryLink),
        entry_channel: entryChannel,
        last_mutation_channel: entryChannel,
        last_actor_type: input.actorType ?? 'user',
        last_operation_id: input.operationId ?? clientMutationId,
        undo_source_event_id: null,
        source_kind: input.sourceKind ?? null,
        source_url: input.sourceUrl ?? null,
        source_title: input.sourceTitle ?? null,
        source_external_id: input.sourceExternalId ?? null,
        recurrence_definition_id: null,
        recurrence_revision: null,
        recurrence_occurrence_id: null,
        recurrence_logical_key: null,
        recurrence_superseded_at: null,
        revision: 1,
        client_mutation_id: clientMutationId,
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
        automatic_list_sorting: false,
        drag_handle_visibility: 'hidden',
        revision: 1,
        client_mutation_id: this.createId(),
        created_at: timestamp,
        updated_at: timestamp,
      };
      await transaction.execute(
        `INSERT INTO tasks_user_settings
          (id, owner_id, planning_timezone, automatic_list_sorting, drag_handle_visibility, revision,
           client_mutation_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          setting.id,
          setting.owner_id,
          setting.planning_timezone,
          setting.automatic_list_sorting ? 1 : 0,
          setting.drag_handle_visibility,
          setting.revision,
          setting.client_mutation_id,
          setting.created_at,
          setting.updated_at,
        ],
      );
      return setting;
    });
  }

  async setAutomaticListSorting(
    ownerId: string,
    enabled: boolean,
  ): Promise<TaskUserSettings> {
    assertOwner(ownerId);
    return this.database.writeTransaction(async (transaction) => {
      const settings = await transaction.getOptional<TaskUserSettings>(
        'SELECT * FROM tasks_user_settings WHERE owner_id = ?',
        [ownerId],
      );
      if (settings === null) {
        throw new InvalidTaskMutationError('Task settings are unavailable');
      }

      if (!enabled && Boolean(settings.automatic_list_sorting)) {
        const tasks = await transaction.getAll<TaskTodo>(
          `SELECT * FROM tasks_todos
           WHERE owner_id = ?
             AND lifecycle = 'open'
             AND disposition = 'present'
             AND destination IN ('anytime', 'someday')`,
          [ownerId],
        );
        const areas = await transaction.getAll<TaskArea>(
          `SELECT * FROM tasks_areas
           WHERE owner_id = ? AND disposition = 'present'`,
          [ownerId],
        );
        const orderedGroups = (['anytime', 'someday'] as const).flatMap((destination) => (
          deriveTaskAreaSections(
            tasks.filter((task) => task.destination === destination),
            areas,
            true,
          ).map((section) => section.tasks)
        ));
        const materializedKeys = assignMaterializedTaskOrderKeys(orderedGroups);
        const timestamp = this.now();
        for (const task of tasks) {
          const orderKey = materializedKeys.get(task.id);
          if (orderKey === undefined || orderKey === task.order_key) continue;
          await transaction.execute(
            `UPDATE tasks_todos
             SET order_key = ?,
                 revision = revision + 1,
                 client_mutation_id = ?,
                 updated_at = ?
             WHERE id = ? AND owner_id = ?`,
            [orderKey, this.createId(), timestamp, task.id, ownerId],
          );
        }
      }

      const updated: TaskUserSettings = {
        ...settings,
        automatic_list_sorting: enabled,
        revision: settings.revision + 1,
        client_mutation_id: this.createId(),
        updated_at: this.now(),
      };
      await transaction.execute(
        `UPDATE tasks_user_settings
         SET automatic_list_sorting = ?,
             revision = ?,
             client_mutation_id = ?,
             updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          enabled ? 1 : 0,
          updated.revision,
          updated.client_mutation_id,
          updated.updated_at,
          settings.id,
          ownerId,
        ],
      );
      return updated;
    });
  }

  async setDragHandleVisibility(
    ownerId: string,
    visibility: TaskDragHandleVisibility,
  ): Promise<TaskUserSettings> {
    assertOwner(ownerId);
    return this.database.writeTransaction(async (transaction) => {
      const settings = await transaction.getOptional<TaskUserSettings>(
        'SELECT * FROM tasks_user_settings WHERE owner_id = ?',
        [ownerId],
      );
      if (settings === null) {
        throw new InvalidTaskMutationError('Task settings are unavailable');
      }

      const updated: TaskUserSettings = {
        ...settings,
        drag_handle_visibility: visibility,
        revision: settings.revision + 1,
        client_mutation_id: this.createId(),
        updated_at: this.now(),
      };
      await transaction.execute(
        `UPDATE tasks_user_settings
         SET drag_handle_visibility = ?,
             revision = ?,
             client_mutation_id = ?,
             updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          visibility,
          updated.revision,
          updated.client_mutation_id,
          updated.updated_at,
          settings.id,
          ownerId,
        ],
      );
      return updated;
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
           AND (
             (start_date IS NOT NULL AND start_date <= ? AND today_section IS NULL)
             OR (
               start_date IS NULL
               AND today_section IS NULL
               AND deadline IS NOT NULL
               AND deadline <= ?
             )
           )
         ORDER BY COALESCE(start_date, deadline),
                  COALESCE(upcoming_order_key, order_key),
                  id`,
        [ownerId, reachedDate, reachedDate],
      );
      const inboxTail = await transaction.getOptional<{ order_key: string }>(
        `SELECT order_key FROM tasks_todos
         WHERE owner_id = ?
           AND destination = 'anytime'
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND today_section = 'inbox'
         ORDER BY order_key DESC, id DESC
         LIMIT 1`,
        [ownerId],
      );
      const occurredAt = this.now();
      const activated: TaskTodo[] = [];
      let nextOrderKey = inboxTail?.order_key ?? null;
      for (const current of dueTasks) {
        const materializedDeadlineStart = current.start_date === null
          ? reachedDate
          : null;
        nextOrderKey = generateTaskOrderKey(nextOrderKey, null);
        activated.push(await updateOwnedTask(
          transaction,
          current,
          {
            start_date: materializedDeadlineStart,
            today_section: 'inbox',
            order_key: nextOrderKey,
          },
          this.createId(),
          occurredAt,
          { channel: 'native', actorType: 'system' },
        ));
      }
      return activated;
    });
  }

  async rolloverTodayTasks(
    ownerId: string,
    planningDate: string,
    planningTimeZone: string,
  ): Promise<TaskTodo[]> {
    assertOwner(ownerId);
    const reachedDate = normalizeTaskCalendarDate(planningDate, 'Planning date');
    if (reachedDate === null) {
      throw new InvalidTaskMutationError('A planning date is required for rollover');
    }
    if (!isTaskPlanningTimeZone(planningTimeZone)) {
      throw new InvalidTaskMutationError('A recognized IANA planning time zone is required');
    }

    return this.database.writeTransaction(async (transaction) => {
      const binding = await transaction.getOptional<{
        owner_id: string;
        planning_date: string | null;
      }>(
        'SELECT owner_id, planning_date FROM tasks_owner_binding WHERE id = ?',
        ['current-owner'],
      );
      if (binding === null || binding.owner_id !== ownerId) {
        throw new InvalidTaskMutationError(
          'Task data must be bound to its owner before daily rollover',
        );
      }

      const previousDate = normalizeTaskCalendarDate(
        binding.planning_date,
        'Prior planning date',
      );
      if (previousDate === null) {
        await transaction.execute(
          'UPDATE tasks_owner_binding SET planning_date = ? WHERE id = ? AND owner_id = ?',
          [reachedDate, 'current-owner', ownerId],
        );
        return [];
      }
      if (previousDate >= reachedDate) {
        return [];
      }

      const candidates = await transaction.getAll<TaskTodo>(
        `SELECT * FROM tasks_todos
         WHERE owner_id = ?
           AND destination = 'anytime'
           AND lifecycle = 'open'
           AND disposition = 'present'
           AND start_date IS NULL
           AND today_section IS NOT NULL
           AND today_section <> 'inbox'
         ORDER BY order_key, id`,
        [ownerId],
      );
      const occurredAt = this.now();
      const rolledOver: TaskTodo[] = [];
      for (const current of candidates) {
        const lastChangedDate = taskCalendarDateInTimeZone(
          planningTimeZone,
          new Date(current.updated_at),
        );
        if (lastChangedDate >= reachedDate) {
          continue;
        }
        rolledOver.push(await updateOwnedTask(
          transaction,
          current,
          { today_section: 'inbox' },
          this.createId(),
          occurredAt,
          { channel: 'native', actorType: 'system' },
        ));
      }

      await transaction.execute(
        'UPDATE tasks_owner_binding SET planning_date = ? WHERE id = ? AND owner_id = ?',
        [reachedDate, 'current-owner', ownerId],
      );
      return rolledOver;
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
    const startDate = normalizeTaskCalendarDate(input.startDate, "Start") ?? null;
    const todaySection = input.destination === 'someday'
      ? null
      : startDate
        ? null
        : input.todaySection ?? null;
    assertPlanningPlacement(input.destination, todaySection, startDate);

    return this.writePlanningTransaction(async (transaction) => {
      const occurredAt = this.now();
      await assertFutureStartDate(transaction, ownerId, startDate, occurredAt);
      const current = await getOwnedTask(transaction, ownerId, taskId);
      const destinationChanged = current.destination !== input.destination;
      const lastTask = destinationChanged
        ? await transaction.getOptional<{ order_key: string }>(
            `SELECT order_key
             FROM tasks_todos
             WHERE owner_id = ?
               AND destination = ?
               AND lifecycle = 'open'
               AND disposition = 'present'
             ORDER BY order_key DESC, id DESC
             LIMIT 1`,
            [ownerId, input.destination],
          )
        : null;
      return updateOwnedTask(
        transaction,
        current,
        {
          destination: input.destination,
          today_section: todaySection,
          start_date: startDate,
          ...(destinationChanged ? {
            order_key: generateTaskOrderKey(lastTask?.order_key ?? null, null),
          } : {}),
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
    const startDate = normalizeTaskCalendarDate(input.startDate, "Start") ?? null;
    const todaySection = input.destination === 'someday'
      ? null
      : startDate
        ? null
        : input.todaySection ?? null;
    assertPlanningPlacement(input.destination, todaySection, startDate);

    return this.writePlanningTransaction(async (transaction) => {
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

      const destinationChanges = currentTasks.some(
        (current) => current.destination !== input.destination,
      );
      const lastTask = destinationChanges
        ? await transaction.getOptional<{ order_key: string }>(
            `SELECT order_key
             FROM tasks_todos
             WHERE owner_id = ?
               AND destination = ?
               AND lifecycle = 'open'
               AND disposition = 'present'
             ORDER BY order_key DESC, id DESC
             LIMIT 1`,
            [ownerId, input.destination],
          )
        : null;
      const mutationContext = normalizeMutationContext(context);
      let previousOrderKey = lastTask?.order_key ?? null;
      const movedTasks: TaskTodo[] = [];

      for (const current of currentTasks) {
        const destinationChanged = current.destination !== input.destination;
        const orderKey = destinationChanged
          ? generateTaskOrderKey(previousOrderKey, null)
          : current.order_key;
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
        if (destinationChanged) previousOrderKey = orderKey;
      }

      return movedTasks;
    });
  }

  async applyTaskPatches(
    ownerId: string,
    inputs: readonly TaskBulkPatchInput[],
    context?: TaskMutationContext,
  ): Promise<TaskTodo[]> {
    assertOwner(ownerId);
    const uniqueInputs = [...new Map(inputs.map((input) => [input.taskId, input])).values()];
    if (uniqueInputs.length === 0) {
      throw new InvalidTaskMutationError('Select at least one task to move');
    }
    return this.database.writeTransaction(async (transaction) => {
      const occurredAt = this.now();
      const operationId = context?.operationId ?? this.createId();
      const mutationContext = normalizeMutationContext({ ...context, operationId });
      const prepared: Array<{ current: TaskTodo; patch: EditableTaskPatch }> = [];

      for (const input of uniqueInputs) {
        const current = await getOwnedTask(transaction, ownerId, input.taskId);
        const patch = normalizeEditablePatch(input.patch);
        const isOpenPresent = current.lifecycle === 'open'
          && current.disposition === 'present';
        const isTerminal = current.disposition === 'deleted'
          || current.lifecycle !== 'open';
        const isTerminalOrganizationPatch = Object.keys(patch).every(
          (key) => key === 'area_id' || key === 'actionability',
        );
        if (!isOpenPresent && !(isTerminal && isTerminalOrganizationPatch)) {
          throw new InvalidTaskMutationError(
            'Terminal bulk edits apply only to Area and Actionability',
          );
        }
        const destination = patch.destination ?? current.destination;
        const todaySection = patch.today_section === undefined
          ? current.today_section
          : patch.today_section;
        const startDate = patch.start_date === undefined ? current.start_date : patch.start_date;
        assertPlanningPlacement(destination, todaySection, startDate);
        if (patch.start_date !== undefined) {
          await assertFutureStartDate(transaction, ownerId, patch.start_date, occurredAt);
        }
        const areaId = patch.area_id === undefined ? current.area_id : patch.area_id;
        if (patch.area_id !== undefined) {
          await assertOwnedTaskArea(transaction, ownerId, areaId);
        }
        prepared.push({ current, patch });
      }

      const results: TaskTodo[] = [];
      for (const { current, patch } of prepared) {
        results.push(await updateOwnedTask(
          transaction,
          current,
          patch,
          this.createId(),
          occurredAt,
          mutationContext,
        ));
      }
      return results;
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

    return this.database.writeTransaction(async (transaction) => {
      const current = await getOwnedTask(transaction, ownerId, taskId);
      await assertOwnedTaskArea(transaction, ownerId, areaId);
      const hierarchyOrderKey = input.hierarchyOrderKey !== undefined
        ? input.hierarchyOrderKey
        : await nextHierarchyOrderKey(
          transaction,
          ownerId,
          areaId,
          taskId,
        );
      return updateOwnedTask(
        transaction,
        current,
        {
          area_id: areaId,
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
    return (await this.applyHistoryOperation(ownerId, [eventId], 'undo', context))[0];
  }

  async redoTask(
    ownerId: string,
    eventId: string,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    return (await this.applyHistoryOperation(ownerId, [eventId], 'redo', context))[0];
  }

  async undoTaskOperation(
    ownerId: string,
    eventIds: readonly string[],
    context?: TaskMutationContext,
  ): Promise<TaskTodo[]> {
    return this.applyHistoryOperation(ownerId, eventIds, 'undo', context);
  }

  async redoTaskOperation(
    ownerId: string,
    eventIds: readonly string[],
    context?: TaskMutationContext,
  ): Promise<TaskTodo[]> {
    return this.applyHistoryOperation(ownerId, eventIds, 'redo', context);
  }

  private async applyHistoryOperation(
    ownerId: string,
    eventIds: readonly string[],
    direction: 'undo' | 'redo',
    context?: TaskMutationContext,
  ): Promise<TaskTodo[]> {
    assertOwner(ownerId);
    if (eventIds.length === 0) {
      throw new TaskHistoryEventNotFoundError();
    }
    return this.database.writeTransaction(async (transaction) => {
      const occurredAt = this.now();
      const operationId = context?.operationId
        ?? (eventIds.length > 1 ? this.createId() : undefined);
      const prepared: Array<{
        event: ReturnType<typeof parseTaskHistoryEvent>;
        current: TaskTodo;
        patch: TaskHistorySnapshot;
      }> = [];
      for (const eventId of [...new Set(eventIds)]) {
        const storedEvent = await transaction.getOptional<TaskHistoryStorageRow>(
          'SELECT * FROM tasks_history_events WHERE id = ? AND owner_id = ?',
          [eventId, ownerId],
        );
        if (storedEvent === null) throw new TaskHistoryEventNotFoundError();
        const event = parseTaskHistoryEvent(storedEvent);
        const current = await getOwnedTask(transaction, ownerId, event.task_id);
        const patch = direction === 'undo'
          ? createTaskUndoPatch(current, event, occurredAt)
          : createTaskRedoPatch(current, event);
        try {
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
        } catch (error) {
          if (error instanceof InvalidTaskMutationError) {
            throw direction === 'undo'
              ? new UnsafeTaskUndoError('There are no more task changes to undo')
              : new UnsafeTaskRedoError('There are no more task changes to redo');
          }
          throw error;
        }
        await assertOwnedTaskArea(
          transaction,
          ownerId,
          patch.area_id,
        );
        prepared.push({ event, current, patch });
      }
      const results: TaskTodo[] = [];
      for (const { event, current, patch } of prepared) {
        const mutationId = this.createId();
        results.push(await updateOwnedTask(
          transaction,
          current,
          patch,
          mutationId,
          occurredAt,
          normalizeMutationContext({
            ...context,
            operationId: operationId ?? mutationId,
          }),
          event.id,
        ));
      }
      return results;
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
      if (patch.destination === 'someday') {
        patch.start_date = null;
        patch.today_section = null;
      } else if (patch.start_date) {
        patch.today_section = null;
      } else if (patch.today_section) {
        patch.start_date = null;
      } else if (
        patch.start_date === undefined
        && patch.today_section === undefined
        && current.start_date !== null
        && current.today_section !== null
      ) {
        patch.today_section = null;
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
      const containerChanged = patch.area_id !== undefined;
      if (containerChanged) {
        await assertOwnedTaskArea(transaction, ownerId, areaId);
      }

      const preparedPatch = containerChanged && patch.hierarchy_order_key === undefined
        ? {
          ...patch,
          hierarchy_order_key: await nextHierarchyOrderKey(
            transaction,
            ownerId,
            areaId,
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
  context: NormalizedTaskMutationContext,
  undoSourceEventId: string | null = null,
): Promise<TaskTodo> {
  const metadataPatch = {
    last_mutation_channel: context.channel,
    last_actor_type: context.actorType,
    last_operation_id: context.operationId ?? mutationId,
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
): NormalizedTaskMutationContext {
  return {
    channel: context?.channel ?? 'web',
    actorType: context?.actorType ?? 'user',
    ...(context?.operationId ? { operationId: context.operationId } : {}),
  };
}

function normalizeEditablePatch(patch: EditableTaskPatch): EditableTaskPatch {
  const normalized = { ...patch };
  if (patch.title !== undefined) {
    normalized.title = normalizeTitle(patch.title);
  }
  if (patch.start_date !== undefined) {
    normalized.start_date = normalizeTaskCalendarDate(patch.start_date, "Start") ?? null;
  }
  if (patch.deadline !== undefined) {
    normalized.deadline = normalizeTaskCalendarDate(patch.deadline, 'Deadline') ?? null;
  }
  if (patch.primary_link !== undefined) {
    normalized.primary_link = normalizeTaskPrimaryLink(patch.primary_link);
    if ((normalized.primary_link?.length ?? 0) > 8000) {
      throw new InvalidTaskMutationError('A Link cannot exceed 8,000 characters');
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
  if (Array.from(normalized).length > 500) {
    throw new InvalidTaskMutationError('A task summary cannot exceed 500 characters');
  }
  return normalized;
}

async function assertOwnedTaskArea(
  transaction: Transaction,
  ownerId: string,
  areaId: string | null | undefined,
): Promise<void> {
  if (areaId != null) {
    const area = await transaction.getOptional<{ id: string }>(
      'SELECT id FROM tasks_areas WHERE id = ? AND owner_id = ?',
      [areaId, ownerId],
    );
    if (area === null) throw new InvalidTaskMutationError('The task area is unavailable');
  }
}

async function nextHierarchyOrderKey(
  transaction: Transaction,
  ownerId: string,
  areaId: string | null,
  excludeTaskId?: string,
): Promise<string | null> {
  if (areaId === null) return null;
  const excludedTaskClause = excludeTaskId ? 'AND id <> ?' : '';
  const lastTask = await transaction.getOptional<{ hierarchy_order_key: string }>(
    `SELECT hierarchy_order_key
     FROM tasks_todos
     WHERE owner_id = ?
       AND area_id IS ?
       AND lifecycle = 'open'
       AND disposition = 'present'
       AND hierarchy_order_key IS NOT NULL
       ${excludedTaskClause}
     ORDER BY hierarchy_order_key DESC, id DESC
     LIMIT 1`,
    [ownerId, areaId, ...(excludeTaskId ? [excludeTaskId] : [])],
  );
  return generateTaskOrderKey(lastTask?.hierarchy_order_key ?? null, null);
}

function assertOwner(ownerId: string): void {
  if (!ownerId) {
    throw new InvalidTaskMutationError('A signed-in task owner is required');
  }
}

function isTransientOpfsAccessHandleConflict(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current != null; depth += 1) {
    const message = current instanceof Error
      ? `${current.name}: ${current.message}`
      : typeof current === 'object' && 'message' in current
        ? String(current.message)
        : String(current);
    if (
      message.includes('createSyncAccessHandle')
      && message.includes('another open Access Handle or Writable stream')
    ) {
      return true;
    }
    current = typeof current === 'object' && 'cause' in current
      ? current.cause
      : null;
  }
  return false;
}

function waitForRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
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
  if (startDate !== null && todaySection !== null) {
    throw new InvalidTaskMutationError('A future Start cannot retain a Today horizon');
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
    throw new InvalidTaskMutationError("Start must be after Today");
  }
}

function createUuid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new InvalidTaskMutationError('Secure task identifiers are unavailable');
  }
  return globalThis.crypto.randomUUID();
}

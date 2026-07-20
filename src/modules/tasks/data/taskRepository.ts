import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import { TaskHierarchyOperationsRepository } from '@/modules/tasks/data/taskHierarchyOperationsRepository';
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
  entryChannel?: TaskEntryChannel;
  sourceKind?: TaskSourceKind | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceExternalId?: string | null;
  actorType?: TaskActorType;
  actionability?: TaskActionability;
  areaId?: string | null;
  projectId?: string | null;
  headingId?: string | null;
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
  headingId?: string | null;
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
    | 'heading_id'
    | 'hierarchy_order_key'
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
  'actionability',
  'area_id',
  'project_id',
  'heading_id',
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
    const startDate = normalizeTaskCalendarDate(input.startDate, 'Start date') ?? null;
    const deadline = normalizeTaskCalendarDate(input.deadline, 'Deadline') ?? null;
    assertTaskCalendarRange(startDate, deadline);
    assertTaskContainer(
      input.areaId ?? null,
      input.projectId ?? null,
      input.headingId ?? null,
    );

    return this.database.writeTransaction(async (transaction) => {
      const destination = input.destination ?? 'inbox';
      const todaySection = input.todaySection ?? 'daytime';
      assertPlanningPlacement(destination, todaySection, startDate);
      await assertOwnedTaskContainer(
        transaction,
        input.ownerId,
        input.areaId ?? null,
        input.projectId ?? null,
        input.headingId ?? null,
      );
      const lastTask = input.orderKey
        ? null
        : await transaction.getOptional<{ order_key: string }>(
            `SELECT order_key
             FROM tasks_todos
             WHERE owner_id = ?
               AND destination = ?
               AND today_section = ?
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
          input.headingId ?? null,
        );
      const timestamp = this.now();
      const entryChannel = input.entryChannel ?? 'web';
      const task: TaskTodo = {
        id: this.createId(),
        owner_id: input.ownerId,
        actionability: input.actionability ?? 'actionable',
        area_id: input.areaId ?? null,
        project_id: input.projectId ?? null,
        heading_id: input.headingId ?? null,
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

  async moveTask(
    ownerId: string,
    taskId: string,
    input: TaskPlanningMoveInput,
    context?: TaskMutationContext,
  ): Promise<TaskTodo> {
    assertOwner(ownerId);
    const todaySection = input.todaySection ?? 'daytime';
    const startDate = normalizeTaskCalendarDate(input.startDate, 'Start date') ?? null;
    assertPlanningPlacement(input.destination, todaySection, startDate);

    return this.database.writeTransaction(async (transaction) => {
      const current = await getOwnedTask(transaction, ownerId, taskId);
      assertTaskCalendarRange(startDate, current.deadline);
      const lastTask = await transaction.getOptional<{ order_key: string }>(
        `SELECT order_key
         FROM tasks_todos
         WHERE owner_id = ?
           AND destination = ?
           AND today_section = ?
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
        this.now(),
        normalizeMutationContext(context),
      );
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
    const headingId = input.headingId ?? null;
    assertTaskContainer(areaId, projectId, headingId);

    return this.database.writeTransaction(async (transaction) => {
      const current = await getOwnedTask(transaction, ownerId, taskId);
      await assertOwnedTaskContainer(
        transaction,
        ownerId,
        areaId,
        projectId,
        headingId,
      );
      const hierarchyOrderKey = input.hierarchyOrderKey !== undefined
        ? input.hierarchyOrderKey
        : await nextHierarchyOrderKey(
          transaction,
          ownerId,
          areaId,
          projectId,
          headingId,
          taskId,
        );
      return updateOwnedTask(
        transaction,
        current,
        {
          area_id: areaId,
          project_id: projectId,
          heading_id: headingId,
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
      assertPlanningPlacement(
        patch.destination === undefined ? current.destination : patch.destination,
        patch.today_section === undefined ? current.today_section : patch.today_section,
        patch.start_date === undefined ? current.start_date : patch.start_date,
      );
      assertTaskContainer(
        patch.area_id === undefined ? current.area_id : patch.area_id,
        patch.project_id === undefined ? current.project_id : patch.project_id,
        patch.heading_id === undefined ? current.heading_id : patch.heading_id,
      );
      await assertOwnedTaskContainer(
        transaction,
        ownerId,
        patch.area_id,
        patch.project_id,
        patch.heading_id,
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
      assertTaskCalendarRange(
        patch.start_date === undefined ? current.start_date : patch.start_date,
        patch.deadline === undefined ? current.deadline : patch.deadline,
      );
      assertPlanningPlacement(
        patch.destination === undefined ? current.destination : patch.destination,
        patch.today_section === undefined ? current.today_section : patch.today_section,
        patch.start_date === undefined ? current.start_date : patch.start_date,
      );
      const areaId = patch.area_id === undefined ? current.area_id : patch.area_id;
      const projectId = patch.project_id === undefined ? current.project_id : patch.project_id;
      const headingId = patch.heading_id === undefined ? current.heading_id : patch.heading_id;
      assertTaskContainer(areaId, projectId, headingId);
      const containerChanged = (
        patch.area_id !== undefined
        || patch.project_id !== undefined
        || patch.heading_id !== undefined
      );
      if (containerChanged) {
        await assertOwnedTaskContainer(
          transaction,
          ownerId,
          areaId,
          projectId,
          headingId,
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
            headingId,
            taskId,
          ),
        }
        : patch;

      return updateOwnedTask(
        transaction,
        current,
        preparedPatch,
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
  if (
    patch.actionability !== undefined
    && patch.actionability !== 'actionable'
    && patch.actionability !== 'waiting'
  ) {
    throw new InvalidTaskMutationError('Task actionability must be actionable or waiting');
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
  headingId: string | null,
): void {
  if (areaId != null && projectId != null) {
    throw new InvalidTaskMutationError(
      'A task cannot belong directly to both an area and a project',
    );
  }
  if (headingId != null && projectId == null) {
    throw new InvalidTaskMutationError('A task heading requires project membership');
  }
}

async function assertOwnedTaskContainer(
  transaction: Transaction,
  ownerId: string,
  areaId: string | null | undefined,
  projectId: string | null | undefined,
  headingId: string | null | undefined,
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
  if (headingId != null) {
    const heading = await transaction.getOptional<{ project_id: string }>(
      'SELECT project_id FROM tasks_headings WHERE id = ? AND owner_id = ?',
      [headingId, ownerId],
    );
    if (heading === null || heading.project_id !== projectId) {
      throw new InvalidTaskMutationError(
        'The task heading does not belong to the selected project',
      );
    }
  }
}

async function nextHierarchyOrderKey(
  transaction: Transaction,
  ownerId: string,
  areaId: string | null,
  projectId: string | null,
  headingId: string | null,
  excludeTaskId?: string,
): Promise<string | null> {
  if (areaId === null && projectId === null && headingId === null) return null;
  const excludedTaskClause = excludeTaskId ? 'AND id <> ?' : '';
  const lastTask = await transaction.getOptional<{ hierarchy_order_key: string }>(
    `SELECT hierarchy_order_key
     FROM tasks_todos
     WHERE owner_id = ?
       AND area_id IS ?
       AND project_id IS ?
       AND heading_id IS ?
       AND lifecycle = 'open'
       AND disposition = 'present'
       AND hierarchy_order_key IS NOT NULL
       ${excludedTaskClause}
     ORDER BY hierarchy_order_key DESC, id DESC
     LIMIT 1`,
    [ownerId, areaId, projectId, headingId, ...(excludeTaskId ? [excludeTaskId] : [])],
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
  todaySection: TaskTodaySection,
  startDate: string | null,
): void {
  if (todaySection === 'evening' && destination !== 'today') {
    throw new InvalidTaskMutationError('This Evening is available only within Today');
  }
  if ((destination === 'inbox' || destination === 'someday') && startDate !== null) {
    const label = destination === 'inbox' ? 'Inbox' : 'Someday';
    throw new InvalidTaskMutationError(`${label} work cannot retain a start date`);
  }
}

function createUuid(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new InvalidTaskMutationError('Secure task identifiers are unavailable');
  }
  return globalThis.crypto.randomUUID();
}

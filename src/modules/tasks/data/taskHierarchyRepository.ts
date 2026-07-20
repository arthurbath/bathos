import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import {
  InvalidTaskMutationError,
  type TaskMutationContext,
} from '@/modules/tasks/data/taskRepository';
import type {
  TaskArea,
  TaskChecklistItem,
  TaskEntryChannel,
  TaskHeading,
  TaskProject,
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
};

export type CreateTaskAreaInput = CreateHierarchyInput;

export type CreateTaskProjectInput = CreateHierarchyInput & {
  areaId?: string | null;
  notes?: string;
  planningOrderKey?: string;
};

export type CreateTaskHeadingInput = CreateHierarchyInput & {
  projectId: string;
};

export type CreateTaskChecklistItemInput = CreateHierarchyInput & {
  taskId: string;
};

export type TaskAreaPatch = Partial<Pick<TaskArea, 'title' | 'order_key'>>;

export type TaskProjectPatch = Partial<
  Pick<
    TaskProject,
    | 'area_id'
    | 'title'
    | 'notes'
    | 'destination'
    | 'today_section'
    | 'order_key'
    | 'planning_order_key'
    | 'start_date'
    | 'deadline'
  >
>;

export type TaskHeadingPatch = Partial<Pick<TaskHeading, 'title' | 'order_key'>>;

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

  async createProject(input: CreateTaskProjectInput): Promise<TaskProject> {
    return this.database.writeTransaction(async (transaction) => {
      const areaId = input.areaId ?? null;
      if (areaId !== null) {
        await assertOwnedParent(transaction, 'tasks_areas', input.ownerId, areaId, 'area');
      }
      const metadata = this.createMetadata(input);
      const project: TaskProject = {
        ...metadata,
        area_id: areaId,
        title: normalizeTitle(input.title),
        notes: input.notes ?? '',
        lifecycle: 'open',
        completed_at: null,
        canceled_at: null,
        disposition: 'present',
        deleted_at: null,
        deletion_root_id: null,
        destination: 'anytime',
        today_section: 'daytime',
        order_key: input.orderKey ?? await nextOrderKey(
          transaction,
          'tasks_projects',
          input.ownerId,
          [['area_id', areaId]],
        ),
        planning_order_key: input.planningOrderKey ?? await nextPlanningOrderKey(
          transaction,
          input.ownerId,
        ),
        start_date: null,
        deadline: null,
        template_definition_id: null,
        template_revision: null,
        template_instantiation_id: null,
        template_node_id: null,
        recurrence_definition_id: null,
        recurrence_revision: null,
        recurrence_occurrence_id: null,
        recurrence_logical_key: null,
      };
      await insertRow(transaction, 'tasks_projects', project);
      return project;
    });
  }

  async createHeading(input: CreateTaskHeadingInput): Promise<TaskHeading> {
    requireId(input.projectId, 'A project is required for a heading');
    return this.database.writeTransaction(async (transaction) => {
      await assertOwnedParent(
        transaction,
        'tasks_projects',
        input.ownerId,
        input.projectId,
        'project',
      );
      const metadata = this.createMetadata(input);
      const heading: TaskHeading = {
        ...metadata,
        project_id: input.projectId,
        title: normalizeTitle(input.title),
        order_key: input.orderKey ?? await nextOrderKey(
          transaction,
          'tasks_headings',
          input.ownerId,
          [['project_id', input.projectId]],
        ),
        disposition: 'present',
        deleted_at: null,
        deletion_root_id: null,
        template_definition_id: null,
        template_revision: null,
        template_instantiation_id: null,
        template_node_id: null,
      };
      await insertRow(transaction, 'tasks_headings', heading);
      return heading;
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
        template_definition_id: null,
        template_revision: null,
        template_instantiation_id: null,
        template_node_id: null,
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

  updateProject(
    ownerId: string,
    projectId: string,
    patch: TaskProjectPatch,
    context?: TaskMutationContext,
  ): Promise<TaskProject> {
    const normalized = normalizePatch(patch);
    if (normalized.title !== undefined) normalized.title = normalizeTitle(normalized.title);
    return this.updateRow<TaskProject>(
      'tasks_projects',
      'project',
      ownerId,
      projectId,
      normalized,
      context,
      async (next, transaction) => {
        if (next.area_id !== null) {
          await assertOwnedParent(
            transaction,
            'tasks_areas',
            ownerId,
            next.area_id,
            'area',
          );
        }
        assertProjectPlanning(next);
      },
    );
  }

  updateHeading(
    ownerId: string,
    headingId: string,
    patch: TaskHeadingPatch,
    context?: TaskMutationContext,
  ): Promise<TaskHeading> {
    const normalized = normalizePatch(patch);
    if (normalized.title !== undefined) normalized.title = normalizeTitle(normalized.title);
    return this.updateRow<TaskHeading>(
      'tasks_headings', 'heading', ownerId, headingId, normalized, context,
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

  private createMetadata(input: CreateHierarchyInput) {
    assertOwner(input.ownerId);
    const timestamp = this.now();
    const entryChannel = input.entryChannel ?? 'web';
    return {
      id: this.createId(),
      owner_id: input.ownerId,
      entry_channel: entryChannel,
      last_mutation_channel: entryChannel,
      last_actor_type: input.actorType ?? 'user' as const,
      revision: 1,
      client_mutation_id: this.createId(),
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
      const next = {
        ...current,
        ...patch,
        last_mutation_channel: mutationContext.channel,
        last_actor_type: mutationContext.actorType,
        revision: current.revision + 1,
        client_mutation_id: this.createId(),
        updated_at: this.now(),
      } as T;
      await validate?.(next, transaction);
      const columns = [
        ...Object.keys(patch),
        'last_mutation_channel',
        'last_actor_type',
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

type HierarchyRow = TaskArea | TaskProject | TaskHeading | TaskChecklistItem;
type HierarchyTable =
  | 'tasks_areas'
  | 'tasks_projects'
  | 'tasks_headings'
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

type HierarchyParentTable = 'tasks_areas' | 'tasks_projects' | 'tasks_todos';

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

async function nextPlanningOrderKey(
  transaction: Transaction,
  ownerId: string,
): Promise<string> {
  const last = await transaction.getOptional<{ planning_order_key: string }>(
    `SELECT planning_order_key FROM tasks_projects
     WHERE owner_id = ? AND destination = 'anytime'
       AND lifecycle = 'open' AND disposition = 'present'
     ORDER BY planning_order_key DESC, id DESC LIMIT 1`,
    [ownerId],
  );
  return generateTaskOrderKey(last?.planning_order_key ?? null, null);
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

function assertProjectPlanning(patch: TaskProjectPatch): void {
  if (patch.today_section === 'evening' && patch.destination !== 'today') {
    throw new InvalidTaskMutationError('Evening projects must be in Today');
  }
  if (
    patch.destination === 'someday'
    && patch.start_date !== undefined
    && patch.start_date !== null
  ) {
    throw new InvalidTaskMutationError('Someday projects cannot have a start date');
  }
  if (
    patch.start_date != null
    && patch.deadline != null
    && patch.deadline < patch.start_date
  ) {
    throw new InvalidTaskMutationError('A project deadline cannot precede its start date');
  }
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
  };
}

function createUuid(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new InvalidTaskMutationError('Secure UUID generation is unavailable');
  }
  return crypto.randomUUID();
}

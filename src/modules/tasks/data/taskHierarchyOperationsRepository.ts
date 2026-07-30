import type { AbstractPowerSyncDatabase, Transaction } from '@powersync/web';

import type { TaskMutationContext } from '@/modules/tasks/data/taskRepository';
import type {
  TaskHierarchyDescendantPolicy,
  TaskHierarchyOperationKind,
  TaskHierarchyRootType,
} from '@/modules/tasks/types/tasks';

type HierarchyOperationsDatabase = Pick<AbstractPowerSyncDatabase, 'writeTransaction'>;

type Candidate = {
  entity_type: TaskHierarchyRootType;
  id: string;
  revision: number;
};

export type TaskHierarchyOperationRequest = {
  ownerId: string;
  rootType: TaskHierarchyRootType;
  rootId: string;
  operation: TaskHierarchyOperationKind;
  descendantPolicy?: TaskHierarchyDescendantPolicy;
  context?: TaskMutationContext;
};

export type TaskHierarchyOperationResult = {
  id: string;
  affectedIds: string[];
};

export class TaskHierarchyOperationRejectedError extends Error {
  constructor(readonly code: 'root_not_found' | 'parent_not_present') {
    super(code === 'parent_not_present'
        ? 'Restore the parent container before restoring this item.'
        : 'The selected task hierarchy is unavailable.');
    this.name = 'TaskHierarchyOperationRejectedError';
  }
}

export class TaskHierarchyOperationsRepository {
  private readonly createId: () => string;
  private readonly now: () => string;

  constructor(
    private readonly database: HierarchyOperationsDatabase,
    options: { createId?: () => string; now?: () => string } = {},
  ) {
    this.createId = options.createId ?? createUuid;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  request(input: TaskHierarchyOperationRequest): Promise<TaskHierarchyOperationResult> {
    assertRequest(input);
    return this.database.writeTransaction(async (transaction) => {
      const policy = input.descendantPolicy ?? 'reject';
      const candidates = await getCandidates(transaction, input, policy);
      if (!candidates.some((candidate) => candidate.id === input.rootId)) {
        throw new TaskHierarchyOperationRejectedError('root_not_found');
      }
      await assertRestorableStructuralRoot(transaction, input);

      const requestedAt = input.context?.occurredAt ?? this.now();
      const operationId = this.createId();
      const context = {
        channel: input.context?.channel ?? 'web',
        actorType: input.context?.actorType ?? 'user',
        operationId: input.context?.operationId ?? operationId,
      };
      const expectedRevisions = Object.fromEntries(
        candidates.map((candidate) => [candidate.id, candidate.revision]),
      );

      await applyOptimisticOperation(
        transaction,
        input,
        policy,
        candidates,
        requestedAt,
        context,
        this.createId,
      );
      await transaction.execute(
        `INSERT INTO tasks_hierarchy_operations (
          id, owner_id, root_type, root_id, operation, descendant_policy,
          expected_revisions, actor_type, mutation_channel, requested_at,
          outcome, code, affected_ids, result_revisions, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, '{}', NULL)`,
        [
          operationId,
          input.ownerId,
          input.rootType,
          input.rootId,
          input.operation,
          policy,
          JSON.stringify(expectedRevisions),
          context.actorType,
          context.channel,
          requestedAt,
          JSON.stringify([]),
        ],
      );
      return { id: operationId, affectedIds: candidates.map(({ id }) => id) };
    });
  }
}

async function getCandidates(
  transaction: Transaction,
  input: TaskHierarchyOperationRequest,
  policy: TaskHierarchyDescendantPolicy,
): Promise<Candidate[]> {
  if (input.operation === 'restore') {
    return transaction.getAll<Candidate>(
      `SELECT 'area' AS entity_type, id, revision FROM tasks_areas
       WHERE owner_id = ? AND deletion_root_id = ?
       UNION ALL SELECT 'todo', id, revision FROM tasks_todos
       WHERE owner_id = ? AND deletion_root_id = ?
       UNION ALL SELECT 'checklist_item', id, revision FROM tasks_checklist_items
       WHERE owner_id = ? AND deletion_root_id = ?`,
      [
        input.ownerId, input.rootId,
        input.ownerId, input.rootId, input.ownerId, input.rootId,
      ],
    );
  }

  return getDeleteCandidates(transaction, input.ownerId, input.rootType, input.rootId);
}

async function getDeleteCandidates(
  transaction: Transaction,
  ownerId: string,
  rootType: TaskHierarchyRootType,
  rootId: string,
): Promise<Candidate[]> {
  if (rootType === 'area') {
    return transaction.getAll<Candidate>(
      `SELECT 'area' AS entity_type, id, revision FROM tasks_areas
       WHERE owner_id = ? AND id = ? AND disposition = 'present'
       UNION ALL SELECT 'todo', task.id, task.revision
       FROM tasks_todos AS task
       WHERE task.owner_id = ? AND task.area_id = ?
         AND task.disposition = 'present'
       UNION ALL SELECT 'checklist_item', item.id, item.revision
       FROM tasks_checklist_items AS item JOIN tasks_todos AS task
         ON task.id = item.task_id AND task.owner_id = item.owner_id
       WHERE item.owner_id = ? AND task.area_id = ?
         AND item.disposition = 'present' AND task.disposition = 'present'`,
      [
        ownerId, rootId, ownerId, rootId, ownerId, rootId,
      ],
    );
  }
  if (rootType === 'todo') {
    return transaction.getAll<Candidate>(
      `SELECT 'todo' AS entity_type, id, revision FROM tasks_todos
       WHERE owner_id = ? AND id = ? AND disposition = 'present'
       UNION ALL SELECT 'checklist_item', id, revision FROM tasks_checklist_items
       WHERE owner_id = ? AND task_id = ? AND disposition = 'present'`,
      [ownerId, rootId, ownerId, rootId],
    );
  }
  return transaction.getAll<Candidate>(
    `SELECT 'checklist_item' AS entity_type, id, revision FROM tasks_checklist_items
     WHERE owner_id = ? AND id = ? AND disposition = 'present'`,
    [ownerId, rootId],
  );
}

async function applyOptimisticOperation(
  transaction: Transaction,
  input: TaskHierarchyOperationRequest,
  policy: TaskHierarchyDescendantPolicy,
  candidates: Candidate[],
  occurredAt: string,
  context: TaskOperationContext,
  createId: () => string,
): Promise<void> {
  if (input.operation === 'delete') {
    for (const candidate of candidates) {
      await transaction.execute(
        `UPDATE ${tableFor(candidate.entity_type)}
         SET disposition = 'deleted', deleted_at = ?, deletion_root_id = ?,
           revision = revision + 1, client_mutation_id = ?,
           last_mutation_channel = ?, last_actor_type = ?,
           last_operation_id = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          occurredAt, input.rootId, createId(), context.channel, context.actorType,
          context.operationId, occurredAt, candidate.id, input.ownerId,
        ],
      );
    }
    return;
  }

  await restoreOptimistically(transaction, input, candidates, occurredAt, context, createId);
}

async function restoreOptimistically(
  transaction: Transaction,
  input: TaskHierarchyOperationRequest,
  candidates: Candidate[],
  occurredAt: string,
  context: TaskOperationContext,
  createId: () => string,
): Promise<void> {
  const orderedTypes: TaskHierarchyRootType[] = [
    'area', 'todo', 'checklist_item',
  ];
  for (const entityType of orderedTypes) {
    for (const candidate of candidates.filter(({ entity_type }) => entity_type === entityType)) {
      const patch = await restorationPatch(transaction, input.ownerId, entityType, candidate.id);
      const columns = Object.keys(patch);
      const restorationColumns = columns.length === 0
        ? ''
        : `${columns.map((column) => `${column} = ?`).join(', ')},`;
      await transaction.execute(
        `UPDATE ${tableFor(entityType)} SET
          ${restorationColumns}
          disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
          revision = revision + 1, client_mutation_id = ?,
          last_mutation_channel = ?, last_actor_type = ?,
          last_operation_id = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          ...columns.map((column) => patch[column]),
          createId(), context.channel, context.actorType, context.operationId,
          occurredAt, candidate.id, input.ownerId,
        ],
      );
    }
  }
}

async function restorationPatch(
  transaction: Transaction,
  ownerId: string,
  entityType: TaskHierarchyRootType,
  id: string,
): Promise<Record<string, string | null>> {
  if (entityType === 'todo') {
    const task = await transaction.get<{ area_id: string | null }>(
      'SELECT area_id FROM tasks_todos WHERE id = ? AND owner_id = ?',
      [id, ownerId],
    );
    const areaPresent = task.area_id === null
      || await isPresent(transaction, 'tasks_areas', ownerId, task.area_id);
    if (areaPresent) {
      return {};
    }
    return {
      area_id: null,
      destination: 'anytime',
      today_section: null,
      start_date: null,
    };
  }
  return {};
}

async function assertRestorableStructuralRoot(
  transaction: Transaction,
  input: TaskHierarchyOperationRequest,
): Promise<void> {
  if (input.operation !== 'restore') return;
  if (input.rootType === 'checklist_item') {
    const item = await transaction.get<{ task_id: string }>(
      'SELECT task_id FROM tasks_checklist_items WHERE id = ? AND owner_id = ?',
      [input.rootId, input.ownerId],
    );
    if (!await isPresent(transaction, 'tasks_todos', input.ownerId, item.task_id)) {
      throw new TaskHierarchyOperationRejectedError('parent_not_present');
    }
  }
}

async function isPresent(
  transaction: Transaction,
  table: string,
  ownerId: string,
  id: string,
): Promise<boolean> {
  return await transaction.getOptional<{ id: string }>(
    `SELECT id FROM ${table} WHERE owner_id = ? AND id = ? AND disposition = 'present'`,
    [ownerId, id],
  ) !== null;
}

function tableFor(entityType: TaskHierarchyRootType): string {
  return entityType === 'area' ? 'tasks_areas'
    : entityType === 'todo' ? 'tasks_todos'
      : 'tasks_checklist_items';
}

function assertRequest(input: TaskHierarchyOperationRequest): void {
  if (!input.ownerId.trim() || !input.rootId.trim()) {
    throw new TaskHierarchyOperationRejectedError('root_not_found');
  }
}

type TaskOperationContext = {
  channel: NonNullable<TaskMutationContext['channel']>;
  actorType: NonNullable<TaskMutationContext['actorType']>;
  operationId: string;
};

function createUuid(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure UUID generation is unavailable');
  }
  return crypto.randomUUID();
}

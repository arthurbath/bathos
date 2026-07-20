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
  constructor(readonly code: 'root_not_found' | 'open_descendants' | 'parent_not_present') {
    super(code === 'open_descendants'
      ? 'The project still has open tasks. Choose the explicit cascade action to continue.'
      : code === 'parent_not_present'
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
      if (
        policy === 'reject'
        && (input.operation === 'complete_project' || input.operation === 'cancel_project')
      ) {
        const openDescendant = await transaction.getOptional<{ id: string }>(
          `SELECT id FROM tasks_todos
           WHERE owner_id = ? AND project_id = ?
             AND disposition = 'present' AND lifecycle = 'open'
           LIMIT 1`,
          [input.ownerId, input.rootId],
        );
        if (openDescendant !== null) {
          throw new TaskHierarchyOperationRejectedError('open_descendants');
        }
      }
      await assertRestorableStructuralRoot(transaction, input);

      const requestedAt = this.now();
      const operationId = this.createId();
      const context = {
        channel: input.context?.channel ?? 'web',
        actorType: input.context?.actorType ?? 'user',
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
  if (input.operation === 'complete_project'
    || input.operation === 'cancel_project'
    || input.operation === 'reopen_project') {
    const project = await transaction.getAll<Candidate>(
      `SELECT 'project' AS entity_type, id, revision FROM tasks_projects
       WHERE owner_id = ? AND id = ? AND disposition = 'present'`,
      [input.ownerId, input.rootId],
    );
    if (policy !== 'cascade' || input.operation === 'reopen_project') return project;
    const tasks = await transaction.getAll<Candidate>(
      `SELECT 'todo' AS entity_type, id, revision FROM tasks_todos
       WHERE owner_id = ? AND project_id = ?
         AND disposition = 'present' AND lifecycle = 'open'`,
      [input.ownerId, input.rootId],
    );
    return [...project, ...tasks];
  }

  if (input.operation === 'restore') {
    return transaction.getAll<Candidate>(
      `SELECT 'area' AS entity_type, id, revision FROM tasks_areas
       WHERE owner_id = ? AND deletion_root_id = ?
       UNION ALL SELECT 'project', id, revision FROM tasks_projects
       WHERE owner_id = ? AND deletion_root_id = ?
       UNION ALL SELECT 'heading', id, revision FROM tasks_headings
       WHERE owner_id = ? AND deletion_root_id = ?
       UNION ALL SELECT 'todo', id, revision FROM tasks_todos
       WHERE owner_id = ? AND deletion_root_id = ?
       UNION ALL SELECT 'checklist_item', id, revision FROM tasks_checklist_items
       WHERE owner_id = ? AND deletion_root_id = ?`,
      [
        input.ownerId, input.rootId, input.ownerId, input.rootId,
        input.ownerId, input.rootId, input.ownerId, input.rootId,
        input.ownerId, input.rootId,
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
       UNION ALL SELECT 'project', id, revision FROM tasks_projects
       WHERE owner_id = ? AND area_id = ? AND disposition = 'present'
       UNION ALL SELECT 'heading', heading.id, heading.revision
       FROM tasks_headings AS heading JOIN tasks_projects AS project
         ON project.id = heading.project_id AND project.owner_id = heading.owner_id
       WHERE heading.owner_id = ? AND project.area_id = ? AND heading.disposition = 'present'
       UNION ALL SELECT 'todo', task.id, task.revision
       FROM tasks_todos AS task LEFT JOIN tasks_projects AS project
         ON project.id = task.project_id AND project.owner_id = task.owner_id
       WHERE task.owner_id = ? AND (task.area_id = ? OR project.area_id = ?)
         AND task.disposition = 'present'
       UNION ALL SELECT 'checklist_item', item.id, item.revision
       FROM tasks_checklist_items AS item JOIN tasks_todos AS task
         ON task.id = item.task_id AND task.owner_id = item.owner_id
       LEFT JOIN tasks_projects AS project
         ON project.id = task.project_id AND project.owner_id = task.owner_id
       WHERE item.owner_id = ? AND (task.area_id = ? OR project.area_id = ?)
         AND item.disposition = 'present' AND task.disposition = 'present'`,
      [
        ownerId, rootId, ownerId, rootId, ownerId, rootId,
        ownerId, rootId, rootId, ownerId, rootId, rootId,
      ],
    );
  }
  if (rootType === 'project') {
    return transaction.getAll<Candidate>(
      `SELECT 'project' AS entity_type, id, revision FROM tasks_projects
       WHERE owner_id = ? AND id = ? AND disposition = 'present'
       UNION ALL SELECT 'heading', id, revision FROM tasks_headings
       WHERE owner_id = ? AND project_id = ? AND disposition = 'present'
       UNION ALL SELECT 'todo', id, revision FROM tasks_todos
       WHERE owner_id = ? AND project_id = ? AND disposition = 'present'
       UNION ALL SELECT 'checklist_item', item.id, item.revision
       FROM tasks_checklist_items AS item JOIN tasks_todos AS task
         ON task.id = item.task_id AND task.owner_id = item.owner_id
       WHERE item.owner_id = ? AND task.project_id = ?
         AND item.disposition = 'present' AND task.disposition = 'present'`,
      [ownerId, rootId, ownerId, rootId, ownerId, rootId, ownerId, rootId],
    );
  }
  if (rootType === 'heading') {
    return transaction.getAll<Candidate>(
      `SELECT 'heading' AS entity_type, id, revision FROM tasks_headings
       WHERE owner_id = ? AND id = ? AND disposition = 'present'
       UNION ALL SELECT 'todo', id, revision FROM tasks_todos
       WHERE owner_id = ? AND heading_id = ? AND disposition = 'present'
       UNION ALL SELECT 'checklist_item', item.id, item.revision
       FROM tasks_checklist_items AS item JOIN tasks_todos AS task
         ON task.id = item.task_id AND task.owner_id = item.owner_id
       WHERE item.owner_id = ? AND task.heading_id = ?
         AND item.disposition = 'present' AND task.disposition = 'present'`,
      [ownerId, rootId, ownerId, rootId, ownerId, rootId],
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
  context: Required<TaskMutationContext>,
  createId: () => string,
): Promise<void> {
  if (input.operation === 'complete_project'
    || input.operation === 'cancel_project'
    || input.operation === 'reopen_project') {
    const lifecycle = input.operation === 'complete_project'
      ? 'completed'
      : input.operation === 'cancel_project' ? 'canceled' : 'open';
    await updateLifecycleRow(
      transaction, 'tasks_projects', input.ownerId, input.rootId,
      lifecycle, occurredAt, context, createId,
    );
    if (policy === 'cascade' && lifecycle !== 'open') {
      for (const candidate of candidates.filter(({ entity_type }) => entity_type === 'todo')) {
        await updateLifecycleRow(
          transaction, 'tasks_todos', input.ownerId, candidate.id,
          lifecycle, occurredAt, context, createId,
        );
      }
    }
    return;
  }

  if (input.operation === 'delete') {
    for (const candidate of candidates) {
      await transaction.execute(
        `UPDATE ${tableFor(candidate.entity_type)}
         SET disposition = 'deleted', deleted_at = ?, deletion_root_id = ?,
           revision = revision + 1, client_mutation_id = ?,
           last_mutation_channel = ?, last_actor_type = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          occurredAt, input.rootId, createId(), context.channel, context.actorType,
          occurredAt, candidate.id, input.ownerId,
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
  context: Required<TaskMutationContext>,
  createId: () => string,
): Promise<void> {
  const orderedTypes: TaskHierarchyRootType[] = [
    'area', 'project', 'heading', 'todo', 'checklist_item',
  ];
  for (const entityType of orderedTypes) {
    for (const candidate of candidates.filter(({ entity_type }) => entity_type === entityType)) {
      const patch = await restorationPatch(transaction, input.ownerId, entityType, candidate.id);
      const columns = Object.keys(patch);
      await transaction.execute(
        `UPDATE ${tableFor(entityType)} SET
          ${columns.map((column) => `${column} = ?`).join(', ')},
          disposition = 'present', deleted_at = NULL, deletion_root_id = NULL,
          revision = revision + 1, client_mutation_id = ?,
          last_mutation_channel = ?, last_actor_type = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          ...columns.map((column) => patch[column]),
          createId(), context.channel, context.actorType, occurredAt,
          candidate.id, input.ownerId,
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
  if (entityType === 'project') {
    const project = await transaction.get<{ area_id: string | null }>(
      'SELECT area_id FROM tasks_projects WHERE id = ? AND owner_id = ?',
      [id, ownerId],
    );
    return project.area_id !== null
      && !await isPresent(transaction, 'tasks_areas', ownerId, project.area_id)
      ? { area_id: null }
      : {};
  }
  if (entityType === 'todo') {
    const task = await transaction.get<{
      area_id: string | null;
      project_id: string | null;
      heading_id: string | null;
    }>('SELECT area_id, project_id, heading_id FROM tasks_todos WHERE id = ? AND owner_id = ?', [id, ownerId]);
    const areaPresent = task.area_id === null
      || await isPresent(transaction, 'tasks_areas', ownerId, task.area_id);
    const projectPresent = task.project_id === null
      || await isPresent(transaction, 'tasks_projects', ownerId, task.project_id);
    const headingPresent = task.heading_id === null
      || await isPresent(transaction, 'tasks_headings', ownerId, task.heading_id);
    if (areaPresent && projectPresent) {
      return headingPresent ? {} : { heading_id: null };
    }
    return {
      area_id: null,
      project_id: null,
      heading_id: null,
      destination: 'inbox',
      today_section: 'daytime',
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
  if (input.rootType === 'heading') {
    const heading = await transaction.get<{ project_id: string }>(
      'SELECT project_id FROM tasks_headings WHERE id = ? AND owner_id = ?',
      [input.rootId, input.ownerId],
    );
    if (!await isPresent(transaction, 'tasks_projects', input.ownerId, heading.project_id)) {
      throw new TaskHierarchyOperationRejectedError('parent_not_present');
    }
  }
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

async function updateLifecycleRow(
  transaction: Transaction,
  table: 'tasks_projects' | 'tasks_todos',
  ownerId: string,
  id: string,
  lifecycle: 'open' | 'completed' | 'canceled',
  occurredAt: string,
  context: Required<TaskMutationContext>,
  createId: () => string,
): Promise<void> {
  await transaction.execute(
    `UPDATE ${table} SET lifecycle = ?, completed_at = ?, canceled_at = ?,
       revision = revision + 1, client_mutation_id = ?,
       last_mutation_channel = ?, last_actor_type = ?, updated_at = ?
     WHERE id = ? AND owner_id = ?`,
    [
      lifecycle,
      lifecycle === 'completed' ? occurredAt : null,
      lifecycle === 'canceled' ? occurredAt : null,
      createId(), context.channel, context.actorType, occurredAt, id, ownerId,
    ],
  );
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
    : entityType === 'project' ? 'tasks_projects'
      : entityType === 'heading' ? 'tasks_headings'
        : entityType === 'todo' ? 'tasks_todos'
          : 'tasks_checklist_items';
}

function assertRequest(input: TaskHierarchyOperationRequest): void {
  if (!input.ownerId.trim() || !input.rootId.trim()) {
    throw new TaskHierarchyOperationRejectedError('root_not_found');
  }
  if (input.operation.endsWith('_project') && input.rootType !== 'project') {
    throw new TaskHierarchyOperationRejectedError('root_not_found');
  }
}

function createUuid(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure UUID generation is unavailable');
  }
  return crypto.randomUUID();
}

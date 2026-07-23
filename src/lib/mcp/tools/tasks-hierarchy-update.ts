import type { Database, Json } from '@/integrations/supabase/types';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

type Tables = Database['public']['Tables'];
type TaskAreaRow = Tables['tasks_areas']['Row'];
type TaskProjectRow = Tables['tasks_projects']['Row'];
type TaskChecklistItemRow = Tables['tasks_checklist_items']['Row'];
type TaskHierarchyHistoryRow = Tables['tasks_hierarchy_history_events']['Row'];
type HierarchyRecordType = 'area' | 'project' | 'checklist_item';
type HierarchyRow = TaskAreaRow | TaskProjectRow | TaskChecklistItemRow;
type MutableKey = 'title' | 'notes' | 'completed' | 'completed_at';
type NormalizedPatch = Partial<Record<MutableKey, Json>>;

type MutationBase = {
  expected_revision: number;
  client_mutation_id: string;
};

export type UpdateTaskAreaRequest = MutationBase & {
  area_id: string;
  title: string;
};

export type UpdateTaskProjectRequest = MutationBase & {
  project_id: string;
  title?: string;
  notes?: string;
};

export type UpdateTaskChecklistItemRequest = MutationBase & {
  checklist_item_id: string;
  title?: string;
  completed?: boolean;
};

type MutationRequest = MutationBase & {
  recordType: HierarchyRecordType;
  recordId: string;
  patch: NormalizedPatch;
  mutableKeys: MutableKey[];
};

function trimTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error('A title is required.');
  if (Array.from(title).length > 500) throw new Error('A title cannot exceed 500 characters.');
  return title;
}

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

function jsonRecord(value: Json | null): Record<string, Json | undefined> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The hierarchy mutation receipt is invalid.');
  }
  return value;
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function readHierarchyRecord(
  auth: AuthenticatedMcpContext,
  recordType: HierarchyRecordType,
  id: string,
): Promise<HierarchyRow | null> {
  if (recordType === 'area') {
    return readOne<TaskAreaRow>(auth.supabase.from('tasks_areas')
      .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  if (recordType === 'project') {
    return readOne<TaskProjectRow>(auth.supabase.from('tasks_projects')
      .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
  }
  return readOne<TaskChecklistItemRow>(auth.supabase.from('tasks_checklist_items')
    .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
}

async function requireHierarchyRecord(
  auth: AuthenticatedMcpContext,
  recordType: HierarchyRecordType,
  id: string,
): Promise<HierarchyRow> {
  const record = await readHierarchyRecord(auth, recordType, id);
  if (record === null) throw new Error(`The task ${recordType.replace('_', ' ')} is unavailable.`);
  return record;
}

async function readHierarchyMutation(
  auth: AuthenticatedMcpContext,
  mutationId: string,
): Promise<TaskHierarchyHistoryRow | null> {
  return readOne<TaskHierarchyHistoryRow>(auth.supabase
    .from('tasks_hierarchy_history_events').select('*')
    .eq('owner_id', auth.userId).eq('client_mutation_id', mutationId).maybeSingle());
}

function receipt(event: TaskHierarchyHistoryRow) {
  return {
    client_mutation_id: event.client_mutation_id,
    actor_type: event.actor_type,
    mutation_channel: event.mutation_channel,
    affected_ids: event.affected_ids,
    base_revision: event.base_revision,
    result_revision: event.result_revision,
    transition: event.transition,
    occurred_at: event.occurred_at,
    outcome: 'accepted' as const,
    code: null,
  };
}

function ephemeralReceipt(
  request: MutationRequest,
  record: HierarchyRow,
  outcome: 'noop' | 'conflict',
  code: 'already_current' | 'revision_conflict',
) {
  return {
    client_mutation_id: request.client_mutation_id,
    actor_type: 'automation' as const,
    mutation_channel: 'mcp' as const,
    affected_ids: [record.id],
    base_revision: request.expected_revision,
    result_revision: record.revision,
    transition: 'update',
    occurred_at: new Date().toISOString(),
    outcome,
    code,
  };
}

function mutationResult(
  outcome: 'applied' | 'already_applied' | 'noop' | 'conflict',
  mutationReceipt: ReturnType<typeof receipt> | ReturnType<typeof ephemeralReceipt>,
  recordType: HierarchyRecordType,
  record: HierarchyRow,
) {
  return {
    mutation_outcome: outcome,
    receipt: mutationReceipt,
    record_type: recordType,
    record: stripOwner(record),
  };
}

function valuesEqual(left: Json | undefined, right: Json | undefined): boolean {
  return left === right;
}

function assertExactRetry(request: MutationRequest, event: TaskHierarchyHistoryRow): void {
  if (event.entity_type !== request.recordType || event.entity_id !== request.recordId
    || event.base_revision !== request.expected_revision || event.transition !== 'update') {
    throw new Error('The mutation identifier was already used for a different hierarchy request.');
  }
  const before = jsonRecord(event.before_state);
  const after = jsonRecord(event.after_state);
  for (const key of request.mutableKeys) {
    if (key === 'completed_at' && request.patch.completed !== undefined) {
      const validTimestamp = request.patch.completed === true
        ? typeof after.completed_at === 'string' && after.completed_at.length > 0
        : after.completed_at === null;
      if (!validTimestamp) {
        throw new Error('The mutation identifier was already used with different hierarchy data.');
      }
      continue;
    }
    const expected = Object.prototype.hasOwnProperty.call(request.patch, key)
      ? request.patch[key]
      : before[key];
    if (!valuesEqual(after[key], expected)) {
      throw new Error('The mutation identifier was already used with different hierarchy data.');
    }
  }
}

async function resolveRetry(
  request: MutationRequest,
  auth: AuthenticatedMcpContext,
) {
  const [event, todoEvent, hierarchyOperation] = await Promise.all([
    readHierarchyMutation(auth, request.client_mutation_id),
    readOne<{ id: string }>(auth.supabase.from('tasks_history_events').select('id')
      .eq('owner_id', auth.userId)
      .eq('client_mutation_id', request.client_mutation_id).maybeSingle()),
    readOne<{ id: string }>(auth.supabase.from('tasks_hierarchy_operations').select('id')
      .eq('owner_id', auth.userId).eq('id', request.client_mutation_id).maybeSingle()),
  ]);
  if (todoEvent !== null) {
    throw new Error('The mutation identifier was already used for a different task request.');
  }
  if (hierarchyOperation !== null) {
    throw new Error('The mutation identifier was already used for a different hierarchy operation.');
  }
  if (event === null) return null;
  assertExactRetry(request, event);
  const current = await requireHierarchyRecord(auth, request.recordType, request.recordId);
  return mutationResult('already_applied', receipt(event), request.recordType, current);
}

function assertMutable(record: HierarchyRow): void {
  if (record.disposition !== 'present') {
    throw new Error('Restore the hierarchy record before editing it.');
  }
  if ('lifecycle' in record && record.lifecycle !== 'open') {
    throw new Error('Reopen the project before editing it.');
  }
}

async function assertParentMutable(
  request: MutationRequest,
  record: HierarchyRow,
  auth: AuthenticatedMcpContext,
): Promise<void> {
  if (request.recordType === 'checklist_item') {
    const item = record as TaskChecklistItemRow;
    const task = await readOne<{ id: string }>(auth.supabase.from('tasks_todos')
      .select('id').eq('owner_id', auth.userId).eq('id', item.task_id)
      .eq('disposition', 'present').eq('lifecycle', 'open').maybeSingle());
    if (task === null) throw new Error('Reopen or restore the parent task before editing.');
  }
}

function changedPatch(record: HierarchyRow, patch: NormalizedPatch): NormalizedPatch {
  const candidate = { ...patch };
  if ('completed' in record && candidate.completed === record.completed) {
    delete candidate.completed;
    delete candidate.completed_at;
  }
  return Object.fromEntries(
    Object.entries(candidate).filter(([key, value]) => (
      (record as unknown as Record<string, Json | undefined>)[key] !== value
    )),
  );
}

function tableFor(recordType: HierarchyRecordType) {
  if (recordType === 'area') return 'tasks_areas' as const;
  if (recordType === 'project') return 'tasks_projects' as const;
  return 'tasks_checklist_items' as const;
}

async function writeMutation(
  request: MutationRequest,
  current: HierarchyRow,
  patch: NormalizedPatch,
  auth: AuthenticatedMcpContext,
) {
  const nextPatch = changedPatch(current, patch);
  if (Object.keys(nextPatch).length === 0) {
    return mutationResult(
      'noop',
      ephemeralReceipt(request, current, 'noop', 'already_current'),
      request.recordType,
      current,
    );
  }
  const { data, error } = await auth.supabase.from(tableFor(request.recordType)).update({
    ...nextPatch,
    revision: current.revision + 1,
    client_mutation_id: request.client_mutation_id,
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
  } as never).eq('owner_id', auth.userId).eq('id', request.recordId)
    .eq('revision', request.expected_revision).select('*').maybeSingle();
  if (error) {
    const retry = await resolveRetry(request, auth);
    if (retry !== null) return retry;
    if ('code' in error && error.code === '23505') {
      throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
    }
    throw new Error(error.message);
  }
  if (data === null) {
    const retry = await resolveRetry(request, auth);
    if (retry !== null) return retry;
    const authoritative = await requireHierarchyRecord(auth, request.recordType, request.recordId);
    return mutationResult(
      'conflict',
      ephemeralReceipt(request, authoritative, 'conflict', 'revision_conflict'),
      request.recordType,
      authoritative,
    );
  }
  const event = await readHierarchyMutation(auth, request.client_mutation_id);
  if (event === null) throw new Error('The accepted hierarchy mutation receipt is unavailable.');
  assertExactRetry(request, event);
  return mutationResult('applied', receipt(event), request.recordType, data as HierarchyRow);
}

async function runMutation(
  request: MutationRequest,
  auth: AuthenticatedMcpContext,
) {
  const retry = await resolveRetry(request, auth);
  if (retry !== null) return retry;
  const current = await requireHierarchyRecord(auth, request.recordType, request.recordId);
  if (current.revision !== request.expected_revision) {
    return mutationResult(
      'conflict',
      ephemeralReceipt(request, current, 'conflict', 'revision_conflict'),
      request.recordType,
      current,
    );
  }
  assertMutable(current);
  await assertParentMutable(request, current, auth);
  return writeMutation(request, current, request.patch, auth);
}

export function updateTaskAreaData(
  input: UpdateTaskAreaRequest,
  auth: AuthenticatedMcpContext,
) {
  return runMutation({
    ...input,
    recordType: 'area',
    recordId: input.area_id,
    patch: { title: trimTitle(input.title) },
    mutableKeys: ['title'],
  }, auth);
}

export function updateTaskProjectData(
  input: UpdateTaskProjectRequest,
  auth: AuthenticatedMcpContext,
) {
  if (input.title === undefined && input.notes === undefined) {
    throw new Error('Update at least one of title or notes.');
  }
  return runMutation({
    ...input,
    recordType: 'project',
    recordId: input.project_id,
    patch: {
      ...(input.title === undefined ? {} : { title: trimTitle(input.title) }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    },
    mutableKeys: ['title', 'notes'],
  }, auth);
}

export function updateTaskChecklistItemData(
  input: UpdateTaskChecklistItemRequest,
  auth: AuthenticatedMcpContext,
) {
  if (input.title === undefined && input.completed === undefined) {
    throw new Error('Update at least one of title or completed.');
  }
  return runMutation({
    ...input,
    recordType: 'checklist_item',
    recordId: input.checklist_item_id,
    patch: {
      ...(input.title === undefined ? {} : { title: trimTitle(input.title) }),
      ...(input.completed === undefined ? {} : {
        completed: input.completed,
        completed_at: input.completed ? new Date().toISOString() : null,
      }),
    },
    mutableKeys: ['title', 'completed', 'completed_at'],
  }, auth);
}

const mutationInput = {
  expected_revision: z.number().int().positive().describe('Current positive record revision.'),
  client_mutation_id: uuidSchema.describe('Stable UUID for this exact logical mutation.'),
};

const mutationAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const updateTaskArea = defineTool({
  name: 'update_task_area',
  title: 'Update Task Area',
  description: 'Rename one owner-scoped present task area through an optimistic revision boundary.',
  inputSchema: { ...mutationInput, area_id: uuidSchema, title: z.string().min(1).max(500) },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(updateTaskAreaData(input, requireAuthenticated(ctx))),
});

export const updateTaskProject = defineTool({
  name: 'update_task_project',
  title: 'Update Task Project',
  description: 'Edit supported content on one owner-scoped open project through an optimistic revision boundary.',
  inputSchema: {
    ...mutationInput,
    project_id: uuidSchema,
    title: z.string().min(1).max(500).optional(),
    notes: z.string().max(100_000).optional(),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(updateTaskProjectData(input, requireAuthenticated(ctx))),
});

export const updateTaskChecklistItem = defineTool({
  name: 'update_task_checklist_item',
  title: 'Update Task Checklist Item',
  description: 'Edit or complete one owner-scoped checklist item beneath an open to-do through an optimistic revision boundary.',
  inputSchema: {
    ...mutationInput,
    checklist_item_id: uuidSchema,
    title: z.string().min(1).max(500).optional(),
    completed: z.boolean().optional(),
  },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(
    updateTaskChecklistItemData(input, requireAuthenticated(ctx)),
  ),
});

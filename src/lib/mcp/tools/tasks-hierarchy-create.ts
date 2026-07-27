import type { Database, Json } from '@/integrations/supabase/types';
import { generateTaskOrderKey } from '../../../modules/tasks/domain/taskOrder';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';
type Tables = Database['public']['Tables'];
type TaskAreaRow = Tables['tasks_areas']['Row'];
type TaskChecklistItemRow = Tables['tasks_checklist_items']['Row'];
type TaskHierarchyHistoryRow = Tables['tasks_hierarchy_history_events']['Row'];
type HierarchyRecordType = 'area' | 'checklist_item';
type HierarchyRow = TaskAreaRow | TaskChecklistItemRow;

export type CreateTaskAreaRequest = {
  idempotency_key: string;
  title: string;
};

export type CreateTaskChecklistItemRequest = {
  idempotency_key: string;
  task_id: string;
  title: string;
};

type ExistingCreation = {
  event: TaskHierarchyHistoryRow;
  record: HierarchyRow;
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

function jsonRecord(value: Json): Record<string, Json | undefined> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The hierarchy creation receipt is invalid.');
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
  return readOne<TaskChecklistItemRow>(auth.supabase.from('tasks_checklist_items')
    .select('*').eq('owner_id', auth.userId).eq('id', id).maybeSingle());
}

async function findExistingCreation(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
): Promise<ExistingCreation | null> {
  const event = await readOne<TaskHierarchyHistoryRow>(auth.supabase
    .from('tasks_hierarchy_history_events')
    .select('*')
    .eq('owner_id', auth.userId)
    .eq('client_mutation_id', idempotencyKey)
    .maybeSingle());
  if (event === null) return null;
  if (event.transition !== 'create') {
    throw new Error('The idempotency key belongs to a different hierarchy mutation.');
  }
  const recordType = event.entity_type as HierarchyRecordType;
  if (!['area', 'checklist_item'].includes(recordType)) {
    throw new Error('The hierarchy creation receipt has an unsupported record type.');
  }
  const record = await readHierarchyRecord(auth, recordType, event.entity_id);
  if (record === null) throw new Error('The created hierarchy record is unavailable.');
  return { event, record };
}

function assertExactReplay(
  existing: ExistingCreation,
  expectedType: HierarchyRecordType,
  expected: Record<string, Json>,
): void {
  if (existing.event.entity_type !== expectedType) {
    throw new Error('The idempotency key was already used for a different hierarchy request.');
  }
  const state = jsonRecord(existing.event.after_state);
  const matches = Object.entries(expected).every(([key, value]) => state[key] === value);
  if (!matches) {
    throw new Error('The idempotency key was already used with different hierarchy data.');
  }
}

function creationResult(existing: ExistingCreation, status: 'created' | 'already_applied') {
  const { event, record } = existing;
  return {
    mutation_outcome: status,
    receipt: {
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
    },
    record_type: event.entity_type,
    record: stripOwner(record),
  };
}

async function replayOrNull(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
  recordType: HierarchyRecordType,
  expected: Record<string, Json>,
) {
  const [existing, todoMutation, hierarchyOperation] = await Promise.all([
    findExistingCreation(auth, idempotencyKey),
    readOne<{ id: string }>(auth.supabase.from('tasks_history_events')
      .select('id').eq('owner_id', auth.userId)
      .eq('client_mutation_id', idempotencyKey).maybeSingle()),
    readOne<{ id: string }>(auth.supabase.from('tasks_hierarchy_operations')
      .select('id').eq('owner_id', auth.userId).eq('id', idempotencyKey).maybeSingle()),
  ]);
  if (todoMutation !== null) {
    throw new Error('The idempotency key was already used for a different task mutation.');
  }
  if (hierarchyOperation !== null) {
    throw new Error('The idempotency key was already used for a different hierarchy operation.');
  }
  if (existing === null) return null;
  assertExactReplay(existing, recordType, expected);
  return creationResult(existing, 'already_applied');
}

async function readCreated(
  auth: AuthenticatedMcpContext,
  idempotencyKey: string,
): Promise<ExistingCreation> {
  const existing = await findExistingCreation(auth, idempotencyKey);
  if (existing === null) throw new Error('The accepted hierarchy creation receipt is unavailable.');
  return existing;
}

async function insertWithReplay(
  auth: AuthenticatedMcpContext,
  table: 'tasks_areas' | 'tasks_checklist_items',
  row: Tables[typeof table]['Insert'],
  idempotencyKey: string,
  recordType: HierarchyRecordType,
  expected: Record<string, Json>,
) {
  const { error } = await auth.supabase.from(table).insert(row as never);
  if (error) {
    if (error.code === '23505') {
      const replay = await replayOrNull(auth, idempotencyKey, recordType, expected);
      if (replay !== null) return replay;
      throw new Error('The idempotency key is unavailable. Use a new key for a new hierarchy request.');
    }
    throw new Error(error.message);
  }
  return creationResult(await readCreated(auth, idempotencyKey), 'created');
}

async function nextAreaOrderKey(auth: AuthenticatedMcpContext): Promise<string> {
  const last = await readOne<Pick<TaskAreaRow, 'order_key'>>(auth.supabase
    .from('tasks_areas').select('order_key').eq('owner_id', auth.userId)
    .eq('disposition', 'present').order('order_key', { ascending: false })
    .order('id', { ascending: false }).limit(1).maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

async function nextChecklistOrderKey(
  auth: AuthenticatedMcpContext,
  taskId: string,
): Promise<string> {
  const last = await readOne<Pick<TaskChecklistItemRow, 'order_key'>>(auth.supabase
    .from('tasks_checklist_items').select('order_key').eq('owner_id', auth.userId)
    .eq('task_id', taskId).eq('disposition', 'present')
    .order('order_key', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle());
  return generateTaskOrderKey(last?.order_key ?? null, null);
}

export async function createTaskAreaData(
  input: CreateTaskAreaRequest,
  auth: AuthenticatedMcpContext,
) {
  const title = trimTitle(input.title);
  const expected = { title };
  const replay = await replayOrNull(auth, input.idempotency_key, 'area', expected);
  if (replay !== null) return replay;
  const timestamp = new Date().toISOString();
  return insertWithReplay(auth, 'tasks_areas', {
    id: crypto.randomUUID(),
    owner_id: auth.userId,
    title,
    order_key: await nextAreaOrderKey(auth),
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    entry_channel: 'mcp',
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
    revision: 1,
    client_mutation_id: input.idempotency_key,
    created_at: timestamp,
    updated_at: timestamp,
  }, input.idempotency_key, 'area', expected);
}

export async function createTaskChecklistItemData(
  input: CreateTaskChecklistItemRequest,
  auth: AuthenticatedMcpContext,
) {
  const title = trimTitle(input.title);
  const expected = { title, task_id: input.task_id };
  const replay = await replayOrNull(auth, input.idempotency_key, 'checklist_item', expected);
  if (replay !== null) return replay;
  const task = await readOne<{ id: string }>(auth.supabase.from('tasks_todos')
    .select('id').eq('owner_id', auth.userId).eq('id', input.task_id)
    .eq('disposition', 'present').eq('lifecycle', 'open').maybeSingle());
  if (task === null) throw new Error('The parent task is unavailable.');
  const timestamp = new Date().toISOString();
  return insertWithReplay(auth, 'tasks_checklist_items', {
    id: crypto.randomUUID(),
    owner_id: auth.userId,
    task_id: input.task_id,
    title,
    completed: false,
    completed_at: null,
    order_key: await nextChecklistOrderKey(auth, input.task_id),
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    entry_channel: 'mcp',
    last_mutation_channel: 'mcp',
    last_actor_type: 'automation',
    revision: 1,
    client_mutation_id: input.idempotency_key,
    created_at: timestamp,
    updated_at: timestamp,
  }, input.idempotency_key, 'checklist_item', expected);
}

const idempotencyInput = {
  idempotency_key: uuidSchema.describe(
    'Stable UUID for this logical creation request. Reuse it only for an exact retry.',
  ),
  title: z.string().trim().min(1).max(500),
};

const mutationAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const createTaskArea = defineTool({
  name: 'create_task_area',
  title: 'Create Task Area',
  description: 'Create one owner-scoped task area with safe exact-retry behavior.',
  inputSchema: idempotencyInput,
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(createTaskAreaData(input, requireAuthenticated(ctx))),
});

export const createTaskChecklistItem = defineTool({
  name: 'create_task_checklist_item',
  title: 'Create Task Checklist Item',
  description: 'Create one owner-scoped checklist item beneath an accessible open to-do.',
  inputSchema: { ...idempotencyInput, task_id: uuidSchema },
  annotations: mutationAnnotations,
  handler: (input, ctx) => toMcpResult(
    createTaskChecklistItemData(input, requireAuthenticated(ctx)),
  ),
});

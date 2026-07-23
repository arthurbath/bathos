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
type HierarchyOperationRow = Tables['tasks_hierarchy_operations']['Row'];
type HierarchyRootType = 'area' | 'project' | 'checklist_item';
type HierarchyRootRow = TaskAreaRow | TaskProjectRow | TaskChecklistItemRow;
type HierarchyTransition = 'complete' | 'cancel' | 'reopen' | 'delete' | 'restore';
type DescendantPolicy = 'reject' | 'cascade';

export type TransitionTaskHierarchyRequest = {
  root_type: HierarchyRootType;
  root_id: string;
  expected_revision: number;
  client_mutation_id: string;
  transition: HierarchyTransition;
  descendant_policy?: DescendantPolicy;
};

type NormalizedRequest = TransitionTaskHierarchyRequest & {
  operation: 'complete_project' | 'cancel_project' | 'reopen_project' | 'delete' | 'restore';
  policy: DescendantPolicy;
};

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

function jsonObject(value: Json | null): Record<string, Json | undefined> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('The hierarchy operation receipt is invalid.');
  }
  return value;
}

function normalizeRequest(input: TransitionTaskHierarchyRequest): NormalizedRequest {
  if (input.transition === 'complete' || input.transition === 'cancel') {
    if (input.root_type !== 'project') {
      throw new Error('Only projects can be completed or canceled through this hierarchy operation.');
    }
    return {
      ...input,
      operation: input.transition === 'complete' ? 'complete_project' : 'cancel_project',
      policy: input.descendant_policy ?? 'reject',
    };
  }
  if (input.transition === 'reopen') {
    if (input.root_type !== 'project') {
      throw new Error('Only projects can be reopened through this hierarchy operation.');
    }
    if (input.descendant_policy === 'cascade') {
      throw new Error('Reopening a project does not cascade to descendants.');
    }
    return { ...input, operation: 'reopen_project', policy: 'reject' };
  }
  if (input.descendant_policy !== undefined) {
    throw new Error('Deletion and restoration use the required atomic cascade automatically.');
  }
  return { ...input, operation: input.transition, policy: 'cascade' };
}

async function readOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function readRoot(
  auth: AuthenticatedMcpContext,
  rootType: HierarchyRootType,
  rootId: string,
): Promise<HierarchyRootRow | null> {
  if (rootType === 'area') {
    return readOne<TaskAreaRow>(auth.supabase.from('tasks_areas').select('*')
      .eq('owner_id', auth.userId).eq('id', rootId).maybeSingle());
  }
  if (rootType === 'project') {
    return readOne<TaskProjectRow>(auth.supabase.from('tasks_projects').select('*')
      .eq('owner_id', auth.userId).eq('id', rootId).maybeSingle());
  }
  return readOne<TaskChecklistItemRow>(auth.supabase.from('tasks_checklist_items').select('*')
    .eq('owner_id', auth.userId).eq('id', rootId).maybeSingle());
}

async function readOperation(
  auth: AuthenticatedMcpContext,
  mutationId: string,
): Promise<HierarchyOperationRow | null> {
  return readOne<HierarchyOperationRow>(auth.supabase.from('tasks_hierarchy_operations')
    .select('*').eq('owner_id', auth.userId).eq('id', mutationId).maybeSingle());
}

async function assertMutationIdAvailable(
  auth: AuthenticatedMcpContext,
  mutationId: string,
): Promise<void> {
  const [taskEvent, hierarchyEvent] = await Promise.all([
    readOne<{ id: string }>(auth.supabase.from('tasks_history_events').select('id')
      .eq('owner_id', auth.userId).eq('client_mutation_id', mutationId).maybeSingle()),
    readOne<{ id: string }>(auth.supabase.from('tasks_hierarchy_history_events').select('id')
      .eq('owner_id', auth.userId).eq('client_mutation_id', mutationId).maybeSingle()),
  ]);
  if (taskEvent !== null || hierarchyEvent !== null) {
    throw new Error('The mutation identifier is unavailable. Use a new UUID for a new request.');
  }
}

function expectedRootRevision(operation: HierarchyOperationRow, rootId: string): number | null {
  const value = jsonObject(operation.expected_revisions)[rootId];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function assertExactRetry(request: NormalizedRequest, operation: HierarchyOperationRow): void {
  if (operation.root_type !== request.root_type || operation.root_id !== request.root_id
    || operation.operation !== request.operation || operation.descendant_policy !== request.policy
    || operation.actor_type !== 'automation' || operation.mutation_channel !== 'mcp'
    || expectedRootRevision(operation, request.root_id) !== request.expected_revision) {
    throw new Error('The mutation identifier was already used for a different hierarchy operation.');
  }
}

function operationFromJson(value: Json): HierarchyOperationRow {
  const object = jsonObject(value);
  if (typeof object.id !== 'string' || typeof object.root_type !== 'string'
    || typeof object.root_id !== 'string' || typeof object.operation !== 'string'
    || typeof object.descendant_policy !== 'string' || typeof object.requested_at !== 'string'
    || typeof object.outcome !== 'string' || !Array.isArray(object.affected_ids)) {
    throw new Error('The hierarchy operation receipt is invalid.');
  }
  return object as unknown as HierarchyOperationRow;
}

function revisionMap(value: Json): Record<string, number> {
  const object = jsonObject(value);
  return Object.fromEntries(Object.entries(object).flatMap(([id, revision]) => (
    typeof revision === 'number' && Number.isSafeInteger(revision) ? [[id, revision]] : []
  )));
}

function operationReceipt(
  request: NormalizedRequest,
  operation: HierarchyOperationRow,
  current: HierarchyRootRow | null,
) {
  const before = revisionMap(operation.expected_revisions);
  const after = revisionMap(operation.result_revisions);
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  const affectedRevisions = Object.fromEntries([...ids].map((id) => [id, {
    base_revision: before[id] ?? null,
    result_revision: after[id] ?? before[id] ?? null,
  }]));
  const outcome = operation.outcome;
  if (!['accepted', 'noop', 'rejected', 'conflict'].includes(outcome)) {
    throw new Error('The hierarchy operation has not reached a terminal outcome.');
  }
  return {
    client_mutation_id: operation.id,
    actor_type: 'automation' as const,
    mutation_channel: 'mcp' as const,
    affected_ids: operation.affected_ids,
    base_revision: request.expected_revision,
    result_revision: after[request.root_id] ?? current?.revision ?? request.expected_revision,
    affected_revisions: affectedRevisions,
    transition: request.transition,
    occurred_at: operation.completed_at ?? operation.requested_at,
    outcome: outcome as 'accepted' | 'noop' | 'rejected' | 'conflict',
    code: operation.code,
  };
}

function ephemeralReceipt(
  request: NormalizedRequest,
  root: HierarchyRootRow,
  outcome: 'noop' | 'conflict',
  code: 'already_current' | 'revision_conflict',
) {
  return {
    client_mutation_id: request.client_mutation_id,
    actor_type: 'automation' as const,
    mutation_channel: 'mcp' as const,
    affected_ids: [root.id],
    base_revision: request.expected_revision,
    result_revision: root.revision,
    affected_revisions: {
      [root.id]: { base_revision: request.expected_revision, result_revision: root.revision },
    },
    transition: request.transition,
    occurred_at: new Date().toISOString(),
    outcome,
    code,
  };
}

function mutationResult(
  mutationOutcome: 'applied' | 'already_applied' | 'noop' | 'rejected' | 'conflict',
  receipt: ReturnType<typeof operationReceipt> | ReturnType<typeof ephemeralReceipt>,
  request: NormalizedRequest,
  root: HierarchyRootRow | null,
) {
  return {
    mutation_outcome: mutationOutcome,
    receipt,
    record_type: request.root_type,
    record: root === null ? null : stripOwner(root),
  };
}

function alreadyCurrent(request: NormalizedRequest, root: HierarchyRootRow): boolean {
  if (request.transition === 'delete') return root.disposition === 'deleted';
  if (request.transition === 'restore') return root.disposition === 'present';
  const project = root as TaskProjectRow;
  return (request.transition === 'complete' && project.lifecycle === 'completed')
    || (request.transition === 'cancel' && project.lifecycle === 'canceled')
    || (request.transition === 'reopen' && project.lifecycle === 'open');
}

function assertLifecycleSource(request: NormalizedRequest, root: HierarchyRootRow): void {
  if (request.transition === 'complete' || request.transition === 'cancel') {
    if ((root as TaskProjectRow).lifecycle !== 'open') {
      throw new Error('Reopen the project before completing or canceling it.');
    }
  }
}

function assertLifecycleRootPresent(request: NormalizedRequest, root: HierarchyRootRow): void {
  if (request.operation.endsWith('_project') && root.disposition !== 'present') {
    throw new Error('Restore the project before changing its lifecycle.');
  }
}

async function callOperation(
  request: NormalizedRequest,
  auth: AuthenticatedMcpContext,
): Promise<HierarchyOperationRow> {
  const { data, error } = await auth.supabase.rpc('tasks_request_mcp_hierarchy_operation', {
    _request_id: request.client_mutation_id,
    _root_type: request.root_type,
    _root_id: request.root_id,
    _expected_revision: request.expected_revision,
    _operation: request.operation,
    _descendant_policy: request.policy,
  });
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('The hierarchy operation receipt is unavailable.');
  return operationFromJson(data);
}

export async function transitionTaskHierarchyData(
  input: TransitionTaskHierarchyRequest,
  auth: AuthenticatedMcpContext,
) {
  const request = normalizeRequest(input);
  const replay = await readOperation(auth, request.client_mutation_id);
  if (replay !== null) {
    assertExactRetry(request, replay);
    const current = await readRoot(auth, request.root_type, request.root_id);
    const outcome = replay.outcome === 'accepted' || replay.outcome === 'noop'
      ? 'already_applied'
      : replay.outcome === 'conflict' ? 'conflict' : 'rejected';
    return mutationResult(outcome, operationReceipt(request, replay, current), request, current);
  }
  await assertMutationIdAvailable(auth, request.client_mutation_id);

  const current = await readRoot(auth, request.root_type, request.root_id);
  if (current === null) throw new Error('The task hierarchy root is unavailable.');
  if (current.revision !== request.expected_revision) {
    return mutationResult(
      'conflict',
      ephemeralReceipt(request, current, 'conflict', 'revision_conflict'),
      request,
      current,
    );
  }
  assertLifecycleRootPresent(request, current);
  if (alreadyCurrent(request, current)) {
    return mutationResult(
      'noop',
      ephemeralReceipt(request, current, 'noop', 'already_current'),
      request,
      current,
    );
  }
  assertLifecycleSource(request, current);

  const operation = await callOperation(request, auth);
  assertExactRetry(request, operation);
  const updated = await readRoot(auth, request.root_type, request.root_id);
  const mutationOutcome = operation.outcome === 'accepted'
    ? 'applied'
    : operation.outcome === 'noop'
      ? 'noop'
      : operation.outcome === 'rejected' ? 'rejected' : 'conflict';
  return mutationResult(
    mutationOutcome,
    operationReceipt(request, operation, updated),
    request,
    updated,
  );
}

export const transitionTaskHierarchy = defineTool({
  name: 'transition_task_hierarchy',
  title: 'Transition Task Hierarchy',
  description: 'Complete, cancel, or reopen one project, or recoverably delete or restore one area, project, or checklist item with one atomic revision-checked hierarchy operation. Permanent deletion is not available.',
  inputSchema: {
    root_type: z.enum(['area', 'project', 'checklist_item']),
    root_id: uuidSchema.describe('Stable hierarchy root identifier.'),
    expected_revision: z.number().int().positive().describe('Current root revision returned by a task hierarchy read.'),
    client_mutation_id: uuidSchema.describe('Stable UUID for this logical mutation. Reuse it only to retry the exact same request.'),
    transition: z.enum(['complete', 'cancel', 'reopen', 'delete', 'restore']),
    descendant_policy: z.enum(['reject', 'cascade']).optional().describe('Project completion or cancellation policy. Omit for the safe reject default; cascade must be explicit.'),
  },
  annotations: {
    readOnlyHint: false,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  handler: (input, ctx) => toMcpResult(
    transitionTaskHierarchyData(input, requireAuthenticated(ctx)),
  ),
});

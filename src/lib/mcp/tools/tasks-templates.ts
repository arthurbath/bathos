import type { Database } from '@/integrations/supabase/types';

import { defineTool, z } from '../mcp-core';
import {
  requireAuthenticated,
  toMcpResult,
  type AuthenticatedMcpContext,
} from '../supabase';
import { uuidSchema } from '../resource-utils';

type TemplateRow = Database['public']['Tables']['tasks_templates']['Row'];
type TemplateRevisionRow = Database['public']['Tables']['tasks_template_revisions']['Row'];

async function readMany<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function stripOwner<T extends { owner_id: string }>(row: T): Omit<T, 'owner_id'> {
  const { owner_id: _ownerId, ...record } = row;
  return record;
}

export async function getTaskTemplatesData(
  input: { include_archived: boolean; limit: number },
  auth: AuthenticatedMcpContext,
) {
  let query = auth.supabase
    .from('tasks_templates')
    .select('*')
    .eq('owner_id', auth.userId);
  if (!input.include_archived) query = query.is('archived_at', null);
  const definitions = await readMany<TemplateRow>(query
    .order('kind')
    .order('name')
    .order('id')
    .limit(input.limit + 1));
  const visible = definitions.slice(0, input.limit);
  const ids = visible.map(({ id }) => id);
  const revisions = ids.length === 0
    ? []
    : await readMany<TemplateRevisionRow>(auth.supabase
      .from('tasks_template_revisions')
      .select('*')
      .eq('owner_id', auth.userId)
      .in('template_id', ids)
      .order('template_id')
      .order('revision', { ascending: false }));
  const currentByTemplate = new Map(revisions.map((revision) => [
    `${revision.template_id}:${revision.revision}`,
    revision,
  ]));

  return {
    templates: visible.map((definition) => ({
      ...stripOwner(definition),
      current_revision_record: currentByTemplate.has(
        `${definition.id}:${definition.current_revision}`,
      )
        ? stripOwner(currentByTemplate.get(`${definition.id}:${definition.current_revision}`)!)
        : null,
    })),
    truncated: definitions.length > input.limit,
  };
}

export async function instantiateTaskTemplateData(
  input: {
    template_id: string;
    template_revision?: number;
    anchor_date: string;
    target_area_id?: string;
    idempotency_key: string;
  },
  auth: AuthenticatedMcpContext,
) {
  const { data, error } = await auth.supabase.rpc('tasks_instantiate_template', {
    _template_id: input.template_id,
    _template_revision: (input.template_revision ?? null) as unknown as number,
    _anchor_date: input.anchor_date,
    _request_id: input.idempotency_key,
    _entry_channel: 'mcp',
    _actor_type: 'automation',
    _target_area_id: input.target_area_id,
  });
  if (error) throw new Error(error.message);
  return data;
}

export const getTaskTemplates = defineTool({
  name: 'get_task_templates',
  title: 'Get Task Templates',
  description: 'Read the signed-in user\'s native to-do and project templates with each current immutable revision and relative planning snapshot.',
  inputSchema: {
    include_archived: z.boolean().default(false),
    limit: z.number().int().min(1).max(500).default(250),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(getTaskTemplatesData(input, requireAuthenticated(ctx))),
});

export const instantiateTaskTemplate = defineTool({
  name: 'instantiate_task_template',
  title: 'Instantiate Task Template',
  description: 'Atomically create a complete to-do or project hierarchy from one native template revision for an explicit calendar date.',
  inputSchema: {
    template_id: uuidSchema,
    template_revision: z.number().int().positive().optional()
      .describe('Immutable revision to create. Defaults to the template current revision.'),
    anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Explicit reference date used to preserve relative start dates and deadlines.'),
    target_area_id: uuidSchema.optional()
      .describe('Optional accessible destination area for a project template.'),
    idempotency_key: uuidSchema
      .describe('Stable UUID for this exact creation request. Reuse only for an exact retry.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: (input, ctx) => toMcpResult(instantiateTaskTemplateData(
    input,
    requireAuthenticated(ctx),
  )),
});

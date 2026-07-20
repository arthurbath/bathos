import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  getTaskTemplates,
  getTaskTemplatesData,
  instantiateTaskTemplate,
  instantiateTaskTemplateData,
} from './tasks-templates';

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: Array<(row: Row) => boolean> = [];
  private rowLimit: number | undefined;

  constructor(private readonly rows: Row[]) {}
  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  order() { return this; }
  limit(value: number) {
    this.rowLimit = value;
    return this;
  }
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const filtered = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    return Promise.resolve({
      data: this.rowLimit === undefined ? filtered : filtered.slice(0, this.rowLimit),
      error: null,
    }).then(onfulfilled, onrejected);
  }
}

const ownerId = '10000000-0000-4000-8000-000000000001';
const templateId = '20000000-0000-4000-8000-000000000001';

function authFor(tables: Record<string, Row[]>, rpc = vi.fn()): AuthenticatedMcpContext {
  return {
    userId: ownerId,
    email: null,
    supabase: {
      from: (table: string) => new FakeQuery(tables[table] ?? []),
      rpc,
    } as unknown as AuthenticatedMcpContext['supabase'],
  };
}

describe('Tasks template MCP tools', () => {
  it('advertises one read operation and one idempotent mutation', () => {
    expect(getTaskTemplates.name).toBe('get_task_templates');
    expect(getTaskTemplates.annotations).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(instantiateTaskTemplate.name).toBe('instantiate_task_template');
    expect(instantiateTaskTemplate.annotations).toEqual({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it('returns only owner-scoped active templates and their current revisions', async () => {
    const result = await getTaskTemplatesData({ include_archived: false, limit: 50 }, authFor({
      tasks_templates: [
        {
          id: templateId,
          owner_id: ownerId,
          kind: 'todo',
          name: 'Review',
          current_revision: 2,
          archived_at: null,
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          owner_id: ownerId,
          kind: 'todo',
          name: 'Archived',
          current_revision: 1,
          archived_at: '2026-07-20T00:00:00Z',
        },
        {
          id: '20000000-0000-4000-8000-000000000003',
          owner_id: '10000000-0000-4000-8000-000000000002',
          kind: 'todo',
          name: 'Other Owner',
          current_revision: 1,
          archived_at: null,
        },
      ],
      tasks_template_revisions: [
        { id: '30000000-0000-4000-8000-000000000001', owner_id: ownerId, template_id: templateId, revision: 1 },
        { id: '30000000-0000-4000-8000-000000000002', owner_id: ownerId, template_id: templateId, revision: 2, snapshot: { version: 1 } },
      ],
    }));

    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]).toMatchObject({
      id: templateId,
      current_revision_record: { revision: 2 },
    });
    expect(result.templates[0]).not.toHaveProperty('owner_id');
    expect(result.templates[0].current_revision_record).not.toHaveProperty('owner_id');
  });

  it('instantiates through the guarded RPC with MCP provenance and exact retry key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { outcome: 'accepted' }, error: null });
    const idempotencyKey = '40000000-0000-4000-8000-000000000001';
    const result = await instantiateTaskTemplateData({
      template_id: templateId,
      template_revision: 2,
      anchor_date: '2026-07-27',
      idempotency_key: idempotencyKey,
    }, authFor({}, rpc));

    expect(result).toEqual({ outcome: 'accepted' });
    expect(rpc).toHaveBeenCalledWith('tasks_instantiate_template', {
      _template_id: templateId,
      _template_revision: 2,
      _anchor_date: '2026-07-27',
      _request_id: idempotencyKey,
      _entry_channel: 'mcp',
      _actor_type: 'automation',
      _target_area_id: undefined,
    });
  });
});

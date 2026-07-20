import { describe, expect, it, vi } from 'vitest';

import type { Database, Json } from '@/integrations/supabase/types';
import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import { createMailTask, createMailTaskData, type CreateMailTaskRequest } from './tasks-mail';
import { planningDateInTimeZone } from './tasks-read';

type TableName = keyof Database['public']['Tables'];
type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Array<(row: Row) => boolean> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private rowLimit: number | undefined;

  constructor(private readonly rows: Row[]) {}

  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  not(column: string, operator: string, value: null) {
    if (operator !== 'is' || value !== null) throw new Error('Unsupported fake query');
    this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(value: number) {
    this.rowLimit = value;
    return this;
  }
  maybeSingle() {
    const rows = this.rows
      .filter((row) => this.filters.every((filter) => filter(row)))
      .sort((left, right) => {
        for (const { column, ascending } of this.orders) {
          const compared = String(left[column] ?? '').localeCompare(String(right[column] ?? ''));
          if (compared !== 0) return ascending ? compared : -compared;
        }
        return 0;
      });
    return Promise.resolve({ data: rows.slice(0, this.rowLimit ?? 1)[0] ?? null, error: null });
  }
  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.maybeSingle().then(onfulfilled, onrejected);
  }
}

function clientFor(
  tables: Partial<Record<TableName, Row[]>>,
  rpcResult: { data: Json | null; error: { message: string } | null } = {
    data: { idempotency_outcome: 'created' },
    error: null,
  },
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return {
    from: (table: TableName) => new FakeQuery(tables[table] ?? []),
    rpc,
  };
}

function authFor(client: ReturnType<typeof clientFor>): AuthenticatedMcpContext {
  return {
    userId: ownerId,
    email: null,
    supabase: client as unknown as AuthenticatedMcpContext['supabase'],
  };
}

const ownerId = '81000000-0000-4000-8000-000000000001';
const areaId = '81000000-0000-4000-8000-000000000002';

function request(overrides: Partial<CreateMailTaskRequest> = {}): CreateMailTaskRequest {
  return {
    idempotency_key: '81000000-0000-4000-8000-000000000010',
    title: '  Reply to the project update  ',
    notes: 'Review the message and reply.',
    account_identifier: ' Work ',
    mailbox_identifier: ' INBOX ',
    message_identifier: ' message@example.test ',
    deep_link: 'message://%3Cmessage%40example.test%3E',
    retirement_destination_identifier: ' Archive ',
    source_title: ' Project update ',
    ...overrides,
  };
}

function settings() {
  return {
    id: ownerId,
    owner_id: ownerId,
    planning_timezone: 'America/Los_Angeles',
  };
}

describe('Tasks Mail MCP tool', () => {
  it('advertises a narrow idempotent integration mutation', () => {
    expect(createMailTask.name).toBe('create_mail_task');
    expect(createMailTask.annotations).toEqual({
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it('normalizes and submits an unassigned Today Mail capture atomically', async () => {
    const client = clientFor({ tasks_user_settings: [settings()] });

    await expect(createMailTaskData(request(), authFor(client))).resolves.toEqual({
      idempotency_outcome: 'created',
    });

    expect(client.rpc).toHaveBeenCalledOnce();
    const [name, args] = client.rpc.mock.calls[0];
    expect(name).toBe('tasks_create_mail_capture');
    expect(args).toMatchObject({
      _idempotency_key: '81000000-0000-4000-8000-000000000010',
      _title: 'Reply to the project update',
      _account_identifier: 'Work',
      _mailbox_identifier: 'INBOX',
      _message_identifier: 'message@example.test',
      _retirement_destination_identifier: 'Archive',
      _source_title: 'Project update',
      _start_date: planningDateInTimeZone('America/Los_Angeles'),
      _area_id: null,
      _hierarchy_order_key: null,
    });
    expect(args._task_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(args._order_key).toBeTruthy();
  });

  it('assigns verified work Mail to an accessible area with independent order', async () => {
    const client = clientFor({
      tasks_user_settings: [settings()],
      tasks_areas: [{ id: areaId, owner_id: ownerId, disposition: 'present' }],
      tasks_todos: [{
        id: crypto.randomUUID(),
        owner_id: ownerId,
        area_id: areaId,
        project_id: null,
        heading_id: null,
        destination: 'today',
        today_section: 'daytime',
        start_date: planningDateInTimeZone('America/Los_Angeles'),
        lifecycle: 'open',
        disposition: 'present',
        order_key: 'a0',
        hierarchy_order_key: 'a0',
      }],
    });

    await createMailTaskData(request({ area_id: areaId }), authFor(client));

    expect(client.rpc.mock.calls[0][1]).toMatchObject({
      _area_id: areaId,
    });
    expect(client.rpc.mock.calls[0][1]._hierarchy_order_key).toBeTruthy();
  });

  it('rejects an inaccessible work area before calling the atomic service', async () => {
    const client = clientFor({ tasks_user_settings: [settings()] });

    await expect(createMailTaskData(request({ area_id: areaId }), authFor(client)))
      .rejects.toThrow('task area is unavailable');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('surfaces an atomic service rejection without a fallback write', async () => {
    const client = clientFor(
      { tasks_user_settings: [settings()] },
      { data: null, error: { message: 'Mail source conflict' } },
    );

    await expect(createMailTaskData(request(), authFor(client)))
      .rejects.toThrow('Mail source conflict');
    expect(client.rpc).toHaveBeenCalledOnce();
  });
});

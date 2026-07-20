import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedMcpContext } from '@/lib/mcp/supabase';

import {
  evaluateTaskRecurrence,
  evaluateTaskRecurrenceData,
  getTaskRecurrences,
  getTaskRecurrencesData,
  saveTaskRecurrence,
  saveTaskRecurrenceData,
  setTaskRecurrenceStatus,
} from './tasks-recurrence';

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
  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
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
const recurrenceId = '20000000-0000-4000-8000-000000000001';
const templateId = '30000000-0000-4000-8000-000000000001';

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

describe('Tasks recurrence MCP tools', () => {
  it('advertises explicit read, save, status, and evaluation operations', () => {
    expect(getTaskRecurrences.name).toBe('get_task_recurrences');
    expect(getTaskRecurrences.annotations.readOnlyHint).toBe(true);
    expect(saveTaskRecurrence.name).toBe('save_task_recurrence');
    expect(saveTaskRecurrence.annotations.idempotentHint).toBe(true);
    expect(setTaskRecurrenceStatus.name).toBe('set_task_recurrence_status');
    expect(evaluateTaskRecurrence.name).toBe('evaluate_task_recurrence');
  });

  it('returns owner-scoped live definitions with current rules and optional occurrences', async () => {
    const result = await getTaskRecurrencesData({
      include_archived: false,
      include_occurrences: true,
      limit: 50,
    }, authFor({
      tasks_recurrence_definitions: [
        { id: recurrenceId, owner_id: ownerId, name: 'Review', status: 'active', current_revision: 2 },
        { id: 'archived', owner_id: ownerId, name: 'Old', status: 'archived', current_revision: 1 },
        { id: 'other', owner_id: 'other-owner', name: 'Other', status: 'active', current_revision: 1 },
      ],
      tasks_recurrence_revisions: [
        { id: 'revision-1', owner_id: ownerId, recurrence_id: recurrenceId, revision: 1 },
        { id: 'revision-2', owner_id: ownerId, recurrence_id: recurrenceId, revision: 2 },
      ],
      tasks_recurrence_occurrences: [
        { id: 'occurrence-1', owner_id: ownerId, recurrence_id: recurrenceId, scheduled_date: '2026-07-20' },
      ],
    }));

    expect(result.recurrences).toHaveLength(1);
    expect(result.recurrences[0]).toMatchObject({
      id: recurrenceId,
      current_revision_record: { revision: 2 },
      occurrences: [{ id: 'occurrence-1' }],
    });
    expect(result.recurrences[0]).not.toHaveProperty('owner_id');
  });

  it('saves through the guarded RPC with explicit structured recurrence fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { outcome: 'accepted' }, error: null });
    const result = await saveTaskRecurrenceData({
      name: 'Review',
      template_id: templateId,
      rule_mode: 'after_completion',
      frequency: 'weekly',
      interval_count: 2,
      start_date: '2026-07-20',
      planning_timezone: 'America/Los_Angeles',
      missed_policy: 'latest',
      catch_up_limit: 50,
      idempotency_key: '40000000-0000-4000-8000-000000000001',
    }, authFor({}, rpc));

    expect(result).toEqual({ outcome: 'accepted' });
    expect(rpc).toHaveBeenCalledWith('tasks_save_recurrence', expect.objectContaining({
      _recurrence_id: null,
      _template_id: templateId,
      _rule_mode: 'after_completion',
      _frequency: 'weekly',
      _interval_count: 2,
      _mutation_channel: 'mcp',
      _actor_type: 'automation',
    }));
  });

  it('evaluates through an exact date and idempotency key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { generated_count: 1 }, error: null });
    const result = await evaluateTaskRecurrenceData({
      recurrence_id: recurrenceId,
      through_date: '2026-07-20',
      idempotency_key: '50000000-0000-4000-8000-000000000001',
    }, authFor({}, rpc));

    expect(result).toEqual({ generated_count: 1 });
    expect(rpc).toHaveBeenCalledWith('tasks_evaluate_recurrence', {
      _recurrence_id: recurrenceId,
      _through_date: '2026-07-20',
      _request_id: '50000000-0000-4000-8000-000000000001',
      _entry_channel: 'mcp',
      _actor_type: 'automation',
    });
  });
});

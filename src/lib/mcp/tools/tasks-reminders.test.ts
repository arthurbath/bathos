import { describe, expect, it, vi } from 'vitest';

import {
  cancelTaskReminderData,
  getTaskRemindersData,
  saveTaskReminderData,
} from './tasks-reminders';

class Query {
  constructor(private readonly rows: Record<string, unknown>[]) {}
  select() { return this; }
  eq(column: string, value: unknown) {
    return new Query(this.rows.filter((row) => row[column] === value));
  }
  in(column: string, values: unknown[]) {
    return new Query(this.rows.filter((row) => values.includes(row[column])));
  }
  order() { return this; }
  limit(count: number) {
    return Promise.resolve({ data: this.rows.slice(0, count), error: null });
  }
}

const reminder = {
  id: 'reminder-a', owner_id: 'owner-a', root_type: 'todo', task_id: 'task-a',
  project_id: null, local_date: '2026-07-20', local_time: '09:00:00',
  time_zone: 'America/Los_Angeles', ambiguity_choice: 'earlier',
  resolved_at: '2026-07-20T16:00:00Z', resolution_kind: 'exact', status: 'active',
  record_revision: 1, last_mutation_channel: 'web', last_actor_type: 'user',
  client_mutation_id: 'mutation-a', created_at: '2026-07-20T15:00:00Z',
  updated_at: '2026-07-20T15:00:00Z',
};

function auth(rpc = vi.fn()) {
  const tables: Record<string, Record<string, unknown>[]> = {
    tasks_reminders: [reminder, { ...reminder, id: 'other', owner_id: 'owner-b' }],
    tasks_reminder_occurrences: [{
      id: 'occurrence-a', owner_id: 'owner-a', reminder_id: reminder.id,
      reminder_revision: 1, resolved_at: reminder.resolved_at, status: 'scheduled',
      client_mutation_id: 'mutation-a', created_at: reminder.created_at,
    }],
  };
  return {
    userId: 'owner-a',
    supabase: {
      from: (name: string) => new Query(tables[name] ?? []),
      rpc,
    },
  } as never;
}

describe('task reminder MCP data', () => {
  it('reads owner-scoped reminders and optional occurrences', async () => {
    const result = await getTaskRemindersData({
      include_canceled: false,
      include_occurrences: true,
      limit: 10,
    }, auth());

    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0]).toMatchObject({
      id: reminder.id,
      root_id: 'task-a',
      occurrences: [{ id: 'occurrence-a' }],
    });
    expect(result.reminders[0]).not.toHaveProperty('owner_id');
  });

  it('saves and cancels through explicit idempotent RPCs', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { outcome: 'accepted' }, error: null })
      .mockResolvedValueOnce({ data: { outcome: 'accepted' }, error: null });
    const context = auth(rpc);
    await saveTaskReminderData({
      root_type: 'todo', root_id: 'task-a',
      local_time: '09:00', time_zone: 'America/Los_Angeles',
      ambiguity_choice: 'earlier', idempotency_key: 'mutation-a',
    }, context);
    await cancelTaskReminderData({
      reminder_id: 'reminder-a', expected_record_revision: 1,
      idempotency_key: 'mutation-b',
    }, context);

    expect(rpc).toHaveBeenNthCalledWith(1, 'tasks_save_start_reminder', expect.objectContaining({
      _root_type: 'todo', _mutation_channel: 'mcp', _actor_type: 'automation',
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'tasks_cancel_reminder', expect.objectContaining({
      _reminder_id: 'reminder-a', _expected_record_revision: 1,
    }));
  });
});

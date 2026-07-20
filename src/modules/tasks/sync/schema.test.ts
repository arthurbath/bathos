import { describe, expect, it } from 'vitest';

import { tasksPowerSyncSchema } from './schema';

describe('tasks PowerSync schema', () => {
  it('syncs tasks and accepted history while keeping diagnostics and owner binding local', () => {
    const schema = tasksPowerSyncSchema.toJSON() as {
      tables: Array<{ name: string; local_only: boolean; columns: Array<{ name: string }> }>;
    };
    const tables = Object.fromEntries(schema.tables.map((table) => [table.name, table]));

    expect(Object.keys(tables).sort()).toEqual([
      'tasks_history_events',
      'tasks_owner_binding',
      'tasks_sync_issues',
      'tasks_todos',
      'tasks_user_settings',
    ]);
    expect(tables.tasks_todos.local_only).toBe(false);
    expect(tables.tasks_history_events.local_only).toBe(false);
    expect(tables.tasks_user_settings.local_only).toBe(false);
    expect(tables.tasks_sync_issues.local_only).toBe(true);
    expect(tables.tasks_owner_binding.local_only).toBe(true);
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('client_mutation_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('undo_source_event_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('start_date');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('deadline');
    expect(tables.tasks_history_events.columns.map(({ name }) => name)).toContain('before_state');
    expect(tables.tasks_sync_issues.columns.map(({ name }) => name)).not.toContain('title');
    expect(tables.tasks_sync_issues.columns.map(({ name }) => name)).not.toContain('notes');
  });
});

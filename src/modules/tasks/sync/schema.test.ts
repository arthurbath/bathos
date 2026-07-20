import { describe, expect, it } from 'vitest';

import { tasksPowerSyncSchema } from './schema';

describe('tasks PowerSync schema', () => {
  it('syncs only task rows and keeps diagnostics and owner binding local', () => {
    const schema = tasksPowerSyncSchema.toJSON() as {
      tables: Array<{ name: string; local_only: boolean; columns: Array<{ name: string }> }>;
    };
    const tables = Object.fromEntries(schema.tables.map((table) => [table.name, table]));

    expect(Object.keys(tables).sort()).toEqual([
      'tasks_owner_binding',
      'tasks_sync_issues',
      'tasks_todos',
    ]);
    expect(tables.tasks_todos.local_only).toBe(false);
    expect(tables.tasks_sync_issues.local_only).toBe(true);
    expect(tables.tasks_owner_binding.local_only).toBe(true);
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('client_mutation_id');
    expect(tables.tasks_sync_issues.columns.map(({ name }) => name)).not.toContain('title');
    expect(tables.tasks_sync_issues.columns.map(({ name }) => name)).not.toContain('notes');
  });
});

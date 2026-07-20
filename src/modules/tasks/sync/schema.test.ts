import { describe, expect, it } from 'vitest';

import { tasksPowerSyncSchema } from './schema';

describe('tasks PowerSync schema', () => {
  it('syncs tasks and accepted history while keeping diagnostics and owner binding local', () => {
    const schema = tasksPowerSyncSchema.toJSON() as {
      tables: Array<{ name: string; local_only: boolean; columns: Array<{ name: string }> }>;
    };
    const tables = Object.fromEntries(schema.tables.map((table) => [table.name, table]));

    expect(Object.keys(tables).sort()).toEqual([
      'tasks_areas',
      'tasks_checklist_items',
      'tasks_headings',
      'tasks_hierarchy_history_events',
      'tasks_hierarchy_operations',
      'tasks_history_events',
      'tasks_owner_binding',
      'tasks_projects',
      'tasks_sync_issues',
      'tasks_todos',
      'tasks_user_settings',
    ]);
    expect(tables.tasks_todos.local_only).toBe(false);
    expect(tables.tasks_history_events.local_only).toBe(false);
    expect(tables.tasks_user_settings.local_only).toBe(false);
    expect(tables.tasks_areas.local_only).toBe(false);
    expect(tables.tasks_projects.local_only).toBe(false);
    expect(tables.tasks_headings.local_only).toBe(false);
    expect(tables.tasks_checklist_items.local_only).toBe(false);
    expect(tables.tasks_hierarchy_operations.local_only).toBe(false);
    expect(tables.tasks_hierarchy_history_events.local_only).toBe(false);
    expect(tables.tasks_sync_issues.local_only).toBe(true);
    expect(tables.tasks_owner_binding.local_only).toBe(true);
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('client_mutation_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('undo_source_event_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('start_date');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('deadline');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('today_section');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('project_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('deletion_root_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain(
      'hierarchy_order_key',
    );
    expect(tables.tasks_projects.columns.map(({ name }) => name)).toContain(
      'planning_order_key',
    );
    expect(tables.tasks_history_events.columns.map(({ name }) => name)).toContain('before_state');
    expect(tables.tasks_hierarchy_operations.columns.map(({ name }) => name)).toContain(
      'expected_revisions',
    );
    expect(tables.tasks_sync_issues.columns.map(({ name }) => name)).not.toContain('title');
    expect(tables.tasks_sync_issues.columns.map(({ name }) => name)).not.toContain('notes');
  });
});

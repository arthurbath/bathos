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
      'tasks_delivery_targets',
      'tasks_headings',
      'tasks_hierarchy_history_events',
      'tasks_hierarchy_operations',
      'tasks_history_events',
      'tasks_owner_binding',
      'tasks_projects',
      'tasks_recurrence_definitions',
      'tasks_recurrence_evaluations',
      'tasks_recurrence_occurrences',
      'tasks_recurrence_revisions',
      'tasks_recurrence_status_events',
      'tasks_reminder_claims',
      'tasks_reminder_deliveries',
      'tasks_reminder_occurrences',
      'tasks_reminders',
      'tasks_sync_health_events',
      'tasks_sync_issues',
      'tasks_template_instantiations',
      'tasks_template_revisions',
      'tasks_templates',
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
    expect(tables.tasks_templates.local_only).toBe(false);
    expect(tables.tasks_template_revisions.local_only).toBe(false);
    expect(tables.tasks_template_instantiations.local_only).toBe(false);
    expect(tables.tasks_recurrence_definitions.local_only).toBe(false);
    expect(tables.tasks_recurrence_revisions.local_only).toBe(false);
    expect(tables.tasks_recurrence_occurrences.local_only).toBe(false);
    expect(tables.tasks_recurrence_evaluations.local_only).toBe(false);
    expect(tables.tasks_recurrence_status_events.local_only).toBe(false);
    expect(tables.tasks_reminders.local_only).toBe(false);
    expect(tables.tasks_reminder_occurrences.local_only).toBe(false);
    expect(tables.tasks_delivery_targets.local_only).toBe(false);
    expect(tables.tasks_reminder_deliveries.local_only).toBe(false);
    expect(tables.tasks_reminder_claims.local_only).toBe(false);
    expect(tables.tasks_sync_issues.local_only).toBe(true);
    expect(tables.tasks_sync_health_events.local_only).toBe(true);
    expect(tables.tasks_owner_binding.local_only).toBe(true);
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('client_mutation_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('undo_source_event_id');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('start_date');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('deadline');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('today_section');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain('actionability');
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain(
      'template_instantiation_id',
    );
    expect(tables.tasks_todos.columns.map(({ name }) => name)).toContain(
      'recurrence_occurrence_id',
    );
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
    expect(tables.tasks_sync_health_events.columns.map(({ name }) => name)).toEqual([
      'state',
      'started_at',
      'resolved_at',
      'pending_upload_bucket',
      'had_completed_sync',
      'last_successful_sync_at',
      'reported_at',
    ]);
    expect(tables.tasks_sync_health_events.columns.map(({ name }) => name)).not.toContain(
      'owner_id',
    );
    expect(tables.tasks_sync_health_events.columns.map(({ name }) => name)).not.toContain(
      'task_id',
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
  getTaskSearchSourceKinds,
  type TaskSearchFilters,
} from './taskSearch';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const allFilters: TaskSearchFilters = {
  destination: 'all',
  lifecycle: 'all',
  actionability: 'all',
  sourceKind: 'all',
};

describe('task search documents', () => {
  it('indexes structured hierarchy once and searches normalized task context', () => {
    const documents = createTaskSearchDocuments([
      task({
        title: 'Replace sink valve',
        project_id: 'project-a',
        heading_id: 'heading-a',
      }),
    ], {
      areas: [],
      projects: [{ id: 'project-a', title: 'House' }],
      headings: [{ id: 'heading-a', title: 'Repairs' }],
    });

    expect(documents[0].hierarchyLabel).toBe('House / Repairs');
    expect(filterTaskSearchDocuments(documents, 'house / repairs', allFilters))
      .toHaveLength(1);
    expect(filterTaskSearchDocuments(documents, 'SINK VALVE'.toLocaleLowerCase(), allFilters))
      .toHaveLength(1);
  });

  it('combines typed filters and reports only available structured source kinds', () => {
    const documents = createTaskSearchDocuments([
      task({ id: 'mail', actionability: 'waiting', source_kind: 'mail_message' }),
      task({ id: 'web', destination: 'anytime', source_kind: 'webpage' }),
      task({ id: 'plain', source_kind: null }),
    ], { areas: [], projects: [], headings: [] });

    expect(filterTaskSearchDocuments(documents, '', {
      ...allFilters,
      actionability: 'waiting',
      sourceKind: 'mail_message',
    }).map(({ task: value }) => value.id)).toEqual(['mail']);
    expect(filterTaskSearchDocuments(documents, '', {
      ...allFilters,
      sourceKind: 'none',
    }).map(({ task: value }) => value.id)).toEqual(['plain']);
    expect(getTaskSearchSourceKinds(documents)).toEqual(['mail_message', 'webpage']);
  });
});

function task(overrides: Partial<TaskTodo> = {}): TaskTodo {
  return {
    id: 'task-a',
    owner_id: 'owner-a',
    area_id: null,
    project_id: null,
    heading_id: null,
    title: 'Synthetic task',
    notes: 'Synthetic notes',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'today',
    today_section: 'daytime',
    actionability: 'actionable',
    order_key: 'a0',
    hierarchy_order_key: null,
    start_date: '2026-07-20',
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    undo_source_event_id: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    revision: 1,
    client_mutation_id: 'mutation-a',
    created_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

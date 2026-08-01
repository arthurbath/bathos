import { describe, expect, it } from 'vitest';

import { projectTaskBulkDrop } from '@/modules/tasks/domain/taskBulkDrop';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

function task(
  id: string,
  order: string,
  overrides: Partial<TaskTodo> = {},
): TaskTodo {
  return {
    id,
    owner_id: 'owner',
    title: id,
    notes: '',
    actionability: 'actionable',
    area_id: null,
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: null,
    order_key: order,
    upcoming_order_key: order,
    hierarchy_order_key: null,
    start_date: null,
    deadline: null,
    primary_link: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    last_operation_id: 'operation',
    undo_source_event_id: null,
    source_kind: null,
    source_url: null,
    source_title: null,
    source_external_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    recurrence_superseded_at: null,
    revision: 1,
    client_mutation_id: `mutation-${id}`,
    created_at: '2026-07-26T00:00:00.000Z',
    updated_at: '2026-07-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('projectTaskBulkDrop', () => {
  it('compacts a non-contiguous selection in visual order', () => {
    const result = projectTaskBulkDrop({
      tasks: [task('a', 'a'), task('b', 'b'), task('c', 'c'), task('d', 'd')],
      selectedTaskIds: new Set(['c', 'a']),
      targetTaskId: 'd',
      placement: 'after',
    });
    expect(result?.orderedTaskIds).toEqual(['b', 'd', 'a', 'c']);
  });

  it('clamps mixed automatic groups to their legal peer intervals', () => {
    const result = projectTaskBulkDrop({
      tasks: [
        task('ready-1', 'a'),
        task('waiting-1', 'b', { actionability: 'waiting' }),
        task('ready-2', 'c'),
        task('waiting-2', 'd', { actionability: 'waiting' }),
        task('target', 'e', { deadline: '2026-07-30' }),
      ],
      selectedTaskIds: new Set(['ready-2', 'waiting-2']),
      targetTaskId: 'target',
      placement: 'after',
      automaticSort: true,
    });
    expect(result?.orderedTaskIds).toEqual([
      'target',
      'ready-2',
      'ready-1',
      'waiting-2',
      'waiting-1',
    ]);
  });

  it('applies visible-bucket metadata without changing invisible metadata', () => {
    const source = task('source', 'a', { deadline: '2026-07-31', actionability: 'waiting' });
    const result = projectTaskBulkDrop({
      tasks: [source, task('target', 'b')],
      selectedTaskIds: new Set(['source']),
      targetTaskId: 'target',
      placement: 'after',
      patchesByTaskId: new Map([[
        'source',
        { start_date: '2026-08-01', today_section: null },
      ]]),
    });
    expect(result?.patches.find(({ taskId }) => taskId === 'source')?.patch).toMatchObject({
      start_date: '2026-08-01',
      today_section: null,
    });
    expect(source.deadline).toBe('2026-07-31');
    expect(source.actionability).toBe('waiting');
  });
});

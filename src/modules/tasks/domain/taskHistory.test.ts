import { describe, expect, it } from 'vitest';

import type { TaskTodo } from '@/modules/tasks/types/tasks';

import {
  createTaskUndoPatch,
  InvalidTaskHistoryError,
  parseTaskHistoryEvent,
  snapshotTask,
  UnsafeTaskUndoError,
  type TaskHistoryStorageRow,
} from './taskHistory';

const currentTask: TaskTodo = {
  id: 'task-a',
  owner_id: 'owner-a',
  title: 'Completed task',
  notes: '',
  lifecycle: 'completed',
  completed_at: '2026-07-20T04:30:00.000Z',
  canceled_at: null,
  disposition: 'present',
  deleted_at: null,
  destination: 'today',
  today_section: 'daytime',
  order_key: 'a0',
  start_date: null,
  deadline: null,
  entry_channel: 'web',
  last_mutation_channel: 'web',
  last_actor_type: 'user',
  undo_source_event_id: null,
  source_kind: null,
  source_url: null,
  source_title: null,
  source_external_id: null,
  revision: 2,
  client_mutation_id: 'mutation-b',
  created_at: '2026-07-20T04:00:00.000Z',
  updated_at: '2026-07-20T04:30:00.000Z',
};

function historyRow(overrides: Partial<TaskHistoryStorageRow> = {}): TaskHistoryStorageRow {
  const before = { ...snapshotTask(currentTask), lifecycle: 'open', completed_at: null };
  return {
    id: 'event-b',
    owner_id: 'owner-a',
    task_id: 'task-a',
    client_mutation_id: 'mutation-b',
    actor_type: 'user',
    mutation_channel: 'web',
    affected_ids: JSON.stringify(['task-a']),
    base_revision: 1,
    result_revision: 2,
    transition: 'complete',
    occurred_at: '2026-07-20T04:30:00.000Z',
    outcome: 'accepted',
    code: null,
    before_state: JSON.stringify(before),
    after_state: JSON.stringify(snapshotTask(currentTask)),
    ...overrides,
  };
}

describe('task history', () => {
  it('parses synchronized JSON snapshots and creates the inverse patch', () => {
    const event = parseTaskHistoryEvent(historyRow({
      after_state: JSON.stringify({
        source_url: null,
        title: 'Completed task',
        order_key: 'a0',
        lifecycle: 'completed',
        notes: '',
        completed_at: '2026-07-20T04:30:00.000Z',
        canceled_at: null,
        disposition: 'present',
        deleted_at: null,
        destination: 'today',
        today_section: 'daytime',
        source_kind: null,
        source_title: null,
        source_external_id: null,
      }),
    }));

    expect(event.affected_ids).toEqual(['task-a']);
    expect(createTaskUndoPatch(currentTask, event)).toMatchObject({
      lifecycle: 'open',
      completed_at: null,
      title: 'Completed task',
    });
  });

  it('rejects undo when the task advanced beyond the selected event', () => {
    const event = parseTaskHistoryEvent(historyRow());

    expect(() => createTaskUndoPatch({ ...currentTask, revision: 3 }, event)).toThrow(
      UnsafeTaskUndoError,
    );
  });

  it('rejects creation, baseline, foreign, and state-mismatched events', () => {
    expect(() => createTaskUndoPatch(
      currentTask,
      parseTaskHistoryEvent(historyRow({ transition: 'create', before_state: null })),
    )).toThrow(UnsafeTaskUndoError);
    expect(() => createTaskUndoPatch(
      currentTask,
      parseTaskHistoryEvent(historyRow({ owner_id: 'owner-b' })),
    )).toThrow(UnsafeTaskUndoError);
    expect(() => createTaskUndoPatch(
      currentTask,
      parseTaskHistoryEvent(historyRow({ after_state: JSON.stringify({
        ...snapshotTask(currentTask),
        title: 'Different task',
      }) })),
    )).toThrow(UnsafeTaskUndoError);
  });

  it('rejects malformed synchronized history', () => {
    expect(() => parseTaskHistoryEvent(historyRow({ before_state: '{' }))).toThrow(
      InvalidTaskHistoryError,
    );
    expect(() => parseTaskHistoryEvent(historyRow({ actor_type: 'intruder' }))).toThrow(
      'invalid actor type',
    );
  });
});

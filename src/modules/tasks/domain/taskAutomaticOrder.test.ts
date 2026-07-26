import { describe, expect, it } from 'vitest';

import {
  compareTaskAutomaticOrder,
  getAutomaticTaskDropTarget,
} from '@/modules/tasks/domain/taskAutomaticOrder';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

describe('automatic task list ordering', () => {
  it('sorts Deadline, Horizon, Actionability, then manual order', () => {
    const tasks = [
      taskTodoFixture({
        id: 'no-deadline',
        deadline: null,
        today_section: 'inbox',
        actionability: 'actionable',
        order_key: 'a0',
      }),
      taskTodoFixture({
        id: 'future',
        deadline: '2026-07-28',
        today_section: 'inbox',
        actionability: 'actionable',
        order_key: 'a0',
      }),
      taskTodoFixture({
        id: 'overdue-waiting',
        deadline: '2026-07-24',
        today_section: 'inbox',
        actionability: 'waiting',
        order_key: 'a0',
      }),
      taskTodoFixture({
        id: 'overdue-rechecking',
        deadline: '2026-07-24',
        today_section: 'inbox',
        actionability: 'rechecking',
        order_key: 'a0',
      }),
      taskTodoFixture({
        id: 'overdue-ready-later-manual-second',
        deadline: '2026-07-24',
        today_section: 'later',
        actionability: 'actionable',
        order_key: 'a2',
      }),
      taskTodoFixture({
        id: 'overdue-ready-later-manual-first',
        deadline: '2026-07-24',
        today_section: 'later',
        actionability: 'actionable',
        order_key: 'a1',
      }),
      taskTodoFixture({
        id: 'today',
        deadline: '2026-07-26',
        today_section: 'inbox',
        actionability: 'actionable',
        order_key: 'a0',
      }),
    ];

    expect(tasks.sort(compareTaskAutomaticOrder).map(({ id }) => id)).toEqual([
      'overdue-rechecking',
      'overdue-waiting',
      'overdue-ready-later-manual-first',
      'overdue-ready-later-manual-second',
      'today',
      'future',
      'no-deadline',
    ]);
  });

  it('allows same-Area drops only among exact automatic-order peers', () => {
    const dragged = taskTodoFixture({
      id: 'dragged',
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'rechecking',
    });
    const peer = taskTodoFixture({
      id: 'peer',
      deadline: '2026-07-26',
      today_section: 'now',
      actionability: 'rechecking',
    });
    const different = taskTodoFixture({
      id: 'different',
      deadline: '2026-07-27',
      today_section: 'now',
      actionability: 'rechecking',
    });

    expect(getAutomaticTaskDropTarget(
      dragged,
      peer,
      [peer, different],
      'after',
      false,
    )).toEqual({ targetTaskId: 'peer', placement: 'after' });
    expect(getAutomaticTaskDropTarget(
      dragged,
      different,
      [peer, different],
      'before',
      false,
    )).toBeNull();
  });

  it('projects cross-Area drops to the canonical tuple boundary', () => {
    const dragged = taskTodoFixture({
      id: 'dragged',
      deadline: '2026-07-26',
      today_section: 'next',
      actionability: 'actionable',
    });
    const earlier = taskTodoFixture({
      id: 'earlier',
      deadline: '2026-07-25',
      today_section: 'inbox',
      actionability: 'actionable',
    });
    const later = taskTodoFixture({
      id: 'later',
      deadline: null,
      today_section: null,
      actionability: 'waiting',
    });

    expect(getAutomaticTaskDropTarget(
      dragged,
      earlier,
      [earlier, later],
      'after',
      true,
    )).toEqual({ targetTaskId: 'later', placement: 'before' });
  });
});

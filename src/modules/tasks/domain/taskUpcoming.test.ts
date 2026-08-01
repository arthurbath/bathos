import { describe, expect, it } from 'vitest';

import {
  getTaskUpcomingDate,
  getTaskUpcomingSections,
} from './taskUpcoming';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';

describe('task Upcoming projection', () => {
  it('gives a future Start precedence over the Deadline', () => {
    expect(getTaskUpcomingDate({
      start_date: '2026-08-03',
      deadline: '2026-08-01',
    }, '2026-07-26')).toBe('2026-08-03');
  });

  it('uses a future Deadline as an implicit controlling date without a Start', () => {
    expect(getTaskUpcomingDate({
      start_date: null,
      deadline: '2026-08-01',
    }, '2026-07-26')).toBe('2026-08-01');
  });

  it('stops projecting a deadline-only task once its Deadline is reached', () => {
    expect(getTaskUpcomingDate({
      start_date: null,
      deadline: '2026-08-01',
    }, '2026-08-01')).toBeNull();
  });

  it('groups tasks by controlling date without a Project root', () => {
    const sections = getTaskUpcomingSections([
      taskTodoFixture({ id: 'later', start_date: '2026-07-29' }),
      taskTodoFixture({ id: 'sooner', start_date: '2026-07-27' }),
    ], '2026-07-26', 'en-US');

    expect(sections.map(({ date }) => date)).toEqual(['2026-07-27', '2026-07-29']);
    expect(sections.flatMap(({ entries }) => entries.map(({ item }) => item.id)))
      .toEqual(['sooner', 'later']);
  });
});

import { describe, expect, it } from 'vitest';

import {
  compareTaskUpcomingSectionRows,
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

  it('orders month rows by effective Start before stable Upcoming rank', () => {
    const rows = [
      { id: 'late-first-rank', controllingDate: '2026-08-20', orderKey: 'a0' },
      { id: 'early-second-rank', controllingDate: '2026-08-10', orderKey: 'a1' },
      { id: 'early-first-rank', controllingDate: '2026-08-10', orderKey: 'a0' },
    ];

    expect(rows.sort((left, right) => (
      compareTaskUpcomingSectionRows('month', left, right)
    )).map(({ id }) => id)).toEqual([
      'early-first-rank',
      'early-second-rank',
      'late-first-rank',
    ]);
  });

  it('preserves stable manual rank inside individual day buckets', () => {
    const rows = [
      { id: 'earlier-date-late-rank', controllingDate: '2026-08-10', orderKey: 'a1' },
      { id: 'later-date-first-rank', controllingDate: '2026-08-11', orderKey: 'a0' },
    ];

    expect(rows.sort((left, right) => (
      compareTaskUpcomingSectionRows('day', left, right)
    )).map(({ id }) => id)).toEqual([
      'later-date-first-rank',
      'earlier-date-late-rank',
    ]);
  });
});

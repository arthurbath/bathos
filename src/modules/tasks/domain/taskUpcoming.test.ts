import { describe, expect, it } from 'vitest';

import {
  getTaskUpcomingDate,
  getTaskUpcomingGroup,
  getTaskUpcomingSections,
} from '@/modules/tasks/domain/taskUpcoming';
import {
  taskProjectFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';

describe('task Upcoming derivation', () => {
  const planningDate = '2026-07-22';

  it('prefers a future start and otherwise falls back to a future deadline', () => {
    expect(getTaskUpcomingDate({
      start_date: '2026-08-10',
      deadline: '2026-08-01',
    }, planningDate)).toBe('2026-08-10');
    expect(getTaskUpcomingDate({
      start_date: planningDate,
      deadline: '2026-08-01',
    }, planningDate)).toBe('2026-08-01');
    expect(getTaskUpcomingDate({
      start_date: null,
      deadline: planningDate,
    }, planningDate)).toBeNull();
  });

  it('groups the next seven dates by day, the next 12 months by month, then by year', () => {
    expect(getTaskUpcomingGroup('2026-07-23', planningDate, 'en-US')).toMatchObject({
      key: 'day:2026-07-23',
      label: 'Thursday, July 23',
      kind: 'day',
    });
    expect(getTaskUpcomingGroup('2026-07-29', planningDate, 'en-US').key)
      .toBe('day:2026-07-29');
    expect(getTaskUpcomingGroup('2026-07-30', planningDate, 'en-US')).toMatchObject({
      key: 'month:2026-07',
      label: 'July 2026',
      kind: 'month',
    });
    expect(getTaskUpcomingGroup('2027-07-22', planningDate, 'en-US').key)
      .toBe('month:2027-07');
    expect(getTaskUpcomingGroup('2027-07-23', planningDate, 'en-US')).toMatchObject({
      key: 'year:2027',
      label: '2027',
      kind: 'year',
    });
  });

  it('clamps the 12-month boundary for leap-day planning dates', () => {
    expect(getTaskUpcomingGroup('2025-02-28', '2024-02-29', 'en-US').kind).toBe('month');
    expect(getTaskUpcomingGroup('2025-03-01', '2024-02-29', 'en-US').kind).toBe('year');
  });

  it('orders projects and to-dos together from the nearest exact date to the latest', () => {
    const sections = getTaskUpcomingSections([
      taskProjectFixture({ id: 'project-late', start_date: '2026-08-05' }),
      taskProjectFixture({ id: 'project-equal', start_date: '2026-08-01' }),
    ], [
      taskTodoFixture({ id: 'task-near', start_date: '2026-07-23' }),
      taskTodoFixture({ id: 'task-later-july', start_date: '2026-07-30' }),
      taskTodoFixture({ id: 'task-equal', start_date: '2026-08-01' }),
      taskTodoFixture({ id: 'task-latest', start_date: '2026-09-01' }),
    ], planningDate, 'en-US');

    expect(sections.map(({ label }) => label)).toEqual([
      'Thursday, July 23',
      'July 2026',
      'August 2026',
      'September 2026',
    ]);
    expect(sections.flatMap(({ entries }) => entries.map(({ item }) => item.id))).toEqual([
      'task-near',
      'task-later-july',
      'project-equal',
      'task-equal',
      'project-late',
      'task-latest',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  assertTaskCalendarRange,
  addTaskCalendarDays,
  isTaskCalendarDate,
  isTaskPlanningTimeZone,
  normalizeTaskCalendarDate,
  taskCalendarDateInTimeZone,
} from '@/modules/tasks/domain/taskDates';

describe('task calendar dates', () => {
  it('accepts real ISO calendar dates without converting them to instants', () => {
    expect(isTaskCalendarDate('2028-02-29')).toBe(true);
    expect(normalizeTaskCalendarDate(' 2028-02-29 ', 'Start date')).toBe('2028-02-29');
  });

  it('derives one calendar day from the canonical planning time zone', () => {
    const instant = new Date('2026-07-20T06:30:00.000Z');
    expect(taskCalendarDateInTimeZone('America/Los_Angeles', instant)).toBe('2026-07-19');
    expect(taskCalendarDateInTimeZone('America/New_York', instant)).toBe('2026-07-20');
  });

  it('validates IANA planning time zones', () => {
    expect(isTaskPlanningTimeZone('America/Los_Angeles')).toBe(true);
    expect(isTaskPlanningTimeZone('Not/A_Time_Zone')).toBe(false);
    expect(() => taskCalendarDateInTimeZone('Not/A_Time_Zone')).toThrow(
      'A valid planning time zone and instant are required',
    );
  });

  it('rejects malformed and impossible dates', () => {
    expect(isTaskCalendarDate('2027-02-29')).toBe(false);
    expect(isTaskCalendarDate('07/19/2026')).toBe(false);
    expect(() => normalizeTaskCalendarDate('2026-13-01', 'Deadline')).toThrow(
      'Deadline must be a valid calendar date',
    );
  });

  it('normalizes a cleared field to null', () => {
    expect(normalizeTaskCalendarDate('', 'Start date')).toBeNull();
    expect(normalizeTaskCalendarDate(null, 'Start date')).toBeNull();
    expect(normalizeTaskCalendarDate(undefined, 'Start date')).toBeUndefined();
  });

  it('permits either date alone and rejects a deadline before the start date', () => {
    expect(() => assertTaskCalendarRange(null, '2026-07-19')).not.toThrow();
    expect(() => assertTaskCalendarRange('2026-07-19', null)).not.toThrow();
    expect(() => assertTaskCalendarRange('2026-07-19', '2026-07-19')).not.toThrow();
    expect(() => assertTaskCalendarRange('2026-07-20', '2026-07-19')).toThrow(
      'Deadline cannot be earlier than the start date',
    );
  });

  it('adds whole calendar days across month, year, and leap-day boundaries', () => {
    expect(addTaskCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addTaskCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addTaskCalendarDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

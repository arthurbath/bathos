import { describe, expect, it } from 'vitest';

import {
  assertTaskCalendarRange,
  addTaskCalendarDays,
  formatTaskCompactCalendarDayOffset,
  formatTaskDateControlLabel,
  formatTaskRelativeCalendarDate,
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
      "Deadline cannot be earlier than Start",
    );
  });

  it('adds whole calendar days across month, year, and leap-day boundaries', () => {
    expect(addTaskCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addTaskCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addTaskCalendarDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('summarizes nearby dates relative to the owner planning date', () => {
    const planningDate = '2026-07-22';
    expect(formatTaskRelativeCalendarDate('2026-07-22', planningDate, 'en-US')).toBe('Today');
    expect(formatTaskRelativeCalendarDate('2026-07-23', planningDate, 'en-US')).toBe('Tomorrow');
    expect(formatTaskRelativeCalendarDate('2026-07-21', planningDate, 'en-US')).toBe('1 day ago');
    expect(formatTaskRelativeCalendarDate('2026-07-28', planningDate, 'en-US')).toBe('6 days left');
    expect(formatTaskRelativeCalendarDate('2026-07-31', planningDate, 'en-US')).toBe('9 days left');
    expect(formatTaskRelativeCalendarDate('2026-07-13', planningDate, 'en-US')).toBe('9 days ago');
  });

  it('uses short month and day outside the 9-day relative window', () => {
    expect(formatTaskRelativeCalendarDate('2026-08-01', '2026-07-22', 'en-US')).toBe('Aug 1');
    expect(formatTaskRelativeCalendarDate('2026-07-12', '2026-07-22', 'en-US')).toBe('Jul 12');
    expect(formatTaskRelativeCalendarDate('2026-08-27', '2026-07-22', 'en-US')).toBe('Aug 27');
    expect(formatTaskRelativeCalendarDate('2026-07-11', '2026-07-22', 'en-US')).toBe('Jul 11');
  });

  it('formats compact signed offsets within 9 days and short dates beyond that window', () => {
    const planningDate = '2026-07-22';
    expect(formatTaskCompactCalendarDayOffset('2026-07-22', planningDate)).toBe('Today');
    expect(formatTaskCompactCalendarDayOffset('2026-07-23', planningDate)).toBe('1 day');
    expect(formatTaskCompactCalendarDayOffset('2026-07-21', planningDate)).toBe('-1 day');
    expect(formatTaskCompactCalendarDayOffset('2026-07-26', planningDate)).toBe('4 days');
    expect(formatTaskCompactCalendarDayOffset('2026-07-18', planningDate)).toBe('-4 days');
    expect(formatTaskCompactCalendarDayOffset('2026-07-31', planningDate)).toBe('9 days');
    expect(formatTaskCompactCalendarDayOffset('2026-07-13', planningDate)).toBe('-9 days');
    expect(formatTaskCompactCalendarDayOffset('2026-08-01', planningDate, 'en-US')).toBe('Aug 1');
    expect(formatTaskCompactCalendarDayOffset('2026-07-12', planningDate, 'en-US')).toBe('Jul 12');
    expect(formatTaskCompactCalendarDayOffset('2026-08-27', planningDate, 'en-US')).toBe('Aug 27');
  });

  it('masks only yesterday, today, and tomorrow in date-control labels', () => {
    const planningDate = '2026-07-22';
    expect(formatTaskDateControlLabel('2026-07-21', planningDate, 'en-US')).toBe('Yesterday');
    expect(formatTaskDateControlLabel('2026-07-22', planningDate, 'en-US')).toBe('Today');
    expect(formatTaskDateControlLabel('2026-07-23', planningDate, 'en-US')).toBe('Tomorrow');
    expect(formatTaskDateControlLabel('2026-07-24', planningDate, 'en-US')).toBe('Jul 24, 2026');
  });
});

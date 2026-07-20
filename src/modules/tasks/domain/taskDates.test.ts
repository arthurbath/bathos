import { describe, expect, it } from 'vitest';

import {
  assertTaskCalendarRange,
  isTaskCalendarDate,
  normalizeTaskCalendarDate,
} from '@/modules/tasks/domain/taskDates';

describe('task calendar dates', () => {
  it('accepts real ISO calendar dates without converting them to instants', () => {
    expect(isTaskCalendarDate('2028-02-29')).toBe(true);
    expect(normalizeTaskCalendarDate(' 2028-02-29 ', 'Start date')).toBe('2028-02-29');
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
});

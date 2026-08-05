import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  getTaskRecurrenceAnchorFromNextStart,
  getTaskRecurrenceDatePair,
  getTaskRecurrencePositionedDate,
  getTaskRecurrencePreviewDates,
  isTaskRecurrenceAnchorDate,
} from './taskRecurrenceDates';

describe('task recurrence previews', () => {
  it('previews multiple selected weekdays across interval weeks', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-27',
      frequency: 'weekly',
      intervalCount: 1,
      ruleConfig: { weekdays: [1, 3] },
      limit: 5,
    })).toEqual([
      '2026-07-27',
      '2026-07-29',
      '2026-08-03',
      '2026-08-05',
      '2026-08-10',
    ]);
  });

  it('previews ordinal monthly weekdays', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-27',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: {
        monthly_kind: 'ordinal_weekday',
        ordinal: -1,
        weekday: 1,
      },
      limit: 3,
    })).toEqual(['2026-07-27', '2026-08-31', '2026-09-28']);
  });

  it('previews explicit numbered and final calendar days', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-31',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: {
        monthly_kind: 'day_of_month',
        month_day: 31,
      },
      limit: 3,
    })).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-31',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: { monthly_kind: 'last_day' },
      limit: 3,
    })).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('previews ordinal weekday and weekend-day groups', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-01',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: {
        monthly_kind: 'ordinal_day_type',
        ordinal: -1,
        day_type: 'weekday',
      },
      limit: 3,
    })).toEqual(['2026-07-31', '2026-08-31', '2026-09-30']);
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-01',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: {
        monthly_kind: 'ordinal_day_type',
        ordinal: -1,
        day_type: 'weekend_day',
      },
      limit: 3,
    })).toEqual(['2026-07-26', '2026-08-30', '2026-09-27']);
  });

  it('previews fixed yearly calendar dates with end-of-month clamping', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-02-28',
      frequency: 'yearly',
      intervalCount: 1,
      ruleConfig: {
        yearly_kind: 'fixed_date',
        month: 2,
        month_day: 29,
      },
      limit: 4,
    })).toEqual(['2026-02-28', '2027-02-28', '2028-02-29', '2029-02-28']);
  });

  it('previews yearly ordinal weekdays', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-01',
      frequency: 'yearly',
      intervalCount: 1,
      ruleConfig: {
        yearly_kind: 'ordinal_weekday',
        month: 5,
        ordinal: 2,
        weekday: 7,
      },
      limit: 3,
    })).toEqual(['2026-05-10', '2027-05-09', '2028-05-14']);
  });

  it('previews the last day of a fixed month every year', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-01',
      frequency: 'yearly',
      intervalCount: 1,
      ruleConfig: {
        yearly_kind: 'last_day',
        month: 2,
      },
      limit: 3,
    })).toEqual(['2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('skips months that do not contain a requested fifth weekday', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-01',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: {
        monthly_kind: 'ordinal_weekday',
        ordinal: 5,
        weekday: 1,
      },
      limit: 3,
    })).toEqual(['2026-08-31', '2026-11-30', '2027-03-29']);
  });

  it('honors inclusive date and occurrence count endings', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-27',
      frequency: 'daily',
      intervalCount: 1,
      endMode: 'on_date',
      endOnDate: '2026-07-29',
      limit: 5,
    })).toEqual(['2026-07-27', '2026-07-28', '2026-07-29']);
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-07-27',
      frequency: 'daily',
      intervalCount: 1,
      endMode: 'after',
      endAfterCount: 2,
      limit: 5,
    })).toEqual(['2026-07-27', '2026-07-28']);
  });

  it('returns the requested number of cadence dates after an exclusive cutoff', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-08-09',
      frequency: 'weekly',
      intervalCount: 1,
      ruleConfig: { weekdays: [7] },
      afterDateExclusive: '2026-08-09',
      limit: 3,
    })).toEqual(['2026-08-16', '2026-08-23', '2026-08-30']);
  });

  it('derives Start-based and Deadline-based date pairs without changing the anchor', () => {
    expect(getTaskRecurrenceDatePair('2026-08-03', 'start', 6)).toEqual({
      startDate: '2026-08-03',
      deadline: '2026-08-09',
    });
    expect(getTaskRecurrenceDatePair('2026-08-09', 'deadline', 6)).toEqual({
      startDate: '2026-08-03',
      deadline: '2026-08-09',
    });
    expect(getTaskRecurrenceAnchorFromNextStart('2026-08-03', 'deadline', 6))
      .toBe('2026-08-09');
  });

  it('supports canonical monthly positions and skips missing typed ordinals', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-31',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: { version: 2, position: 31, day_type: 'day' },
      limit: 3,
    })).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-01',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: { version: 2, position: 5, day_type: 'monday' },
      limit: 3,
    })).toEqual(['2026-03-30', '2026-06-29', '2026-08-31']);
  });

  it('emits every selected yearly month in calendar order and honors interval years', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-01-01',
      frequency: 'yearly',
      intervalCount: 2,
      ruleConfig: {
        version: 2,
        months: [12, 3, 7],
        position: 'last',
        day_type: 'weekday',
      },
      limit: 6,
    })).toEqual([
      '2026-03-31',
      '2026-07-31',
      '2026-12-31',
      '2028-03-31',
      '2028-07-31',
      '2028-12-29',
    ]);
  });

  it('supports the maximum weekday and weekend-day positions', () => {
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-03-01',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: { version: 2, position: 23, day_type: 'weekday' },
      limit: 1,
    })).toEqual(['2026-07-31']);
    expect(getTaskRecurrencePreviewDates({
      startDate: '2026-05-01',
      frequency: 'monthly',
      intervalCount: 1,
      ruleConfig: { version: 2, position: 10, day_type: 'weekend_day' },
      limit: 1,
    })).toEqual(['2026-05-31']);
  });

  it('identifies only dates that can serve as configured cadence anchors', () => {
    expect(isTaskRecurrenceAnchorDate(
      '2026-08-05',
      'weekly',
      { version: 2, weekdays: [3, 5] },
    )).toBe(true);
    expect(isTaskRecurrenceAnchorDate(
      '2026-08-06',
      'weekly',
      { version: 2, weekdays: [3, 5] },
    )).toBe(false);
    expect(isTaskRecurrenceAnchorDate(
      '2026-09-05',
      'monthly',
      { version: 2, position: 5, day_type: 'day' },
    )).toBe(true);
    expect(isTaskRecurrenceAnchorDate(
      '2026-09-06',
      'monthly',
      { version: 2, position: 5, day_type: 'day' },
    )).toBe(false);
    expect(isTaskRecurrenceAnchorDate(
      '2026-12-31',
      'yearly',
      { version: 2, months: [3, 12], position: 'last', day_type: 'day' },
    )).toBe(true);
    expect(isTaskRecurrenceAnchorDate(
      '2026-11-30',
      'yearly',
      { version: 2, months: [3, 12], position: 'last', day_type: 'day' },
    )).toBe(false);
  });

  it('matches the PostgreSQL positioned-date evaluator across a Gregorian cycle', () => {
    const cases = [
      ['31', 'day'],
      ['last', 'day'],
      ['23', 'weekday'],
      ['10', 'weekend_day'],
      ['5', 'monday'],
      ['last', 'sunday'],
    ] as const;
    const lines: string[] = [];
    for (let year = 2000; year <= 2399; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (const [position, dayType] of [...cases].sort((left, right) => (
          left[1].localeCompare(right[1]) || left[0].localeCompare(right[0])
        ))) {
          const date = getTaskRecurrencePositionedDate(
            year,
            month,
            position === 'last' ? 'last' : Number(position),
            dayType,
          );
          lines.push(`${year}:${month}:${position}:${dayType}:${date ?? 'null'}`);
        }
      }
    }
    expect(createHash('sha256').update(lines.join('\n')).digest('hex')).toBe(
      'f8f516ff1e42d37dd7c56c21b370013cf7dd245689e58a26d9f4a109fb0e2131',
    );
  });
});

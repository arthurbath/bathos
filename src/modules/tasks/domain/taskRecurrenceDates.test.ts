import { describe, expect, it } from 'vitest';

import { getTaskRecurrencePreviewDates } from './taskRecurrenceDates';

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
});

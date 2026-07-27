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
});

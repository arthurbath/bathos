import { describe, expect, it } from 'vitest';

import {
  applyTaskCreationDraftPatch,
  createTaskCreationDraft,
  getFirstTodayTaskCreationPlacement,
  getFirstUpcomingTaskCreationPlacement,
  getTaskCreationInput,
} from './taskCreationDraft';

describe('task creation drafts', () => {
  it('uses canonical Today Now without a literal same-day start date', () => {
    const draft = createTaskCreationDraft('owner-a', 'today', '2026-07-22T12:00:00.000Z');
    expect(draft.task).toMatchObject({
      title: '',
      destination: 'anytime',
      today_section: 'now',
      start_date: null,
    });
  });

  it('uses view-safe defaults for Upcoming, Anytime, and Someday', () => {
    expect(createTaskCreationDraft('owner-a', 'upcoming').task).toMatchObject({
      destination: 'anytime',
      today_section: null,
    });
    expect(createTaskCreationDraft('owner-a', 'anytime').task).toMatchObject({
      destination: 'anytime',
      today_section: null,
    });
    expect(createTaskCreationDraft('owner-a', 'someday').task).toMatchObject({
      destination: 'someday',
      today_section: null,
    });
  });

  it('applies an exclusive contextual Today horizon or Upcoming Start', () => {
    expect(createTaskCreationDraft(
      'owner-a',
      'today',
      '2026-07-25T12:00:00.000Z',
      { todaySection: 'inbox' },
    ).task).toMatchObject({
      destination: 'anytime',
      today_section: 'inbox',
      start_date: null,
    });
    expect(createTaskCreationDraft(
      'owner-a',
      'upcoming',
      '2026-07-25T12:00:00.000Z',
      { startDate: '2026-08-01' },
    ).task).toMatchObject({
      destination: 'anytime',
      today_section: null,
      start_date: '2026-08-01',
    });
    expect(createTaskCreationDraft(
      'owner-a',
      'anytime',
      '2026-07-25T12:00:00.000Z',
      { areaId: 'area-work' },
    ).task).toMatchObject({
      destination: 'anytime',
      area_id: 'area-work',
      today_section: null,
      start_date: null,
    });
  });

  it('resolves first-bucket creation placements with stable empty-view fallbacks', () => {
    expect(getFirstTodayTaskCreationPlacement(['inbox', 'later'])).toEqual({
      todaySection: 'inbox',
    });
    expect(getFirstTodayTaskCreationPlacement([])).toEqual({
      todaySection: 'now',
    });
    expect(getFirstUpcomingTaskCreationPlacement('2026-08-01', '2026-07-25')).toEqual({
      startDate: '2026-08-01',
    });
    expect(getFirstUpcomingTaskCreationPlacement(null, '2026-07-31')).toEqual({
      startDate: '2026-08-01',
    });
  });

  it('carries metadata set before the title into one top-insert creation input', () => {
    const draft = applyTaskCreationDraftPatch(
      createTaskCreationDraft('owner-a', 'upcoming'),
      {
        title: 'Scheduled work',
        notes: 'Context',
        start_date: '2026-07-24',
        today_section: 'later',
      },
    );
    expect(getTaskCreationInput(draft)).toEqual({
      title: 'Scheduled work',
      notes: 'Context',
      destination: 'anytime',
      todaySection: null,
      startDate: '2026-07-24',
      deadline: null,
      primaryLink: null,
      actionability: 'actionable',
      areaId: null,
      atTop: true,
    });
  });
});

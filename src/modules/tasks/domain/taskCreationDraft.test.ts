import { describe, expect, it } from 'vitest';

import {
  applyTaskCreationDraftPatch,
  createTaskCreationDraft,
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

  it('carries metadata set before the title into one top-insert creation input', () => {
    const draft = applyTaskCreationDraftPatch(
      createTaskCreationDraft('owner-a', 'upcoming'),
      {
        title: 'Scheduled work',
        notes: 'Context',
        start_date: '2026-07-24',
        today_section: 'later',
        project_id: 'project-a',
      },
    );
    expect(getTaskCreationInput(draft)).toEqual({
      title: 'Scheduled work',
      notes: 'Context',
      destination: 'anytime',
      todaySection: 'later',
      startDate: '2026-07-24',
      deadline: null,
      primaryLink: null,
      actionability: 'actionable',
      areaId: null,
      projectId: 'project-a',
      atTop: true,
    });
  });
});

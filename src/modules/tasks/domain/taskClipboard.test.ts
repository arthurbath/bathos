import { describe, expect, it } from 'vitest';

import {
  TASK_CLIPBOARD_KIND,
  parseTaskClipboard,
  planTaskClipboardPaste,
  serializeTaskClipboard,
  type TaskClipboardSnapshot,
} from './taskClipboard';

const snapshot: TaskClipboardSnapshot = {
  title: 'Read the report',
  notes: 'Notes',
  primaryLink: 'https://example.com',
  destination: 'anytime',
  todaySection: 'later',
  startDate: null,
  deadline: '2026-07-30',
  actionability: 'waiting',
  areaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  projectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  checklist: [{ title: 'Open it', completed: true, orderKey: 'a0' }],
  reminder: {
    localTime: '18:30',
    timeZone: 'America/Los_Angeles',
    ambiguityChoice: 'earlier',
  },
  recurrence: null,
};

describe('task clipboard', () => {
  it('round-trips the versioned task envelope', () => {
    const result = parseTaskClipboard(serializeTaskClipboard('copy', [snapshot]));
    expect(result).toEqual({
      kind: 'tasks',
      envelope: {
        kind: TASK_CLIPBOARD_KIND,
        version: 1,
        operation: 'copy',
        tasks: [snapshot],
      },
    });
  });

  it('distinguishes ordinary text from malformed claimed task data', () => {
    expect(parseTaskClipboard('ordinary text')).toEqual({
      kind: 'text',
      title: 'ordinary text',
    });
    expect(parseTaskClipboard(JSON.stringify({
      kind: TASK_CLIPBOARD_KIND,
      version: 99,
      operation: 'copy',
      tasks: [],
    })).kind).toBe('invalid-task-payload');
  });

  it('applies Today planning and preserves future reminder intent', () => {
    const result = planTaskClipboardPaste(snapshot, { kind: 'today' }, {
      planningTimeZone: 'America/Los_Angeles',
      now: new Date('2026-07-24T20:00:00Z'),
    });
    expect(result).toMatchObject({
      destination: 'anytime',
      todaySection: 'inbox',
      startDate: null,
      reminder: snapshot.reminder,
    });
  });

  it('clears planning and reminder intent in Anytime and Someday', () => {
    expect(planTaskClipboardPaste(snapshot, { kind: 'anytime' }, {
      planningTimeZone: 'America/Los_Angeles',
    })).toMatchObject({
      destination: 'anytime',
      todaySection: null,
      startDate: null,
      reminder: null,
    });
    expect(planTaskClipboardPaste(snapshot, { kind: 'someday' }, {
      planningTimeZone: 'America/Los_Angeles',
    })).toMatchObject({
      destination: 'someday',
      todaySection: null,
      startDate: null,
      reminder: null,
    });
  });

  it('overrides organization in project and area destinations', () => {
    expect(planTaskClipboardPaste(snapshot, {
      kind: 'project',
      projectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      areaId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    }, {
      planningTimeZone: 'America/Los_Angeles',
    })).toMatchObject({
      areaId: null,
      projectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expect(planTaskClipboardPaste(snapshot, {
      kind: 'area',
      areaId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    }, {
      planningTimeZone: 'America/Los_Angeles',
    })).toMatchObject({
      areaId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      projectId: null,
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  classifyTaskDeparture,
  getTaskDepartureToast,
} from '@/modules/tasks/domain/taskDepartureNotice';

describe('task departure notices', () => {
  it('prefers a list move over quick-filter exclusion', () => {
    expect(classifyTaskDeparture({
      wasRendered: true,
      remainsInCurrentList: false,
      matchesCurrentFilter: false,
      currentFilter: 'waiting',
      destination: 'upcoming',
    })).toEqual({
      kind: 'moved',
      destination: 'upcoming',
    });
  });

  it('classifies a task that remains in its list but leaves the active filter', () => {
    expect(classifyTaskDeparture({
      wasRendered: true,
      remainsInCurrentList: true,
      matchesCurrentFilter: false,
      currentFilter: 'waiting',
      destination: 'today',
    })).toEqual({
      kind: 'filtered',
      filter: 'waiting',
    });
  });

  it('ignores tasks that were not rendered or remain eligible', () => {
    expect(classifyTaskDeparture({
      wasRendered: false,
      remainsInCurrentList: false,
      matchesCurrentFilter: false,
      currentFilter: 'waiting',
      destination: 'upcoming',
    })).toBeNull();
    expect(classifyTaskDeparture({
      wasRendered: true,
      remainsInCurrentList: true,
      matchesCurrentFilter: true,
      currentFilter: 'waiting',
      destination: 'today',
    })).toBeNull();
  });

  it('describes single list and filter departures with their destination or filter', () => {
    expect(getTaskDepartureToast([
      { kind: 'moved', destination: 'upcoming' },
    ], 'today')).toEqual({
      title: 'Task Moved',
      description: 'The task now appears in Upcoming.',
    });
    expect(getTaskDepartureToast([
      { kind: 'filtered', filter: 'waiting' },
    ], 'today')).toEqual({
      title: 'Task Hidden by Quick Filter',
      description: 'The task no longer matches Only Waiting.',
    });
  });

  it('summarizes a mixed bulk departure in one toast', () => {
    expect(getTaskDepartureToast([
      { kind: 'moved', destination: 'upcoming' },
      { kind: 'moved', destination: 'someday' },
      { kind: 'filtered', filter: 'waiting' },
    ], 'today')).toEqual({
      title: 'Tasks Updated',
      description: '2 tasks moved out of Today. 1 task no longer matches Only Waiting.',
    });
  });
});

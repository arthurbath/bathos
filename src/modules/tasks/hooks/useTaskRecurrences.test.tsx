import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskRecurrenceDefinitionFixture,
  taskRecurrenceOccurrenceFixture,
  taskRecurrenceRevisionFixture,
} from '@/modules/tasks/testing/taskFixtures';
import type {
  TaskRecurrenceDefinition,
  TaskRecurrenceOccurrence,
  TaskRecurrenceRevision,
} from '@/modules/tasks/types/tasks';
import { useTaskRecurrences } from './useTaskRecurrences';

const mocks = vi.hoisted(() => ({ useQuery: vi.fn(), useTasksRuntime: vi.fn() }));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));
vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

const planningTimeZone = 'America/Los_Angeles';
let definitionRows: TaskRecurrenceDefinition[];
let revisionRows: TaskRecurrenceRevision[];
let occurrenceRows: TaskRecurrenceOccurrence[];
let openOccurrenceRows: Array<{
  recurrence_id: string;
  root_id: string;
  scheduled_date: string;
  destination: string;
  today_section: string | null;
  start_date: string | null;
  deadline: string | null;
}>;

describe('useTaskRecurrences', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T00:30:00.000Z'));
    definitionRows = [];
    revisionRows = [];
    occurrenceRows = [];
    openOccurrenceRows = [];
    mocks.useQuery.mockReset().mockImplementation((query: string) => ({
      data: query.includes('SELECT occurrence.recurrence_id')
        ? openOccurrenceRows
        : query.includes('tasks_recurrence_revisions')
          ? revisionRows
          : query.includes('tasks_recurrence_definitions')
            ? definitionRows
            : occurrenceRows,
      isLoading: false,
      error: null,
    }));
  });

  afterEach(() => vi.useRealTimers());

  it('evaluates an active definition when its next prototype date has been reached', async () => {
    const stale = taskRecurrenceDefinitionFixture({
      evaluated_through_date: '2026-07-18',
      next_occurrence_date: '2026-07-19',
    });
    const evaluated = { ...stale, evaluated_through_date: '2026-07-19', record_revision: 2 };
    const recurrenceService = {
      evaluate: vi.fn().mockResolvedValue({
        outcome: 'accepted', status: 'active', through_date: '2026-07-19',
        generated_count: 1, occurrence_ids: ['occurrence-a'], definition: evaluated,
      }),
      createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn(),
    };
    definitionRows = [stale];
    revisionRows = [taskRecurrenceRevisionFixture()];
    occurrenceRows = [taskRecurrenceOccurrenceFixture()];
    mocks.useTasksRuntime.mockReturnValue({ mode: 'connected', planningTimeZone, recurrenceService });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    expect(result.current.planningDate).toBe('2026-07-19');
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(recurrenceService.evaluate).toHaveBeenCalledWith(stale.id, '2026-07-19');
    expect(result.current.definitions[0]).toEqual(evaluated);
  });

  it('keeps reached and subsequently deferred occurrence tasks ordinary', () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-calendar',
      next_occurrence_date: '2026-07-27',
    });
    definitionRows = [definition];
    revisionRows = [taskRecurrenceRevisionFixture({ recurrence_id: definition.id })];
    openOccurrenceRows = [{
      recurrence_id: definition.id,
      root_id: 'deferred-instance',
      scheduled_date: '2026-07-19',
      destination: 'anytime',
      today_section: null,
      start_date: '2026-07-20',
      deadline: null,
    }];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local', planningTimeZone,
      recurrenceService: { evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn() },
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    expect(result.current.openOccurrenceByDefinitionId.get(definition.id)?.root_id)
      .toBe('deferred-instance');
    expect(result.current.calendarPrototypes).toEqual([{
      definition,
      revision: revisionRows[0],
      scheduledDate: '2026-07-27',
    }]);
  });

  it('skips a legacy recurrence revision that has not received its prototype snapshot yet', () => {
    const definition = taskRecurrenceDefinitionFixture();
    definitionRows = [definition];
    revisionRows = [{
      ...taskRecurrenceRevisionFixture({ recurrence_id: definition.id }),
      prototype_snapshot: null,
    } as unknown as TaskRecurrenceRevision];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local', planningTimeZone,
      recurrenceService: { evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn() },
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    expect(result.current.revisions).toEqual(new Map());
    expect(consoleError).toHaveBeenCalledWith(
      'Tasks skipped an invalid synchronized recurrence revision',
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it('keeps an after-completion prototype in waiting while its ordinary instance is open', () => {
    const definition = taskRecurrenceDefinitionFixture({ next_occurrence_date: null });
    definitionRows = [definition];
    revisionRows = [taskRecurrenceRevisionFixture({ rule_mode: 'after_completion' })];
    openOccurrenceRows = [{
      recurrence_id: definition.id,
      root_id: 'open-instance',
      scheduled_date: '2026-07-19',
      destination: 'anytime',
      today_section: null,
      start_date: '2026-07-25',
      deadline: null,
    }];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local', planningTimeZone,
      recurrenceService: { evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn() },
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    expect(result.current.openOccurrenceDefinitionIds).toEqual(new Set([definition.id]));
    expect(result.current.calendarPrototypes).toEqual([]);
  });

  it('keeps recurrence mutations unavailable in local-only mode', async () => {
    const recurrenceService = {
      evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({ mode: 'local', planningTimeZone, recurrenceService });
    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    await expect(result.current.evaluate(taskRecurrenceDefinitionFixture())).rejects.toThrow(
      'Recurrence evaluation requires connected task storage',
    );
    expect(recurrenceService.evaluate).not.toHaveBeenCalled();
  });
});

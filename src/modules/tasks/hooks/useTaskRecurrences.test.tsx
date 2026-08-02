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

  it('evaluates through planning date when an early-Start prototype has been reached', async () => {
    const stale = taskRecurrenceDefinitionFixture({
      evaluated_through_date: '2026-07-18',
      next_occurrence_date: '2026-07-23',
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
    revisionRows = [taskRecurrenceRevisionFixture({ deadline_offset_days: 4 })];
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
    expect(result.current.datedPrototypes).toEqual([{
      definition,
      revision: revisionRows[0],
      scheduledDate: '2026-07-27',
    }]);
  });

  it('optimistically reorders a calendar prototype in Upcoming', async () => {
    const definition = taskRecurrenceDefinitionFixture({ upcoming_order_key: 'a0' });
    const updated = {
      ...definition,
      upcoming_order_key: 'a1',
      record_revision: definition.record_revision + 1,
    };
    definitionRows = [definition];
    revisionRows = [taskRecurrenceRevisionFixture({ recurrence_id: definition.id })];
    const recurrenceService = {
      evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn(),
      reorderProjection: vi.fn().mockResolvedValue({
        outcome: 'accepted', definition: updated,
      }),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected', planningTimeZone, recurrenceService,
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    await act(async () => {
      await result.current.reorderProjection(definition, 'a1');
    });

    expect(recurrenceService.reorderProjection).toHaveBeenCalledWith(definition, 'a1');
    expect(result.current.definitions[0]).toEqual(updated);
  });

  it('optimistically hides an archived prototype and restores it when deletion fails', async () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-delete-failure',
      next_occurrence_date: '2026-08-01',
    });
    definitionRows = [definition];
    revisionRows = [taskRecurrenceRevisionFixture({ recurrence_id: definition.id })];
    let rejectStatus!: (reason?: unknown) => void;
    const setStatus = vi.fn(() => new Promise<never>((_resolve, reject) => {
      rejectStatus = reject;
    }));
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      recurrenceService: {
        evaluate: vi.fn(),
        createFromTask: vi.fn(),
        edit: vi.fn(),
        setStatus,
        reorderProjection: vi.fn(),
      },
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    let deletion!: Promise<unknown>;
    await act(async () => {
      deletion = result.current.setStatus(definition, 'archived');
      await Promise.resolve();
    });
    expect(result.current.definitions).toEqual([]);

    await act(async () => {
      rejectStatus(new Error('write failed'));
      await expect(deletion).rejects.toThrow('write failed');
    });
    expect(result.current.definitions).toEqual([definition]);
  });

  it('retains the optimistic prototype rank while rebasing one revision conflict', async () => {
    const definition = taskRecurrenceDefinitionFixture({ upcoming_order_key: 'a0' });
    const conflicted = {
      ...definition,
      name: 'Updated Elsewhere',
      record_revision: definition.record_revision + 1,
      client_mutation_id: 'mutation-conflict',
    };
    const accepted = {
      ...conflicted,
      upcoming_order_key: 'a1',
      record_revision: conflicted.record_revision + 1,
      client_mutation_id: 'mutation-reorder',
    };
    definitionRows = [definition];
    revisionRows = [taskRecurrenceRevisionFixture({ recurrence_id: definition.id })];
    let resolveRetry!: (value: {
      outcome: 'accepted';
      definition: TaskRecurrenceDefinition;
    }) => void;
    const retryResult = new Promise<{
      outcome: 'accepted';
      definition: TaskRecurrenceDefinition;
    }>((resolve) => {
      resolveRetry = resolve;
    });
    const reorderProjection = vi.fn()
      .mockResolvedValueOnce({ outcome: 'conflict', definition: conflicted })
      .mockReturnValueOnce(retryResult);
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      recurrenceService: {
        evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn(),
        reorderProjection,
      },
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));
    let reorderRequest!: ReturnType<typeof result.current.reorderProjection>;
    await act(async () => {
      reorderRequest = result.current.reorderProjection(definition, 'a1');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(reorderProjection).toHaveBeenNthCalledWith(1, definition, 'a1');
    expect(reorderProjection).toHaveBeenNthCalledWith(2, conflicted, 'a1');
    expect(result.current.definitions[0]).toEqual({
      ...conflicted,
      upcoming_order_key: 'a1',
    });

    await act(async () => {
      resolveRetry({ outcome: 'accepted', definition: accepted });
      await reorderRequest;
    });
    expect(result.current.definitions[0]).toEqual(accepted);
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
    expect(result.current.datedPrototypes).toEqual([]);
  });

  it('dates an after-completion prototype once its completed instance yields a successor', () => {
    const definition = taskRecurrenceDefinitionFixture({
      id: 'recurrence-after-completion',
      next_occurrence_date: '2026-07-27',
    });
    const revision = taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      rule_mode: 'after_completion',
      deadline_offset_days: 3,
    });
    definitionRows = [definition];
    revisionRows = [revision];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local', planningTimeZone,
      recurrenceService: { evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn() },
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    expect(result.current.openOccurrenceDefinitionIds).toEqual(new Set());
    expect(result.current.datedPrototypes).toEqual([{
      definition,
      revision,
      scheduledDate: '2026-07-24',
    }]);
  });

  it('excludes a prototype whose projected Start has reached the planning date', () => {
    const definition = taskRecurrenceDefinitionFixture({
      next_occurrence_date: '2026-07-22',
    });
    definitionRows = [definition];
    revisionRows = [taskRecurrenceRevisionFixture({
      recurrence_id: definition.id,
      rule_mode: 'after_completion',
      deadline_offset_days: 3,
    })];
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local', planningTimeZone,
      recurrenceService: { evaluate: vi.fn(), createFromTask: vi.fn(), edit: vi.fn(), setStatus: vi.fn() },
    });

    const { result } = renderHook(() => useTaskRecurrences('owner-a'));

    expect(result.current.planningDate).toBe('2026-07-19');
    expect(result.current.datedPrototypes).toEqual([]);
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

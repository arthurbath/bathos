import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  taskProjectFixture,
  taskTemplateFixture,
  taskTemplateRevisionFixture,
  taskTodoFixture,
} from '@/modules/tasks/testing/taskFixtures';
import type {
  TaskProject,
  TaskTemplate,
  TaskTemplateRevision,
  TaskTodo,
} from '@/modules/tasks/types/tasks';
import { useTaskTemplates } from './useTaskTemplates';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

const planningTimeZone = 'America/Los_Angeles';
let templateRows: TaskTemplate[];
let revisionRows: TaskTemplateRevision[];
let todoRows: TaskTodo[];
let projectRows: TaskProject[];

describe('useTaskTemplates', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T00:30:00.000Z'));
    templateRows = [];
    revisionRows = [];
    todoRows = [taskTodoFixture()];
    projectRows = [taskProjectFixture()];
    mocks.useQuery.mockReset().mockImplementation((query: string) => ({
      data: query.includes('tasks_template_revisions')
        ? revisionRows
        : query.includes('tasks_templates')
          ? templateRows
          : query.includes('tasks_todos') ? todoRows : projectRows,
      isLoading: false,
      error: null,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the owner-local planning date as the default capture anchor', async () => {
    const template = taskTemplateFixture();
    const revision = taskTemplateRevisionFixture({ anchor_date: '2026-07-19' });
    const templateService = {
      capture: vi.fn().mockResolvedValue({ outcome: 'accepted', template, revision }),
      archive: vi.fn(),
      instantiate: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      templateService,
    });
    const { result } = renderHook(() => useTaskTemplates('owner-a'));

    expect(result.current.planningDate).toBe('2026-07-19');
    await act(async () => {
      await result.current.capture({
        sourceType: 'todo',
        sourceId: 'task-a',
        name: 'Daily Review',
      });
    });

    expect(templateService.capture).toHaveBeenCalledWith({
      sourceType: 'todo',
      sourceId: 'task-a',
      name: 'Daily Review',
      anchorDate: '2026-07-19',
    });
    expect(result.current.templates).toEqual([template]);
    expect(result.current.revisions.get(template.id)).toEqual(revision);
  });

  it('removes an archived template optimistically while preserving its source work', async () => {
    const template = taskTemplateFixture();
    const todo = taskTodoFixture();
    const project = taskProjectFixture();
    templateRows = [template];
    revisionRows = [taskTemplateRevisionFixture()];
    todoRows = [todo];
    projectRows = [project];
    const templateService = {
      capture: vi.fn(),
      archive: vi.fn().mockResolvedValue({
        outcome: 'accepted',
        template: { ...template, archived_at: '2026-07-20T00:31:00.000Z' },
      }),
      instantiate: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      planningTimeZone,
      templateService,
    });
    const { result } = renderHook(() => useTaskTemplates('owner-a'));

    await act(async () => {
      await result.current.archive(template);
    });

    expect(result.current.templates).toEqual([]);
    expect(result.current.todos).toEqual([todo]);
    expect(result.current.projects).toEqual([project]);
  });

  it('rejects template mutation before calling the service in local-only mode', async () => {
    const templateService = {
      capture: vi.fn(),
      archive: vi.fn(),
      instantiate: vi.fn(),
    };
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'local',
      planningTimeZone,
      templateService,
    });
    const { result } = renderHook(() => useTaskTemplates('owner-a'));

    await expect(result.current.capture({
      sourceType: 'todo',
      sourceId: 'task-a',
      name: 'Daily Review',
    })).rejects.toThrow('Template changes require connected task storage');
    expect(templateService.capture).not.toHaveBeenCalled();
  });
});

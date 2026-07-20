import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { TasksShell } from '@/modules/tasks/components/TasksShell';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const mockTaskList = vi.fn();
const mockTaskSearch = vi.fn();

vi.mock('@/modules/tasks/hooks/useTaskList', () => ({
  useTaskList: (...args: unknown[]) => mockTaskList(...args),
  getTodayTaskSection: (task: TaskTodo, planningDate: string) => (
    task.start_date !== null && task.start_date < planningDate ? 'unfinished' : task.today_section
  ),
}));
vi.mock('@/modules/tasks/hooks/useTaskSearch', () => ({
  useTaskSearch: (...args: unknown[]) => mockTaskSearch(...args),
}));
vi.mock('@/modules/tasks/hooks/useTaskHierarchy', () => ({
  useTaskHierarchy: () => ({
    areas: [], projects: [], headings: [], loading: false, error: null,
  }),
}));
vi.mock('@/modules/tasks/hooks/useTaskHierarchyTrash', () => ({
  useTaskHierarchyTrash: () => ({
    roots: [], loading: false, error: null, restore: vi.fn(),
  }),
}));
vi.mock('@/modules/tasks/hooks/useTaskReminders', () => ({
  useTaskReminders: () => ({
    reminders: [],
    byRootId: new Map(),
    dueItems: [],
    mode: 'local',
    planningTimeZone: 'America/Los_Angeles',
    loading: false,
    error: null,
    save: vi.fn(),
    cancel: vi.fn(),
    acknowledge: vi.fn(),
    claimDue: vi.fn(),
  }),
}));
vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => ({
    mode: 'local',
    syncState: 'local',
    pendingUploadCount: 0,
    planningTimeZone: 'America/Los_Angeles',
    prepareForSignOut: vi.fn(),
  }),
}));
vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: ({ title }: { title: string }) => <header>{title}</header>,
}));
vi.mock('@/platform/components/MobileBottomNav', () => ({
  MobileBottomNav: () => null,
}));
vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/tasks',
}));
vi.mock('@/modules/tasks/components/TaskProjectsView', () => ({
  TaskProjectsView: () => null,
}));
vi.mock('@/modules/tasks/components/TaskProjectDetailView', () => ({
  TaskProjectDetailView: () => null,
}));
vi.mock('@/modules/tasks/components/TaskTemplatesView', () => ({
  TaskTemplatesView: () => null,
}));

const describePerformance = process.env.RUN_TASKS_PERFORMANCE === '1' ? describe : describe.skip;

describePerformance('Tasks rendered-view performance', () => {
  it('renders a 1,000-row task view and opens 10,000-record search within budget', () => {
    const viewTasks = Array.from({ length: 1_000 }, (_, index) => syntheticTask(index));
    const searchTasks = Array.from({ length: 10_000 }, (_, index) => syntheticTask(index));
    mockTaskList.mockReturnValue({
      tasks: viewTasks,
      loading: false,
      error: null,
      createTask: vi.fn(),
      updateTask: vi.fn(),
      moveTask: vi.fn(),
      moveTasks: vi.fn(),
      reorderTask: vi.fn(),
      transitionTask: vi.fn(),
      planningDate: '2026-07-20',
    });
    mockTaskSearch.mockReturnValue({ tasks: searchTasks, loading: false, error: null });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      const renderStartedAt = performance.now();
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/tasks/today']}>
            <TasksShell userId="synthetic-owner" displayName="Synthetic" onSignOut={vi.fn()} />
          </MemoryRouter>,
        );
      });
      const renderMs = performance.now() - renderStartedAt;
      expect(container.querySelectorAll('[data-task-title-control]')).toHaveLength(1_000);
      expect(renderMs).toBeLessThan(2_000);

      container.querySelector<HTMLElement>('[data-task-title-control]')?.focus();
      const searchStartedAt = performance.now();
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: '/', bubbles: true, cancelable: true,
        }));
      });
      const searchOpenMs = performance.now() - searchStartedAt;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(dialog).toHaveAccessibleName('Search Tasks');
      expect(dialog?.textContent).toContain('Tasks (10000)');
      expect(dialog?.querySelectorAll('a[href^="/tasks/"]')).toHaveLength(28);
      expect(searchOpenMs).toBeLessThan(1_000);

      console.info(
        `[tasks-performance] rendered view: rows=1000 duration=${renderMs.toFixed(2)}ms`,
      );
      console.info(
        `[tasks-performance] search dialog: records=10000 duration=${searchOpenMs.toFixed(2)}ms`,
      );
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});

function syntheticTask(index: number): TaskTodo {
  return {
    id: `render-task-${index}`,
    owner_id: 'synthetic-owner',
    area_id: null,
    project_id: null,
    heading_id: null,
    title: `Rendered Synthetic Task ${index}`,
    notes: `Rendered synthetic notes ${index}`,
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'today',
    today_section: index % 5 === 0 ? 'evening' : 'daytime',
    actionability: index % 3 === 0 ? 'waiting' : 'actionable',
    order_key: `a${String(index).padStart(5, '0')}`,
    hierarchy_order_key: null,
    start_date: '2026-07-20',
    deadline: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    undo_source_event_id: null,
    source_kind: index % 4 === 0 ? 'mail_message' : null,
    source_url: index % 4 === 0 ? `message://synthetic-${index}` : null,
    source_title: index % 4 === 0 ? `Synthetic Source ${index}` : null,
    source_external_id: index % 4 === 0 ? `synthetic-${index}` : null,
    revision: 1,
    client_mutation_id: `render-mutation-${index}`,
    created_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
  };
}

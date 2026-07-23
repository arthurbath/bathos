// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  createTaskSearchDocuments,
  filterTaskSearchDocuments,
  type TaskSearchFilters,
} from '@/modules/tasks/domain/taskSearch';
import { deriveTaskViewTasks } from '@/modules/tasks/hooks/useTaskList';
import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import type { TaskDestination, TaskSourceKind, TaskTodo } from '@/modules/tasks/types/tasks';

const describePerformance = process.env.RUN_TASKS_PERFORMANCE === '1' ? describe : describe.skip;
const taskCount = 10_000;
const planningDate = '2026-07-20';
const ownerId = 'synthetic-owner';
const allFilters: TaskSearchFilters = {
  destination: 'all',
  lifecycle: 'all',
  actionability: 'all',
  sourceKind: 'all',
};

describePerformance('Tasks large-library performance', () => {
  const hierarchy = {
    areas: Array.from({ length: 100 }, (_, index) => ({
      id: `area-${index}`,
      title: `Area ${index}`,
    })),
    projects: Array.from({ length: 500 }, (_, index) => ({
      id: `project-${index}`,
      title: `Project ${index}`,
    })),
  };
  const tasks = Array.from({ length: taskCount }, (_, index) => syntheticTask(index));
  const searchableTasks = tasks.filter(({ disposition }) => disposition === 'present');
  const documents = createTaskSearchDocuments(searchableTasks, hierarchy);

  it('derives every task view within the large-library budget', () => {
    const views = ['today', 'upcoming', 'anytime', 'someday', 'done'] as const;
    for (const view of views) {
      const result = measure(`${view} view`, 20, () => deriveTaskViewTasks(
        tasks,
        ownerId,
        view,
        planningDate,
      ).length);
      expect(result.lastValue).toBeGreaterThan(0);
      expect(result.p95Ms).toBeLessThan(100);
    }
  });

  it('builds the reusable search index within budget', () => {
    const result = measure('search index', 12, () => (
      createTaskSearchDocuments(searchableTasks, hierarchy).length
    ));
    expect(result.lastValue).toBe(searchableTasks.length);
    expect(result.p95Ms).toBeLessThan(100);
  });

  it('searches text and structured filters within budget', () => {
    const textResult = measure('text query', 50, () => (
      filterTaskSearchDocuments(documents, 'needle saturn 9999', allFilters).length
    ));
    const filterResult = measure('structured filter', 50, () => (
      filterTaskSearchDocuments(documents, '', {
        ...allFilters,
        destination: 'anytime',
        actionability: 'waiting',
        sourceKind: 'mail_message',
      }).length
    ));

    expect(textResult.lastValue).toBe(1);
    expect(filterResult.lastValue).toBeGreaterThan(0);
    expect(textResult.p95Ms).toBeLessThan(50);
    expect(filterResult.p95Ms).toBeLessThan(50);
  });
});

function measure(label: string, runs: number, operation: () => number) {
  for (let warmup = 0; warmup < 3; warmup += 1) operation();
  const samples: number[] = [];
  let lastValue = 0;
  for (let run = 0; run < runs; run += 1) {
    const startedAt = performance.now();
    lastValue = operation();
    samples.push(performance.now() - startedAt);
  }
  samples.sort((left, right) => left - right);
  const medianMs = samples[Math.floor(samples.length / 2)];
  const p95Ms = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
  console.info(
    `[tasks-performance] ${label}: median=${medianMs.toFixed(2)}ms p95=${p95Ms.toFixed(2)}ms`,
  );
  return { lastValue, medianMs, p95Ms };
}

function syntheticTask(index: number): TaskTodo {
  const destinations: TaskDestination[] = ['anytime', 'someday'];
  const sourceKinds: Array<TaskSourceKind | null> = [
    null, 'mail_message', 'webpage', 'reading_item', 'file',
  ];
  const destination = destinations[index % destinations.length];
  const lifecycle = index % 10 === 0 ? 'completed' : index % 17 === 0 ? 'canceled' : 'open';
  const deleted = index % 37 === 0;
  const usesProject = index % 2 === 0;
  const taskId = `task-${String(index).padStart(5, '0')}`;
  const sourceKind = sourceKinds[index % sourceKinds.length];
  const startDate = destination === 'anytime'
    ? index % 7 === 0 ? '2026-08-01' : planningDate
    : null;

  return taskTodoFixture({
    id: taskId,
    owner_id: ownerId,
    area_id: usesProject ? null : `area-${index % 100}`,
    project_id: usesProject ? `project-${index % 500}` : null,
    title: index === 9_999 ? 'Needle Saturn 9999' : `Synthetic Task ${index}`,
    notes: `Performance notes for synthetic task ${index}`,
    lifecycle,
    completed_at: lifecycle === 'completed' ? `2026-07-19T${hour(index)}:00:00.000Z` : null,
    canceled_at: lifecycle === 'canceled' ? `2026-07-18T${hour(index)}:00:00.000Z` : null,
    disposition: deleted ? 'deleted' : 'present',
    deleted_at: deleted ? `2026-07-20T${hour(index)}:00:00.000Z` : null,
    deletion_root_id: deleted ? taskId : null,
    destination,
    today_section: startDate === null
      ? null
      : index % 7 === 0 ? 'later' : 'next',
    actionability: index % 3 === 0 ? 'waiting' : 'actionable',
    order_key: `a${String(index).padStart(5, '0')}`,
    hierarchy_order_key: null,
    start_date: startDate,
    deadline: index % 11 === 0 ? '2026-08-15' : null,
    source_kind: sourceKind,
    source_url: sourceKind ? `https://example.test/source/${index}` : null,
    source_title: sourceKind ? `Source ${index}` : null,
    source_external_id: sourceKind ? `external-${index}` : null,
    client_mutation_id: `mutation-${index}`,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: `2026-07-20T${hour(index)}:00:00.000Z`,
  });
}

function hour(index: number): string {
  return String(index % 24).padStart(2, '0');
}

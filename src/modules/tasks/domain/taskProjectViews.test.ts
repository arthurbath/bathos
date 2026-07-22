import { describe, expect, it } from 'vitest';

import type { TaskProject } from '@/modules/tasks/types/tasks';
import { deriveTaskViewProjects, getTodayProjectSection } from './taskProjectViews';

const planningDate = '2026-07-20';

describe('task project planning views', () => {
  it('derives active project views with owner-local availability semantics', () => {
    const projects = [
      project('today', { destination: 'anytime', today_section: 'next', start_date: planningDate }),
      project('now', { destination: 'anytime', today_section: 'now', start_date: '2026-07-19' }),
      project('future-today', { destination: 'anytime', today_section: 'now', start_date: '2026-07-22' }),
      project('due-inbox', { destination: 'anytime', today_section: 'none', start_date: planningDate }),
      project('anytime', { destination: 'anytime', start_date: null }),
      project('future-anytime', { destination: 'anytime', start_date: '2026-07-21' }),
      project('someday', { destination: 'someday', start_date: null }),
      project('other-owner', { owner_id: 'owner-b', destination: 'anytime', today_section: 'next' }),
    ];

    expect(deriveTaskViewProjects(projects, 'owner-a', 'today', planningDate)
      .map(({ id }) => id)).toEqual(['due-inbox', 'now', 'today']);
    expect(deriveTaskViewProjects(projects, 'owner-a', 'upcoming', planningDate)
      .map(({ id }) => id)).toEqual(['future-anytime', 'future-today']);
    expect(deriveTaskViewProjects(projects, 'owner-a', 'anytime', planningDate)
      .map(({ id }) => id)).toEqual(['anytime', 'due-inbox', 'now', 'today']);
    expect(deriveTaskViewProjects(projects, 'owner-a', 'someday', planningDate)
      .map(({ id }) => id)).toEqual(['someday']);
  });

  it('orders Today sections and terminal projects consistently', () => {
    const later = project('later', {
      destination: 'anytime',
      today_section: 'later',
      start_date: planningDate,
    });
    const completed = project('completed', {
      lifecycle: 'completed',
      completed_at: '2026-07-20T04:01:00.000Z',
    });
    const canceled = project('canceled', {
      lifecycle: 'canceled',
      canceled_at: '2026-07-20T04:02:00.000Z',
    });

    expect(getTodayProjectSection(later, planningDate)).toBe('later');
    expect(getTodayProjectSection(project('due', {
      today_section: 'none',
      start_date: planningDate,
    }), planningDate)).toBe('inbox');
    expect(deriveTaskViewProjects([completed, canceled], 'owner-a', 'done', planningDate)
      .map(({ id }) => id)).toEqual(['canceled', 'completed']);
  });
});

function project(id: string, patch: Partial<TaskProject> = {}): TaskProject {
  return {
    id,
    owner_id: 'owner-a',
    area_id: null,
    title: id,
    notes: '',
    lifecycle: 'open',
    completed_at: null,
    canceled_at: null,
    disposition: 'present',
    deleted_at: null,
    deletion_root_id: null,
    destination: 'anytime',
    today_section: 'none',
    order_key: `h-${id}`,
    planning_order_key: `p-${id}`,
    start_date: null,
    deadline: null,
    template_definition_id: null,
    template_revision: null,
    template_instantiation_id: null,
    template_node_id: null,
    recurrence_definition_id: null,
    recurrence_revision: null,
    recurrence_occurrence_id: null,
    recurrence_logical_key: null,
    entry_channel: 'web',
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    revision: 1,
    client_mutation_id: `mutation-${id}`,
    created_at: '2026-07-20T04:00:00.000Z',
    updated_at: '2026-07-20T04:00:00.000Z',
    ...patch,
  };
}

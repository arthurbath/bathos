import { describe, expect, it, vi } from 'vitest';

import {
  InvalidTaskRecurrenceError,
  parseTaskRecurrenceDefinition,
  parseTaskRecurrenceOccurrence,
  parseTaskRecurrenceRevision,
  TaskRecurrenceService,
} from './taskRecurrenceService';

const definition = {
  id: '10000000-0000-4000-8000-000000000001',
  owner_id: '20000000-0000-4000-8000-000000000001',
  name: 'Weekly Review',
  status: 'active',
  current_revision: 1,
  record_revision: 1,
  evaluated_through_date: null,
  next_occurrence_date: '2026-07-27',
  archived_at: null,
  last_mutation_channel: 'web',
  last_actor_type: 'user',
  client_mutation_id: '30000000-0000-4000-8000-000000000001',
  created_at: '2026-07-20T00:00:00Z',
  updated_at: '2026-07-20T00:00:00Z',
};

const revision = {
  id: '40000000-0000-4000-8000-000000000001',
  owner_id: definition.owner_id,
  recurrence_id: definition.id,
  revision: 1,
  name: definition.name,
  prototype_snapshot: {
    version: 2,
    kind: 'todo',
    root: {
      node_id: 'prototype-node',
      title: 'Weekly Review',
      notes: '',
      primary_link: null,
      actionability: 'actionable',
      destination: 'anytime',
      today_section: null,
      order_key: 'a0',
      start_offset_days: 0,
      deadline_offset_days: null,
      checklist: [],
    },
  },
  rule_mode: 'calendar',
  frequency: 'weekly',
  interval_count: 1,
  start_date: '2026-07-20',
  planning_timezone: 'America/Los_Angeles',
  missed_policy: 'latest',
  catch_up_limit: 50,
  target_area_id: null,
  client_mutation_id: definition.client_mutation_id,
  created_at: '2026-07-20T00:00:00Z',
};

describe('TaskRecurrenceService', () => {
  it('parses synchronized definitions, rules, and occurrence identities', () => {
    expect(parseTaskRecurrenceDefinition(definition).status).toBe('active');
    expect(parseTaskRecurrenceRevision(JSON.stringify(revision)).frequency).toBe('weekly');
    expect(parseTaskRecurrenceOccurrence({
      id: '60000000-0000-4000-8000-000000000001',
      owner_id: definition.owner_id,
      recurrence_id: definition.id,
      recurrence_revision: 1,
      logical_key: 'calendar:2026-07-20',
      scheduled_date: '2026-07-20',
      predecessor_occurrence_id: null,
      root_type: 'todo',
      root_id: '80000000-0000-4000-8000-000000000001',
      origin: 'generated',
      client_mutation_id: '60000000-0000-4000-8000-000000000001',
      generated_at: '2026-07-20T00:00:00Z',
    }).logical_key).toBe('calendar:2026-07-20');
  });

  it('parses explicit monthly calendar and day-type rules', () => {
    expect(parseTaskRecurrenceRevision({
      ...revision,
      frequency: 'monthly',
      rule_config: { monthly_kind: 'last_day' },
    }).rule_config).toEqual({ monthly_kind: 'last_day' });
    expect(parseTaskRecurrenceRevision({
      ...revision,
      frequency: 'monthly',
      rule_config: {
        monthly_kind: 'ordinal_day_type',
        ordinal: -1,
        day_type: 'weekend_day',
      },
    }).rule_config).toEqual({
      monthly_kind: 'ordinal_day_type',
      ordinal: -1,
      day_type: 'weekend_day',
    });
  });

  it('parses explicit yearly calendar, last-day, and ordinal-weekday rules', () => {
    expect(parseTaskRecurrenceRevision({
      ...revision,
      frequency: 'yearly',
      rule_config: {
        yearly_kind: 'fixed_date',
        month: 2,
        month_day: 29,
      },
    }).rule_config).toEqual({
      yearly_kind: 'fixed_date',
      month: 2,
      month_day: 29,
    });
    expect(parseTaskRecurrenceRevision({
      ...revision,
      frequency: 'yearly',
      rule_config: {
        yearly_kind: 'last_day',
        month: 10,
      },
    }).rule_config).toEqual({
      yearly_kind: 'last_day',
      month: 10,
    });
    expect(parseTaskRecurrenceRevision({
      ...revision,
      frequency: 'yearly',
      rule_config: {
        yearly_kind: 'ordinal_weekday',
        month: 5,
        ordinal: 2,
        weekday: 7,
      },
    }).rule_config).toEqual({
      yearly_kind: 'ordinal_weekday',
      month: 5,
      ordinal: 2,
      weekday: 7,
    });
  });

  it('adopts an existing task through the rich recurrence RPC', async () => {
    const adoptedOccurrence = {
      id: '60000000-0000-4000-8000-000000000001',
      owner_id: definition.owner_id,
      recurrence_id: definition.id,
      recurrence_revision: 1,
      logical_key: 'calendar:2026-07-27',
      scheduled_date: '2026-07-27',
      predecessor_occurrence_id: null,
      root_type: 'todo',
      root_id: '80000000-0000-4000-8000-000000000001',
      origin: 'adopted',
      client_mutation_id: '60000000-0000-4000-8000-000000000001',
      generated_at: '2026-07-20T00:00:00Z',
    };
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        definition,
        revision: {
          ...revision,
          rule_config: { weekdays: [1, 3] },
          end_mode: 'after',
          end_after_count: 5,
          end_on_date: null,
          reminder_local_time: '09:30:00',
          deadline_offset_days: 2,
        },
        occurrence: adoptedOccurrence,
      },
      error: null,
    });
    const service = new TaskRecurrenceService({ rpc } as never, definition.owner_id);

    await expect(service.createFromTask({
      taskId: adoptedOccurrence.root_id,
      name: definition.name,
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 1,
      scheduleDate: '2026-07-27',
      ruleConfig: { weekdays: [1, 3] },
      endMode: 'after',
      endAfterCount: 5,
      reminderLocalTime: '09:30',
      deadlineOffsetDays: 2,
      mutationId: definition.client_mutation_id,
    })).resolves.toMatchObject({
      outcome: 'accepted',
      occurrence: {
        root_id: adoptedOccurrence.root_id,
        origin: 'adopted',
      },
      revision: {
        end_mode: 'after',
        end_after_count: 5,
        deadline_offset_days: 2,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      'tasks_create_recurrence_from_task',
      expect.objectContaining({
        _task_id: adoptedOccurrence.root_id,
        _rule_config: { weekdays: [1, 3] },
        _reminder_local_time: '09:30',
        _deadline_offset_days: 2,
      }),
    );
  });

  it('accepts a future virtual prototype without an adopted occurrence', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        definition,
        revision,
        occurrence: null,
      },
      error: null,
    });
    const service = new TaskRecurrenceService({ rpc } as never, definition.owner_id);

    await expect(service.createFromTask({
      taskId: '80000000-0000-4000-8000-000000000001',
      name: definition.name,
      ruleMode: 'calendar',
      frequency: 'monthly',
      intervalCount: 1,
      scheduleDate: '2026-08-03',
      ruleConfig: { monthly_kind: 'day_of_month', month_day: 3 },
      endMode: 'never',
      mutationId: definition.client_mutation_id,
    })).resolves.toMatchObject({
      outcome: 'accepted',
      occurrence: null,
    });
  });

  it('edits the complete recurrence rule through one revision-checked RPC', async () => {
    const currentDefinition = parseTaskRecurrenceDefinition(definition);
    const currentRevision = parseTaskRecurrenceRevision({
      ...revision,
      rule_config: { weekdays: [1] },
      end_mode: 'never',
      end_after_count: null,
      end_on_date: null,
      reminder_local_time: null,
      deadline_offset_days: null,
    });
    const nextDefinition = {
      ...definition,
      current_revision: 2,
      record_revision: 2,
    };
    const nextRevision = {
      ...revision,
      revision: 2,
      rule_mode: 'after_completion',
      start_date: '2026-08-03',
      rule_config: {},
      end_mode: 'after',
      end_after_count: 12,
      end_on_date: null,
      reminder_local_time: '09:30:00',
      deadline_offset_days: 2,
    };
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        definition: nextDefinition,
        revision: nextRevision,
      },
      error: null,
    });
    const service = new TaskRecurrenceService({ rpc } as never, definition.owner_id);

    await expect(service.edit({
      definition: currentDefinition,
      revision: currentRevision,
      name: definition.name,
      ruleMode: 'after_completion',
      frequency: 'weekly',
      intervalCount: 1,
      scheduleDate: '2026-08-03',
      ruleConfig: {},
      endMode: 'after',
      endAfterCount: 12,
      reminderLocalTime: '09:30',
      deadlineOffsetDays: 2,
      mutationId: '90000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({
      outcome: 'accepted',
      definition: { current_revision: 2 },
      revision: {
        revision: 2,
        rule_mode: 'after_completion',
        start_date: '2026-08-03',
      },
    });
    expect(rpc).toHaveBeenCalledWith('tasks_edit_recurrence', expect.objectContaining({
      _recurrence_id: definition.id,
      _expected_record_revision: 1,
      _prototype_snapshot: revision.prototype_snapshot,
      _rule_mode: 'after_completion',
      _start_date: '2026-08-03',
      _end_mode: 'after',
      _end_after_count: 12,
    }));
  });

  it('evaluates with an explicit calendar date and parses the authoritative result', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        status: 'active',
        through_date: '2026-07-20',
        generated_count: 1,
        occurrence_ids: ['60000000-0000-4000-8000-000000000001'],
        definition: { ...definition, evaluated_through_date: '2026-07-20', record_revision: 2 },
      },
      error: null,
    });
    const service = new TaskRecurrenceService({ rpc } as never, definition.owner_id);

    await expect(service.evaluate(
      definition.id,
      '2026-07-20',
      '90000000-0000-4000-8000-000000000001',
    )).resolves.toMatchObject({ generated_count: 1, status: 'active' });
  });

  it('rejects malformed rule input before calling the database', async () => {
    const rpc = vi.fn();
    const service = new TaskRecurrenceService({ rpc } as never, definition.owner_id);
    await expect(service.createFromTask({
      taskId: '80000000-0000-4000-8000-000000000001',
      name: '',
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 0,
      scheduleDate: 'not-a-date',
      ruleConfig: {},
      endMode: 'never',
    })).rejects.toBeInstanceOf(InvalidTaskRecurrenceError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an RPC record owned by a different authenticated user', () => {
    expect(() => parseTaskRecurrenceDefinition(
      { ...definition, owner_id: 'foreign-owner' },
      definition.owner_id,
    )).toThrow('Recurrence owner does not match the authenticated owner');
  });
});

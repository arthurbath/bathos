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
  template_id: '50000000-0000-4000-8000-000000000001',
  template_revision: 2,
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
      template_instantiation_id: '70000000-0000-4000-8000-000000000001',
      root_type: 'todo',
      root_id: '80000000-0000-4000-8000-000000000001',
      client_mutation_id: '60000000-0000-4000-8000-000000000001',
      generated_at: '2026-07-20T00:00:00Z',
    }).logical_key).toBe('calendar:2026-07-20');
  });

  it('saves a structured rule through the server-authoritative RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { outcome: 'accepted', definition, revision },
      error: null,
    });
    const service = new TaskRecurrenceService({ rpc } as never);

    await expect(service.save({
      name: definition.name,
      templateId: revision.template_id,
      templateRevision: 2,
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 1,
      startDate: '2026-07-20',
      planningTimeZone: 'America/Los_Angeles',
      missedPolicy: 'latest',
      mutationId: definition.client_mutation_id,
    })).resolves.toMatchObject({ outcome: 'accepted', definition: { id: definition.id } });
    expect(rpc).toHaveBeenCalledWith('tasks_save_recurrence', expect.objectContaining({
      _template_id: revision.template_id,
      _template_revision: 2,
      _rule_mode: 'calendar',
      _frequency: 'weekly',
      _missed_policy: 'latest',
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
    const service = new TaskRecurrenceService({ rpc } as never);

    await expect(service.evaluate(
      definition.id,
      '2026-07-20',
      '90000000-0000-4000-8000-000000000001',
    )).resolves.toMatchObject({ generated_count: 1, status: 'active' });
  });

  it('rejects malformed rule input before calling the database', async () => {
    const rpc = vi.fn();
    const service = new TaskRecurrenceService({ rpc } as never);
    await expect(service.save({
      name: '',
      templateId: revision.template_id,
      templateRevision: 2,
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 0,
      startDate: 'not-a-date',
      planningTimeZone: 'UTC',
      missedPolicy: 'latest',
    })).rejects.toBeInstanceOf(InvalidTaskRecurrenceError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

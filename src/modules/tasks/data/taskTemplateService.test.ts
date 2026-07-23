import { describe, expect, it, vi } from 'vitest';

import {
  InvalidTaskTemplateError,
  TaskTemplateService,
  parseTaskTemplate,
  parseTaskTemplateSnapshot,
} from './taskTemplateService';

const templateId = '10000000-0000-4000-8000-000000000001';
const ownerId = '20000000-0000-4000-8000-000000000001';
const revisionId = '30000000-0000-4000-8000-000000000001';
const sourceId = '40000000-0000-4000-8000-000000000001';

function definition() {
  return {
    id: templateId,
    owner_id: ownerId,
    kind: 'todo',
    name: 'Weekly Review',
    current_revision: 1,
    record_revision: 1,
    archived_at: null,
    last_mutation_channel: 'web',
    last_actor_type: 'user',
    client_mutation_id: '50000000-0000-4000-8000-000000000001',
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  };
}

function snapshot() {
  return {
    version: 1,
    kind: 'todo',
    root: {
      node_id: 'root',
      title: 'Weekly Review',
      notes: '',
      actionability: 'actionable',
      destination: 'anytime',
      today_section: 'daytime',
      order_key: 'a0',
      start_offset_days: 2,
      deadline_offset_days: 4,
      checklist: [{ node_id: 'check-1', title: 'Review Calendar', order_key: 'a0' }],
    },
  };
}

function revision() {
  return {
    id: revisionId,
    owner_id: ownerId,
    template_id: templateId,
    revision: 1,
    name: 'Weekly Review',
    source_type: 'todo',
    source_id: sourceId,
    source_revision: 3,
    anchor_date: '2026-07-20',
    snapshot: snapshot(),
    client_mutation_id: '50000000-0000-4000-8000-000000000001',
    created_at: '2026-07-20T00:00:00Z',
  };
}

describe('TaskTemplateService', () => {
  it('captures a template through the guarded RPC and parses the result', async () => {
    const { owner_id: _templateOwner, ...ownerSafeTemplate } = definition();
    const { owner_id: _revisionOwner, ...ownerSafeRevision } = revision();
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        template: ownerSafeTemplate,
        revision: ownerSafeRevision,
      },
      error: null,
    });
    const service = new TaskTemplateService({ rpc } as never, ownerId);

    const result = await service.capture({
      sourceType: 'todo',
      sourceId,
      name: ' Weekly Review ',
      anchorDate: '2026-07-20',
      mutationId: '60000000-0000-4000-8000-000000000001',
    });

    expect(result.template.name).toBe('Weekly Review');
    expect(result.template.owner_id).toBe(ownerId);
    expect(result.revision.owner_id).toBe(ownerId);
    expect(result.revision.snapshot.kind).toBe('todo');
    expect(rpc).toHaveBeenCalledWith('tasks_capture_template', expect.objectContaining({
      _template_id: null,
      _source_type: 'todo',
      _source_id: sourceId,
      _name: 'Weekly Review',
      _anchor_date: '2026-07-20',
    }));
  });

  it('instantiates with the exact revision, anchor, channel, and idempotency key', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        instantiation: {
          id: '70000000-0000-4000-8000-000000000001',
          owner_id: ownerId,
          template_id: templateId,
          template_revision: 1,
          anchor_date: '2026-07-27',
          entry_channel: 'web',
          actor_type: 'user',
          target_area_id: null,
          root_type: 'todo',
          root_id: '80000000-0000-4000-8000-000000000001',
          result: {},
          client_mutation_id: '90000000-0000-4000-8000-000000000001',
          created_at: '2026-07-20T00:00:00Z',
        },
        result: {
          root_type: 'todo',
          root_id: '80000000-0000-4000-8000-000000000001',
          project_id: null,
          task_ids: ['80000000-0000-4000-8000-000000000001'],
          checklist_item_ids: [],
        },
      },
      error: null,
    });
    const service = new TaskTemplateService({ rpc } as never, ownerId);

    await service.instantiate({
      templateId,
      templateRevision: 1,
      anchorDate: '2026-07-27',
      requestId: '90000000-0000-4000-8000-000000000001',
    });

    expect(rpc).toHaveBeenCalledWith('tasks_instantiate_template', expect.objectContaining({
      _template_id: templateId,
      _template_revision: 1,
      _anchor_date: '2026-07-27',
      _request_id: '90000000-0000-4000-8000-000000000001',
      _entry_channel: 'web',
      _actor_type: 'user',
    }));
  });

  it('rejects malformed or unsupported snapshots', () => {
    expect(() => parseTaskTemplateSnapshot('{bad json')).toThrow(InvalidTaskTemplateError);
    expect(() => parseTaskTemplateSnapshot({ ...snapshot(), version: 2 })).toThrow(
      'Template snapshot version is unsupported',
    );
  });

  it('retains an active day horizon without inventing a start-date offset', () => {
    const source = snapshot();
    const undated = {
      ...source,
      root: {
        ...source.root,
        today_section: 'next',
        start_offset_days: null,
      },
    };

    expect(parseTaskTemplateSnapshot(undated)).toMatchObject({
      root: {
        today_section: 'next',
        start_offset_days: null,
      },
    });
  });

  it('rejects an RPC record owned by a different authenticated user', () => {
    const foreign = { ...definition(), owner_id: 'foreign-owner' };
    expect(() => parseTaskTemplate(foreign, ownerId)).toThrow(
      'Template owner does not match the authenticated owner',
    );
  });

  it('rejects invalid capture dates before making a request', async () => {
    const rpc = vi.fn();
    const service = new TaskTemplateService({ rpc } as never, ownerId);
    await expect(service.capture({
      sourceType: 'todo',
      sourceId,
      name: 'Weekly Review',
      anchorDate: 'tomorrow',
    })).rejects.toThrow(InvalidTaskTemplateError);
    expect(rpc).not.toHaveBeenCalled();
  });
});

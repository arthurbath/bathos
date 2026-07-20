import { describe, expect, it, vi } from 'vitest';

import {
  InvalidTaskPermanentDeletionError,
  TASK_PERMANENT_DELETION_CONFIRMATION,
  TaskPermanentDeletionService,
  type TaskPermanentDeletionPreview,
} from './taskPermanentDeletionService';

const preview: TaskPermanentDeletionPreview = {
  root: { type: 'project', id: 'project-a', title: 'Retired Project' },
  hierarchy: {
    projects: ['project-a'], headings: ['heading-a'], todos: ['todo-a'],
    checklist_items: ['checklist-a'],
  },
  related: {
    task_history_events: ['task-history-a'],
    hierarchy_history_events: ['hierarchy-history-a'],
    mail_sources: ['todo-a'],
    mail_source_events: ['mail-event-a'],
    reminders: ['reminder-a'],
    reminder_occurrences: ['reminder-occurrence-a'],
    reminder_deliveries: ['reminder-delivery-a'],
  },
  preserved_receipts: {
    hierarchy_operations: ['operation-a'],
    template_instantiations: [],
    recurrence_occurrences: [],
  },
  erased_record_count: 11,
  scope_digest: 'a'.repeat(64),
};

describe('TaskPermanentDeletionService', () => {
  it('previews the exact server-authoritative deletion scope', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: preview, error: null });
    const service = new TaskPermanentDeletionService({ rpc } as never);

    await expect(service.preview('project', 'project-a')).resolves.toEqual(preview);
    expect(rpc).toHaveBeenCalledWith('tasks_preview_permanent_deletion', {
      _root_type: 'project',
      _root_id: 'project-a',
    });
  });

  it('executes an exact preview using the explicit phrase and request identifier', async () => {
    const result = {
      ...preview,
      root: { type: 'project', id: 'project-a' },
      outcome: 'accepted',
      request_id: 'request-a',
      completed_at: '2026-07-20T20:00:00Z',
    };
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const service = new TaskPermanentDeletionService({ rpc } as never);

    await expect(service.execute(
      preview,
      TASK_PERMANENT_DELETION_CONFIRMATION,
      'request-a',
    )).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith('tasks_permanently_delete', {
      _root_type: 'project',
      _root_id: 'project-a',
      _scope_digest: 'a'.repeat(64),
      _request_id: 'request-a',
      _confirmation: TASK_PERMANENT_DELETION_CONFIRMATION,
    });
  });

  it('rejects an inexact confirmation before any destructive request', async () => {
    const rpc = vi.fn();
    const service = new TaskPermanentDeletionService({ rpc } as never);

    await expect(service.execute(preview, 'DELETE', 'request-a'))
      .rejects.toBeInstanceOf(InvalidTaskPermanentDeletionError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed previews returned by the server', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...preview, erased_record_count: -1 },
      error: null,
    });
    const service = new TaskPermanentDeletionService({ rpc } as never);

    await expect(service.preview('project', 'project-a'))
      .rejects.toBeInstanceOf(InvalidTaskPermanentDeletionError);
  });

  it('surfaces server rejection without translating it into a successful receipt', async () => {
    const error = new Error('Permanent-deletion preview is stale');
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    const service = new TaskPermanentDeletionService({ rpc } as never);

    await expect(service.execute(
      preview,
      TASK_PERMANENT_DELETION_CONFIRMATION,
      'request-a',
    )).rejects.toBe(error);
  });
});

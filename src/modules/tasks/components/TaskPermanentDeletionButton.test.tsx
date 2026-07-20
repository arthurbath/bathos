import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TaskPermanentDeletionButton } from './TaskPermanentDeletionButton';
import { TASK_PERMANENT_DELETION_CONFIRMATION } from '../data/taskPermanentDeletionService';

const preview = {
  root: { type: 'project' as const, id: 'project-a', title: 'Retired Project' },
  hierarchy: {
    projects: ['project-a'], headings: ['heading-a'], todos: ['todo-a'], checklist_items: [],
  },
  related: {
    task_history_events: ['history-a'], hierarchy_history_events: [],
    mail_sources: [], mail_source_events: [], reminders: [],
    reminder_occurrences: [], reminder_deliveries: [],
  },
  preserved_receipts: {
    hierarchy_operations: ['operation-a'], template_instantiations: [],
    recurrence_occurrences: [],
  },
  erased_record_count: 4,
  scope_digest: 'a'.repeat(64),
};

describe('TaskPermanentDeletionButton', () => {
  it('keeps the destructive command disabled while current server state is unavailable', () => {
    render(
      <TaskPermanentDeletionButton
        rootType="project"
        rootId="project-a"
        title="Retired Project"
        service={{ preview: vi.fn(), execute: vi.fn() } as never}
        available={false}
        unavailableReason="Wait for synchronization"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Permanently Delete Retired Project' }))
      .toBeDisabled();
  });

  it('previews counts and requires the exact phrase before execution', async () => {
    const service = {
      preview: vi.fn().mockResolvedValue(preview),
      execute: vi.fn().mockResolvedValue({
        ...preview,
        root: { type: 'project', id: 'project-a' },
        outcome: 'accepted', request_id: 'request-a', completed_at: '2026-07-20T20:00:00Z',
      }),
    };
    const onDeleted = vi.fn();
    render(
      <TaskPermanentDeletionButton
        rootType="project"
        rootId="project-a"
        title="Retired Project"
        service={service as never}
        available
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Permanently Delete Retired Project' }));
    expect(await findDeletionCount()).toBeInTheDocument();
    const confirmButton = screen.getByRole('button', { name: 'Delete Permanently' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DELETE' } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: TASK_PERMANENT_DELETION_CONFIRMATION },
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(service.execute).toHaveBeenCalledWith(
      preview,
      TASK_PERMANENT_DELETION_CONFIRMATION,
    );
  });

  it('keeps the preview open when the server rejects a stale digest', async () => {
    const service = {
      preview: vi.fn().mockResolvedValue(preview),
      execute: vi.fn().mockRejectedValue(new Error('Permanent-deletion preview is stale')),
    };
    render(
      <TaskPermanentDeletionButton
        rootType="project"
        rootId="project-a"
        title="Retired Project"
        service={service as never}
        available
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Permanently Delete Retired Project' }));
    await findDeletionCount();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: TASK_PERMANENT_DELETION_CONFIRMATION },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanently' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('preview is stale');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('disables an open confirmation if synchronization stops being current', async () => {
    const service = {
      preview: vi.fn().mockResolvedValue(preview),
      execute: vi.fn(),
    };
    const { rerender } = render(
      <TaskPermanentDeletionButton
        rootType="project"
        rootId="project-a"
        title="Retired Project"
        service={service as never}
        available
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Permanently Delete Retired Project' }));
    await findDeletionCount();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: TASK_PERMANENT_DELETION_CONFIRMATION },
    });
    expect(screen.getByRole('button', { name: 'Delete Permanently' })).toBeEnabled();

    rerender(
      <TaskPermanentDeletionButton
        rootType="project"
        rootId="project-a"
        title="Retired Project"
        service={service as never}
        available={false}
        unavailableReason="Wait for pending task changes to synchronize"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete Permanently' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('pending task changes');
    expect(service.execute).not.toHaveBeenCalled();
  });
});

function findDeletionCount() {
  return screen.findByText((_content, element) => (
    element?.tagName === 'P'
    && element.textContent?.startsWith('4 records will be erased:') === true
  ));
}

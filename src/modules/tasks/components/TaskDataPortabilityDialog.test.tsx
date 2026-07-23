import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskDataPortabilityDialog } from './TaskDataPortabilityDialog';
import {
  taskExportV12Collections,
  TASK_REPLACE_RESTORE_CONFIRMATION,
  type TaskExportV12,
  type TaskPortabilityService,
} from '@/modules/tasks/data/taskPortability';

const checksum = 'a'.repeat(64);
const counts = Object.fromEntries(taskExportV12Collections.map((name) => [name, 0]));
const taskExport = {
  format: 'garden.bath.tasks.export',
  schema_version: 12,
  created_at: '2026-07-20T21:00:00.000Z',
  manifest: {
    collections: [...taskExportV12Collections],
    counts,
    checksums: {
      algorithm: 'sha256',
      ...Object.fromEntries(taskExportV12Collections.map((name) => [name, checksum])),
    },
  },
  data: Object.fromEntries(taskExportV12Collections.map((name) => [name, []])),
} as TaskExportV12;
const restorePreview = {
  dry_run: true,
  schema_version: 12,
  ...Object.fromEntries(taskExportV12Collections.map((name) => [name, {
    inserts: 0,
    matches: 0,
    conflicts: 0,
    insert_ids: [],
    match_ids: [],
    conflict_ids: [],
  }])),
};
const preparation = {
  schema_version: 12 as const,
  backup: taskExport,
  backup_digest: checksum,
  current_counts: counts,
  incoming_counts: counts,
  restore_preview: restorePreview,
};

function createService(overrides: Partial<TaskPortabilityService> = {}) {
  return {
    createExport: vi.fn().mockResolvedValue(taskExport),
    previewRestore: vi.fn().mockResolvedValue(restorePreview),
    mergeRestore: vi.fn().mockResolvedValue({ ...restorePreview, dry_run: false }),
    prepareReplace: vi.fn().mockResolvedValue(preparation),
    replace: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
    ...overrides,
  } as unknown as TaskPortabilityService;
}

async function selectBackup() {
  fireEvent.click(screen.getByLabelText('Task Backup and Restore'));
  const file = new File([JSON.stringify(taskExport)], 'tasks.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: vi.fn().mockResolvedValue(JSON.stringify(taskExport)),
  });
  fireEvent.change(screen.getByLabelText('Select Task Backup'), {
    target: { files: [file] },
  });
  await screen.findByText(/Schema 12:/);
}

describe('TaskDataPortabilityDialog', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:task-backup'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('downloads a current task backup from the server', async () => {
    const service = createService();
    render(
      <TaskDataPortabilityDialog service={service} replaceAvailable />,
    );

    fireEvent.click(screen.getByLabelText('Task Backup and Restore'));
    fireEvent.click(screen.getByRole('button', { name: 'Download Backup' }));

    await waitFor(() => expect(service.createExport).toHaveBeenCalledOnce());
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it('requires a downloaded pre-restore backup and exact separate confirmation', async () => {
    const service = createService();
    render(
      <TaskDataPortabilityDialog service={service} replaceAvailable />,
    );
    await selectBackup();

    fireEvent.click(screen.getByRole('button', { name: 'Replace Current Data' }));
    await screen.findByRole('heading', { name: 'Replace All Task Data' });
    const replaceButton = screen.getByRole('button', { name: 'Replace Task Data' });
    expect(replaceButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Download Required Backup' }));
    expect(replaceButton).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Confirmation/ }), {
      target: { value: TASK_REPLACE_RESTORE_CONFIRMATION },
    });
    expect(replaceButton).toBeEnabled();
    fireEvent.click(replaceButton);

    await waitFor(() => expect(service.replace).toHaveBeenCalledWith({
      taskExport,
      preparation,
      confirmation: TASK_REPLACE_RESTORE_CONFIRMATION,
    }));
  });

  it('disables an open replacement confirmation if synchronization becomes unsafe', async () => {
    const service = createService();
    const view = render(
      <TaskDataPortabilityDialog service={service} replaceAvailable />,
    );
    await selectBackup();
    fireEvent.click(screen.getByRole('button', { name: 'Replace Current Data' }));
    await screen.findByRole('heading', { name: 'Replace All Task Data' });
    fireEvent.click(screen.getByRole('button', { name: 'Download Required Backup' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Confirmation/ }), {
      target: { value: TASK_REPLACE_RESTORE_CONFIRMATION },
    });

    view.rerender(
      <TaskDataPortabilityDialog
        service={service}
        replaceAvailable={false}
        replaceUnavailableReason="Wait for pending task changes to synchronize"
      />,
    );

    expect(screen.getByRole('button', { name: 'Replace Task Data' })).toBeDisabled();
    expect(screen.getAllByText('Wait for pending task changes to synchronize').length).toBeGreaterThan(0);
  });

  it('keeps a failed confirmation open and requires a newly prepared backup', async () => {
    const service = createService({
      replace: vi.fn().mockRejectedValue(new Error('The pre-restore backup is stale')),
    });
    render(
      <TaskDataPortabilityDialog service={service} replaceAvailable />,
    );
    await selectBackup();
    fireEvent.click(screen.getByRole('button', { name: 'Replace Current Data' }));
    await screen.findByRole('heading', { name: 'Replace All Task Data' });
    fireEvent.click(screen.getByRole('button', { name: 'Download Required Backup' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Confirmation/ }), {
      target: { value: TASK_REPLACE_RESTORE_CONFIRMATION },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replace Task Data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pre-restore backup is stale');
    expect(screen.getByRole('heading', { name: 'Replace All Task Data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace Task Data' })).toBeDisabled();
  });
});

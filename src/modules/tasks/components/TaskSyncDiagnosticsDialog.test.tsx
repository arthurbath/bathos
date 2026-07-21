import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskSyncDiagnosticsDialog } from './TaskSyncDiagnosticsDialog';

const mocks = vi.hoisted(() => ({
  useTaskSyncDiagnostics: vi.fn(),
}));

vi.mock('@/modules/tasks/hooks/useTaskSyncDiagnostics', () => ({
  useTaskSyncDiagnostics: () => mocks.useTaskSyncDiagnostics(),
}));

describe('TaskSyncDiagnosticsDialog', () => {
  beforeEach(() => {
    mocks.useTaskSyncDiagnostics.mockReset().mockReturnValue({
      mode: 'local',
      syncState: 'local',
      pendingUploadCount: 0,
      hasCompletedSync: false,
      lastSuccessfulSyncAt: null,
      uploadState: 'idle',
      downloadState: 'idle',
      healthState: 'local-only',
      healthEvents: [],
      healthEventsLoading: false,
      healthEventsError: null,
      conflictReceipts: [],
      conflictReceiptsLoading: false,
      conflictReceiptsError: null,
    });
  });

  it('makes local-only storage and missing cross-client convergence explicit', async () => {
    render(<TaskSyncDiagnosticsDialog />);

    await userEvent.click(screen.getByRole('button', {
      name: 'Task Sync Status: Local. Open Synchronization Details',
    }));

    expect(screen.getByRole('dialog', { name: 'Synchronization Details' })).toBeVisible();
    expect(screen.getByText(
      'This installation stores task data locally. Cross-device and MCP changes do not converge.',
    )).toBeVisible();
    expect(screen.getAllByText('Local Only')).toHaveLength(2);
    expect(screen.getByText('Preparing')).toBeVisible();
    expect(screen.getByText('No degradation recorded.')).toBeVisible();
    expect(screen.getByText('No conflict receipts.')).toBeVisible();
  });

  it('shows transfer failures separately and renders recent content-free conflict receipts', async () => {
    mocks.useTaskSyncDiagnostics.mockReturnValue({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 2,
      hasCompletedSync: true,
      lastSuccessfulSyncAt: '2026-07-20T16:30:00.000Z',
      uploadState: 'error',
      downloadState: 'active',
      healthState: 'upload-error',
      healthEvents: [{
        id: 'health-1',
        state: 'offline',
        startedAt: '2026-07-20T16:20:00.000Z',
        resolvedAt: '2026-07-20T16:22:00.000Z',
        pendingUploadBucket: '2-9',
        hadCompletedSync: true,
        lastSuccessfulSyncAt: '2026-07-20T16:19:00.000Z',
        reportedAt: '2026-07-20T16:22:00.000Z',
      }],
      healthEventsLoading: false,
      healthEventsError: null,
      conflictReceipts: [{
        id: 'crud-2',
        taskId: 'task-a',
        operation: 'PATCH',
        localRevision: 2,
        remoteRevision: 3,
        detectedAt: '2026-07-20T16:31:00.000Z',
        code: 'revision_conflict',
      }],
      conflictReceiptsLoading: false,
      conflictReceiptsError: null,
    });
    render(<TaskSyncDiagnosticsDialog />);

    await userEvent.click(screen.getByRole('button', {
      name: 'Task Sync Status: Upload Error - 2 Pending. Open Synchronization Details',
    }));

    expect(screen.getByText('Pending Changes').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Upload').nextElementSibling).toHaveTextContent('Error');
    expect(screen.getByText('Download').nextElementSibling).toHaveTextContent('Active');
    expect(screen.getByText('Full Synchronization').nextElementSibling)
      .toHaveTextContent('Complete');
    expect(screen.getByText(/Recovered/)).toHaveTextContent('Pending Queue 2-9');
    expect(screen.getByText(/Recovered/)).toHaveTextContent('Reported');
    expect(screen.getByText('revision_conflict')).toBeVisible();
    expect(screen.getByText('PATCH - Revision 2 to 3')).toBeVisible();
    expect(screen.getByText('task-a')).toBeVisible();
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskSyncStatusCard } from './TaskSyncStatusCard';
import { formatTaskSyncStatusTimestamp } from './taskSyncStatusPresentation';

const mocks = vi.hoisted(() => ({
  useStatus: vi.fn(),
  useTasksRuntime: vi.fn(),
}));

vi.mock('@powersync/react', () => ({
  useStatus: () => mocks.useStatus(),
}));

vi.mock('@/modules/tasks/runtime/tasksRuntimeContext', () => ({
  useTasksRuntime: () => mocks.useTasksRuntime(),
}));

describe('TaskSyncStatusCard', () => {
  beforeEach(() => {
    mocks.useTasksRuntime.mockReset().mockReturnValue({
      mode: 'connected',
      syncState: 'connected',
      pendingUploadCount: 2,
    });
    mocks.useStatus.mockReset().mockReturnValue({
      hasSynced: true,
      lastSyncedAt: new Date(2026, 7, 3, 17, 55),
      dataFlowStatus: {
        uploading: false,
        downloading: false,
        uploadError: undefined,
        downloadError: undefined,
      },
    });
  });

  it('shows only the user-facing sync summary in the requested date format', () => {
    render(<TaskSyncStatusCard />);

    expect(screen.getByRole('heading', { name: 'Sync Status' })).toBeVisible();
    expect(screen.getByText('Health').nextElementSibling).toHaveTextContent('Synchronizing');
    expect(screen.getByText('Pending Changes').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Last Successful Sync').nextElementSibling)
      .toHaveTextContent('2026 Aug 3, 5:55 PM');
    expect(screen.queryByText('Connection')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
    expect(screen.queryByText('Synchronization Details')).not.toBeInTheDocument();
  });

  it('describes offline and not-yet-synchronized states without exposing diagnostics', () => {
    mocks.useTasksRuntime.mockReturnValue({
      mode: 'connected',
      syncState: 'offline',
      pendingUploadCount: 0,
    });
    mocks.useStatus.mockReturnValue({
      hasSynced: false,
      lastSyncedAt: undefined,
      dataFlowStatus: {},
    });

    render(<TaskSyncStatusCard />);

    expect(screen.getByText('Health').nextElementSibling).toHaveTextContent('Offline');
    expect(screen.getByText('Last Successful Sync').nextElementSibling).toHaveTextContent('Not Yet');
  });

  it('formats local timestamps without commas between the month and day', () => {
    expect(formatTaskSyncStatusTimestamp(new Date(2026, 7, 3, 17, 55)))
      .toBe('2026 Aug 3, 5:55 PM');
  });
});

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { taskTodoFixture } from '@/modules/tasks/testing/taskFixtures';
import { useTaskAreaDetail } from './useTaskAreaDetail';

const useQuery = vi.fn();

vi.mock('@powersync/react', () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));

let latest: ReturnType<typeof useTaskAreaDetail>;

function Harness() {
  latest = useTaskAreaDetail('owner-a', 'area-a');
  return null;
}

describe('useTaskAreaDetail', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    useQuery.mockReset();
  });

  it('reads only present open loose to-dos owned by the selected area owner', () => {
    const task = taskTodoFixture({
      owner_id: 'owner-a',
      area_id: 'area-a',
      project_id: null,
      heading_id: null,
      lifecycle: 'open',
      disposition: 'present',
    });
    useQuery.mockReturnValue({ data: [task], isLoading: false, error: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<Harness />));

    expect(latest.tasks).toEqual([task]);
    expect(useQuery).toHaveBeenCalledWith(
      expect.stringContaining("AND lifecycle = 'open'"),
      ['owner-a', 'area-a'],
    );
    expect(useQuery.mock.calls[0][0]).toContain("AND disposition = 'present'");
    expect(useQuery.mock.calls[0][0]).toContain('AND area_id = ?');
    expect(useQuery.mock.calls[0][0]).toContain('AND project_id IS NULL');
  });
});

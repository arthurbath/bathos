import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '@/integrations/supabase/types';

import {
  createTaskExport,
  getTaskExportFilename,
  InvalidTaskExportError,
  mergeTaskRestore,
  parseTaskExport,
  previewTaskRestore,
  serializeTaskExport,
  type TaskExportV3,
} from './taskPortability';

const checksum = 'a'.repeat(64);
const taskExport = {
  format: 'garden.bath.tasks.export',
  schema_version: 3,
  created_at: '2026-07-20T05:30:00.000Z',
  manifest: {
    collections: ['tasks_todos', 'tasks_history_events', 'tasks_user_settings'],
    counts: { tasks_todos: 0, tasks_history_events: 0, tasks_user_settings: 0 },
    checksums: {
      algorithm: 'sha256',
      tasks_todos: checksum,
      tasks_history_events: checksum,
      tasks_user_settings: checksum,
    },
  },
  data: { tasks_todos: [], tasks_history_events: [], tasks_user_settings: [] },
} satisfies TaskExportV3;

function createClient(results: unknown[]) {
  const rpc = vi.fn();
  for (const result of results) {
    rpc.mockResolvedValueOnce({ data: result, error: null });
  }
  return { rpc } as unknown as Pick<SupabaseClient<Database>, 'rpc'>;
}

describe('task portability', () => {
  it('creates and serializes a versioned task export', async () => {
    const client = createClient([taskExport]);

    await expect(createTaskExport(client)).resolves.toEqual(taskExport);
    expect(client.rpc).toHaveBeenCalledWith('tasks_create_export_v3');
    expect(serializeTaskExport(taskExport)).toBe(`${JSON.stringify(taskExport, null, 2)}\n`);
    expect(getTaskExportFilename(taskExport.created_at)).toBe('bathos-tasks-2026-07-20.json');
  });

  it('previews and executes restore through distinct explicit calls', async () => {
    const preview = {
      dry_run: true,
      schema_version: 3,
      tasks_todos: report(2),
      tasks_history_events: report(4),
      tasks_user_settings: report(1),
    };
    const merge = { ...preview, dry_run: false };
    const client = createClient([preview, merge]);

    await expect(previewTaskRestore(client, taskExport)).resolves.toEqual(preview);
    await expect(mergeTaskRestore(client, taskExport)).resolves.toEqual(merge);
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'tasks_restore_export_v3', {
      _envelope: taskExport,
      _dry_run: true,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'tasks_restore_export_v3', {
      _envelope: taskExport,
      _dry_run: false,
    });
  });

  it('rejects incompatible envelopes and inconsistent reports', async () => {
    expect(() => parseTaskExport({ ...taskExport, schema_version: 4 })).toThrow(
      InvalidTaskExportError,
    );
    expect(() => parseTaskExport({
      ...taskExport,
      manifest: {
        ...taskExport.manifest,
        counts: { tasks_todos: 1, tasks_history_events: 0, tasks_user_settings: 0 },
      },
    })).toThrow('manifest does not match');
    expect(() => getTaskExportFilename('not-a-date')).toThrow('invalid creation time');

    const client = createClient([{
      dry_run: true,
      schema_version: 3,
      tasks_todos: { ...report(1), inserts: 2 },
      tasks_history_events: report(0),
      tasks_user_settings: report(0),
    }]);
    await expect(previewTaskRestore(client, taskExport)).rejects.toThrow(
      'collection counts are invalid',
    );
  });
});

function report(insertCount: number) {
  return {
    inserts: insertCount,
    matches: 0,
    conflicts: 0,
    insert_ids: Array.from({ length: insertCount }, (_, index) => `id-${index}`),
    match_ids: [],
    conflict_ids: [],
  };
}

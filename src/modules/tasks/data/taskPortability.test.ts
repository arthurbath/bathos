import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '@/integrations/supabase/types';

import {
  createTaskExport,
  getTaskExportFilename,
  InvalidTaskExportError,
  mergeTaskRestore,
  parseTaskExport,
  prepareTaskReplaceRestore,
  previewTaskRestore,
  replaceTaskRestore,
  serializeTaskExport,
  TASK_REPLACE_RESTORE_CONFIRMATION,
  taskExportV5Collections,
  taskExportV6Collections,
  taskExportV8Collections,
  taskExportV11Collections,
  type TaskExportV5,
  type TaskExportV6,
  type TaskExportV7,
  type TaskExportV8,
  type TaskExportV11,
  type TaskExportV11Collection,
} from './taskPortability';

const checksum = 'a'.repeat(64);
const versionSixExport = {
  format: 'garden.bath.tasks.export',
  schema_version: 6,
  created_at: '2026-07-20T05:30:00.000Z',
  manifest: {
    collections: [...taskExportV6Collections],
    counts: Object.fromEntries(taskExportV6Collections.map((name) => [name, 0])),
    checksums: {
      algorithm: 'sha256',
      ...Object.fromEntries(taskExportV6Collections.map((name) => [name, checksum])),
    },
  },
  data: Object.fromEntries(taskExportV6Collections.map((name) => [name, []])),
} as TaskExportV6;

const taskExport = {
  ...versionSixExport,
  schema_version: 7,
} as TaskExportV7;

const versionEightExport = {
  format: 'garden.bath.tasks.export',
  schema_version: 8,
  created_at: '2026-07-20T05:30:00.000Z',
  manifest: {
    collections: [...taskExportV8Collections],
    counts: Object.fromEntries(taskExportV8Collections.map((name) => [name, 0])),
    checksums: {
      algorithm: 'sha256',
      ...Object.fromEntries(taskExportV8Collections.map((name) => [name, checksum])),
    },
  },
  data: Object.fromEntries(taskExportV8Collections.map((name) => [name, []])),
} as TaskExportV8;

const currentTaskExport = {
  format: 'garden.bath.tasks.export',
  schema_version: 11,
  created_at: '2026-07-20T05:30:00.000Z',
  manifest: {
    collections: [...taskExportV11Collections],
    counts: Object.fromEntries(taskExportV11Collections.map((name) => [name, 0])),
    checksums: {
      algorithm: 'sha256',
      ...Object.fromEntries(taskExportV11Collections.map((name) => [name, checksum])),
    },
  },
  data: Object.fromEntries(taskExportV11Collections.map((name) => [name, []])),
} as TaskExportV11;

const versionFiveExport = {
  ...versionSixExport,
  schema_version: 5,
  manifest: {
    collections: [...taskExportV5Collections],
    counts: Object.fromEntries(taskExportV5Collections.map((name) => [name, 0])),
    checksums: {
      algorithm: 'sha256',
      ...Object.fromEntries(taskExportV5Collections.map((name) => [name, checksum])),
    },
  },
  data: Object.fromEntries(taskExportV5Collections.map((name) => [name, []])),
} as TaskExportV5;

function createClient(results: unknown[]) {
  const rpc = vi.fn();
  for (const result of results) {
    rpc.mockResolvedValueOnce({ data: result, error: null });
  }
  return { rpc } as unknown as Pick<SupabaseClient<Database>, 'rpc'>;
}

describe('task portability', () => {
  it('creates and serializes a versioned task export', async () => {
    const client = createClient([currentTaskExport]);

    await expect(createTaskExport(client)).resolves.toEqual(currentTaskExport);
    expect(client.rpc).toHaveBeenCalledWith('tasks_create_export_v11');
    expect(serializeTaskExport(currentTaskExport)).toBe(`${JSON.stringify(currentTaskExport, null, 2)}\n`);
    expect(getTaskExportFilename(currentTaskExport.created_at)).toBe('bathos-tasks-2026-07-20.json');
  });

  it('previews and executes restore through distinct explicit calls', async () => {
    const preview = {
      dry_run: true,
      schema_version: 7,
      ...Object.fromEntries(taskExportV6Collections.map((name) => [name, report(0)])),
      tasks_todos: report(2),
      tasks_history_events: report(4),
      tasks_user_settings: report(1),
    };
    const merge = { ...preview, dry_run: false };
    const client = createClient([preview, merge]);

    await expect(previewTaskRestore(client, taskExport)).resolves.toEqual(preview);
    await expect(mergeTaskRestore(client, taskExport)).resolves.toEqual(merge);
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'tasks_restore_export_current', {
      _envelope: taskExport,
      _dry_run: true,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'tasks_restore_export_current', {
      _envelope: taskExport,
      _dry_run: false,
    });
  });

  it('retains restore compatibility with version five exports', async () => {
    const preview = {
      dry_run: true,
      schema_version: 5,
      ...Object.fromEntries(taskExportV5Collections.map((name) => [name, report(0)])),
    };
    const client = createClient([preview]);

    expect(parseTaskExport(versionFiveExport)).toEqual(versionFiveExport);
    await expect(previewTaskRestore(client, versionFiveExport)).resolves.toEqual(preview);
    expect(client.rpc).toHaveBeenCalledWith('tasks_restore_export_current', {
      _envelope: versionFiveExport,
      _dry_run: true,
    });
  });

  it('retains restore compatibility with version eight exports', async () => {
    const preview = {
      dry_run: true,
      schema_version: 8,
      ...Object.fromEntries(taskExportV8Collections.map((name) => [name, report(0)])),
    };
    const client = createClient([preview]);

    expect(parseTaskExport(versionEightExport)).toEqual(versionEightExport);
    await expect(previewTaskRestore(client, versionEightExport)).resolves.toEqual(preview);
    expect(client.rpc).toHaveBeenCalledWith('tasks_restore_export_current', {
      _envelope: versionEightExport,
      _dry_run: true,
    });
  });

  it('prepares and executes guarded current-schema replacement restore', async () => {
    const restorePreview = {
      dry_run: true,
      schema_version: 11,
      ...Object.fromEntries(taskExportV11Collections.map((name) => [name, report(0)])),
    };
    const counts = Object.fromEntries(taskExportV11Collections.map((name) => [name, 0]));
    const preparation = {
      schema_version: 11,
      backup: currentTaskExport,
      backup_digest: checksum,
      current_counts: counts,
      incoming_counts: counts,
      restore_preview: restorePreview,
    };
    const result = {
      outcome: 'accepted',
      schema_version: 11,
      request_id: 'request-a',
      backup_digest: checksum,
      target_digest: checksum,
      removed_counts: counts,
      restore_report: { ...restorePreview, dry_run: false, applied: true },
    };
    const client = createClient([preparation, result]);

    const prepared = await prepareTaskReplaceRestore(client, currentTaskExport);
    await expect(replaceTaskRestore(client, {
      taskExport: currentTaskExport,
      preparation: prepared,
      confirmation: TASK_REPLACE_RESTORE_CONFIRMATION,
      requestId: 'request-a',
    })).resolves.toEqual(result);
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'tasks_prepare_replace_restore_v11', {
      _envelope: currentTaskExport,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'tasks_replace_restore_v11', {
      _envelope: currentTaskExport,
      _expected_backup_digest: checksum,
      _request_id: 'request-a',
      _confirmation: TASK_REPLACE_RESTORE_CONFIRMATION,
    });
  });

  it('keeps legacy exports and unconfirmed replacements out of replace restore', async () => {
    const client = createClient([]);
    await expect(prepareTaskReplaceRestore(client, versionEightExport as never)).rejects.toThrow(
      'requires a current schema version eleven export',
    );
    await expect(replaceTaskRestore(client, {
      taskExport: currentTaskExport,
      preparation: {
        schema_version: 11,
        backup: currentTaskExport,
        backup_digest: checksum,
        current_counts: Object.fromEntries(
          taskExportV11Collections.map((name) => [name, 0]),
        ) as Record<TaskExportV11Collection, number>,
        incoming_counts: Object.fromEntries(
          taskExportV11Collections.map((name) => [name, 0]),
        ) as Record<TaskExportV11Collection, number>,
        restore_preview: {
          dry_run: true,
          schema_version: 11,
          tasks_todos: report(0),
          tasks_history_events: report(0),
          ...Object.fromEntries(taskExportV11Collections.map((name) => [name, report(0)])),
        },
      },
      confirmation: 'REPLACE',
    })).rejects.toThrow('confirmation exactly');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('rejects incompatible envelopes and inconsistent reports', async () => {
    expect(() => parseTaskExport({ ...taskExport, schema_version: 11 })).toThrow(
      InvalidTaskExportError,
    );
    expect(() => parseTaskExport({
      ...taskExport,
      manifest: {
        ...taskExport.manifest,
        counts: { ...taskExport.manifest.counts, tasks_todos: 1 },
      },
    })).toThrow('manifest does not match');
    expect(() => getTaskExportFilename('not-a-date')).toThrow('invalid creation time');

    const client = createClient([{
      dry_run: true,
      schema_version: 7,
      ...Object.fromEntries(taskExportV6Collections.map((name) => [name, report(0)])),
      tasks_todos: { ...report(1), inserts: 2 },
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

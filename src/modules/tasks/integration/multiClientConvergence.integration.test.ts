// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import { createTaskData } from '@/lib/mcp/tools/tasks-create';
import { updateTaskData } from '@/lib/mcp/tools/tasks-mutate';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const integrationEnabled = process.env.RUN_TASKS_MULTI_CLIENT_INTEGRATION === '1';
const localSupabaseUrl = process.env.TASKS_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const localPowerSyncUrl = process.env.TASKS_TEST_POWERSYNC_URL ?? 'http://127.0.0.1:8081';
const localSupabaseAnonKey = process.env.TASKS_TEST_SUPABASE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlLWRlbW8iLCJyb2xlIjoiYW5vbiIsImV4cCI6MTk4MzgxMjk5Nn0.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

type SyncIssue = {
  task_id: string;
  kind: string;
  operation: string;
  local_revision: number | null;
  remote_revision: number | null;
  code: string;
};

let testDirectory: string | null = null;
let activeDatabase: PowerSyncDatabase | null = null;
let supabase: SupabaseClient<Database> | null = null;

afterAll(async () => {
  if (activeDatabase !== null) {
    await activeDatabase.disconnectAndClear().catch(() => undefined);
    await activeDatabase.close().catch(() => undefined);
  }
  await supabase?.auth.signOut().catch(() => undefined);
  if (testDirectory !== null) {
    await rm(testDirectory, { recursive: true, force: true });
  }
});

describe.skipIf(!integrationEnabled)('Tasks multi-client convergence integration', () => {
  it('converges Raycast capture, offline web edits, and MCP edits without overwrites', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-tasks-multi-client-'));
    supabase = createClient<Database>(localSupabaseUrl, localSupabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const unique = `${Date.now()}-${crypto.randomUUID()}`;
    const email = `bathos-multi-client-${unique}@example.test`;
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password: `BathOS-${crypto.randomUUID()}-multi-client`,
    });
    expect(signUpError).toBeNull();
    expect(signUp.session).not.toBeNull();
    const ownerId = signUp.user?.id;
    expect(ownerId).toBeTruthy();
    if (!ownerId) throw new Error('Synthetic owner creation failed');

    activeDatabase = createNodeDatabase(testDirectory, 'multi-client.db');
    await activeDatabase.waitForReady();
    await bindTasksDatabaseOwner(activeDatabase, ownerId);
    const connector = createTasksSupabaseConnector({
      endpoint: localPowerSyncUrl,
      supabase,
    });
    await activeDatabase.connect(connector);
    await activeDatabase.waitForFirstSync(AbortSignal.timeout(30_000));

    const repository = new TaskRepository(activeDatabase);
    await repository.ensurePlanningSettings(ownerId, 'America/Los_Angeles');
    await waitForUploadQueue(activeDatabase, 0);

    const auth = { userId: ownerId, email, supabase };
    const raycastInput = {
      idempotency_key: crypto.randomUUID(),
      title: 'Captured Through Raycast',
      notes: 'One logical quick-entry request',
      destination: 'inbox' as const,
      today_section: 'daytime' as const,
      entry_channel: 'raycast' as const,
    };
    const raycastResults = await Promise.all([
      createTaskData(raycastInput, auth),
      createTaskData(raycastInput, auth),
    ]);
    expect(raycastResults.map((result) => result.idempotency_outcome).sort())
      .toEqual(['already_applied', 'created']);
    const taskId = raycastResults[0].task.id;
    expect(raycastResults[1].task.id).toBe(taskId);
    expect(raycastResults[0]).toMatchObject({
      receipt: { mutation_channel: 'raycast', outcome: 'accepted' },
      task: { entry_channel: 'raycast', revision: 1 },
    });

    await waitForLocalTask(activeDatabase, taskId, (task) => task.revision === 1);
    await activeDatabase.disconnect();

    const localWebEdit = await repository.updateTask(ownerId, taskId, {
      title: 'Offline Web Edit',
    });
    expect(localWebEdit).toMatchObject({
      revision: 2,
      last_mutation_channel: 'web',
      last_actor_type: 'user',
    });
    expect((await activeDatabase.getUploadQueueStats()).count).toBeGreaterThan(0);

    const mcpWinner = await updateTaskData({
      task_id: taskId,
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
      title: 'MCP Edit Wins First',
    }, auth);
    expect(mcpWinner).toMatchObject({
      mutation_outcome: 'applied',
      receipt: {
        mutation_channel: 'mcp',
        base_revision: 1,
        result_revision: 2,
      },
      task: { title: 'MCP Edit Wins First', revision: 2 },
    });

    await activeDatabase.connect(connector);
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    const convergedAfterMcp = await waitForLocalTask(
      activeDatabase,
      taskId,
      (task) => task.revision === 2 && task.title === 'MCP Edit Wins First',
    );
    expect(convergedAfterMcp).toMatchObject({
      entry_channel: 'raycast',
      last_mutation_channel: 'mcp',
      last_actor_type: 'automation',
    });
    const issue = await activeDatabase.getOptional<SyncIssue>(
      `SELECT task_id, kind, operation, local_revision, remote_revision, code
       FROM tasks_sync_issues
       WHERE task_id = ?
       ORDER BY detected_at DESC
       LIMIT 1`,
      [taskId],
    );
    expect(issue).toEqual({
      task_id: taskId,
      kind: 'conflict',
      operation: 'PATCH',
      local_revision: 2,
      remote_revision: 2,
      code: 'revision_conflict',
    });

    await activeDatabase.disconnect();
    const webWinner = await repository.updateTask(ownerId, taskId, {
      title: 'Offline Web Edit Wins Second',
    });
    expect(webWinner).toMatchObject({ title: 'Offline Web Edit Wins Second', revision: 3 });
    await activeDatabase.connect(connector);
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    await waitForRemoteTask(supabase, taskId, 3, 'Offline Web Edit Wins Second');

    const staleMcp = await updateTaskData({
      task_id: taskId,
      expected_revision: 2,
      client_mutation_id: crypto.randomUUID(),
      title: 'Stale MCP Edit Must Not Win',
    }, auth);
    expect(staleMcp).toMatchObject({
      mutation_outcome: 'conflict',
      receipt: {
        mutation_channel: 'mcp',
        outcome: 'conflict',
        code: 'revision_conflict',
        base_revision: 2,
        result_revision: 3,
      },
      task: { title: 'Offline Web Edit Wins Second', revision: 3 },
    });

    const raycastReplay = await createTaskData(raycastInput, auth);
    expect(raycastReplay).toMatchObject({
      idempotency_outcome: 'already_applied',
      receipt: { mutation_channel: 'raycast' },
      task: {
        id: taskId,
        title: 'Offline Web Edit Wins Second',
        entry_channel: 'raycast',
        last_mutation_channel: 'web',
        revision: 3,
      },
    });

    const finalLocal = await waitForLocalTask(
      activeDatabase,
      taskId,
      (task) => task.revision === 3 && task.title === 'Offline Web Edit Wins Second',
    );
    expect(finalLocal.entry_channel).toBe('raycast');
    const localCopies = await activeDatabase.getAll<{ id: string }>(
      'SELECT id FROM tasks_todos WHERE id = ?',
      [taskId],
    );
    expect(localCopies).toHaveLength(1);
    const { count, error: countError } = await supabase
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('id', taskId);
    expect(countError).toBeNull();
    expect(count).toBe(1);
  }, 120_000);
});

function createNodeDatabase(directory: string, databaseFilename: string): PowerSyncDatabase {
  return new PowerSyncDatabase({
    schema: tasksPowerSyncSchema,
    database: {
      dbFilename: databaseFilename,
      dbLocation: directory,
      implementation: { type: 'better-sqlite3' },
    },
  });
}

async function waitForUploadQueue(
  database: PowerSyncDatabase,
  expectedCount: number,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await database.getUploadQueueStats()).count === expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Upload queue did not reach ${expectedCount}`);
}

async function waitForLocalTask(
  database: PowerSyncDatabase,
  taskId: string,
  predicate: (task: TaskTodo) => boolean,
  timeoutMs = 30_000,
): Promise<TaskTodo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await database.getOptional<TaskTodo>(
      'SELECT * FROM tasks_todos WHERE id = ?',
      [taskId],
    );
    if (task !== null && predicate(task)) return task;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local task ${taskId} did not reach the expected state`);
}

async function waitForRemoteTask(
  client: SupabaseClient<Database>,
  taskId: string,
  expectedRevision: number,
  expectedTitle: string,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('tasks_todos')
      .select('revision, title')
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw error;
    if (data?.revision === expectedRevision && data.title === expectedTitle) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Remote task ${taskId} did not reach the expected state`);
}

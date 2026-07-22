// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import { createTaskData } from '@/lib/mcp/tools/tasks-create';
import { transitionTaskData, updateTaskData } from '@/lib/mcp/tools/tasks-mutate';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const integrationEnabled = process.env.RUN_TASKS_SUSTAINED_INTEGRATION === '1';
const localSupabaseUrl = process.env.TASKS_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const localPowerSyncUrl = process.env.TASKS_TEST_POWERSYNC_URL ?? 'http://127.0.0.1:8081';
const localSupabaseAnonKey = process.env.TASKS_TEST_SUPABASE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const requestedDurationMs = readPositiveInteger('TASKS_SUSTAINED_DURATION_MS', 10 * 60_000);
const cadenceMs = readPositiveInteger('TASKS_SUSTAINED_CADENCE_MS', 2_000);
const minimumCycles = readPositiveInteger('TASKS_SUSTAINED_MINIMUM_CYCLES', 20);

type TestClient = {
  filename: string;
  database: PowerSyncDatabase;
  repository: TaskRepository;
};

type SyncIssueCount = {
  count: number;
};

let testDirectory: string | null = null;
const openedDatabases = new Set<PowerSyncDatabase>();
let supabase: SupabaseClient<Database> | null = null;

afterAll(async () => {
  for (const database of openedDatabases) {
    await database.disconnectAndClear().catch(() => undefined);
    await database.close().catch(() => undefined);
  }
  await supabase?.auth.signOut().catch(() => undefined);
  if (testDirectory !== null) {
    await rm(testDirectory, { recursive: true, force: true });
  }
});

describe.skipIf(!integrationEnabled)('Tasks sustained parallel-use integration', () => {
  it('converges repeated web, Raycast, and MCP activity through offline loss and restarts', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-tasks-sustained-'));
    supabase = createClient<Database>(localSupabaseUrl, localSupabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const unique = `${Date.now()}-${crypto.randomUUID()}`;
    const email = `bathos-sustained-${unique}@example.test`;
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password: `BathOS-${crypto.randomUUID()}-sustained`,
    });
    expect(signUpError).toBeNull();
    expect(signUp.session).not.toBeNull();
    const ownerId = signUp.user?.id;
    expect(ownerId).toBeTruthy();
    if (!ownerId) throw new Error('Synthetic owner creation failed');

    const connector = createTasksSupabaseConnector({
      endpoint: localPowerSyncUrl,
      supabase,
    });
    const primary = await openClient(testDirectory, 'sustained-primary.db', ownerId, connector);
    let secondary = await openClient(testDirectory, 'sustained-secondary.db', ownerId, connector);
    await primary.repository.ensurePlanningSettings(ownerId, 'America/Los_Angeles');
    await waitForUploadQueue(primary.database, 0);
    await waitForLocalSettings(secondary.database, ownerId);

    const auth = { userId: ownerId, email, supabase };
    const startedAt = Date.now();
    let cycles = 0;
    let offlineConflictReceipts = 0;
    let staleMcpConflictReceipts = 0;
    let exactCaptureRetries = 0;
    let exactTransitionRetries = 0;
    let clientRestarts = 0;

    while (Date.now() - startedAt < requestedDurationMs || cycles < minimumCycles) {
      const cycleStartedAt = Date.now();
      cycles += 1;
      const captureId = crypto.randomUUID();
      const captureInput = {
        idempotency_key: captureId,
        title: `Sustained Synthetic Task ${cycles}`,
        notes: `Synthetic endurance cycle ${cycles}`,
        destination: 'anytime' as const,
        today_section: 'later' as const,
        entry_channel: 'raycast' as const,
      };
      const captureResults = await Promise.all([
        createTaskData(captureInput, auth),
        createTaskData(captureInput, auth),
      ]);
      expect(captureResults.map((result) => result.idempotency_outcome).sort())
        .toEqual(['already_applied', 'created']);
      exactCaptureRetries += 1;
      const taskId = captureResults[0].task.id;
      expect(captureResults[1].task.id).toBe(taskId);
      await Promise.all([
        waitForLocalTask(primary.database, taskId, (task) => task.revision === 1),
        waitForLocalTask(secondary.database, taskId, (task) => task.revision === 1),
      ]);

      let authoritativeTitle: string;
      if (cycles % 2 === 1) {
        await primary.database.disconnect();
        await primary.repository.updateTask(ownerId, taskId, {
          title: `Offline Web Edit ${cycles}`,
        });
        const mcpWinner = await updateTaskData({
          task_id: taskId,
          expected_revision: 1,
          client_mutation_id: crypto.randomUUID(),
          title: `MCP Edit ${cycles}`,
        }, auth);
        expect(mcpWinner.mutation_outcome).toBe('applied');
        authoritativeTitle = `MCP Edit ${cycles}`;
        await primary.database.connect(connector);
        await waitForUploadQueue(primary.database, 0, 60_000);
        offlineConflictReceipts += 1;
      } else {
        authoritativeTitle = `Web Edit ${cycles}`;
        await primary.repository.updateTask(ownerId, taskId, {
          title: authoritativeTitle,
        });
        await waitForRemoteTask(supabase, taskId, 2, authoritativeTitle);
        const staleMcp = await updateTaskData({
          task_id: taskId,
          expected_revision: 1,
          client_mutation_id: crypto.randomUUID(),
          title: `Stale MCP Edit ${cycles}`,
        }, auth);
        expect(staleMcp.mutation_outcome).toBe('conflict');
        staleMcpConflictReceipts += 1;
      }

      await Promise.all([
        waitForLocalTask(
          primary.database,
          taskId,
          (task) => task.revision === 2 && task.title === authoritativeTitle,
        ),
        waitForLocalTask(
          secondary.database,
          taskId,
          (task) => task.revision === 2 && task.title === authoritativeTitle,
        ),
      ]);

      const transitionInput = {
        task_id: taskId,
        expected_revision: 2,
        client_mutation_id: crypto.randomUUID(),
        transition: 'complete' as const,
      };
      const completion = await transitionTaskData(transitionInput, auth);
      const completionReplay = await transitionTaskData(transitionInput, auth);
      expect(completion.mutation_outcome).toBe('applied');
      expect(completionReplay.mutation_outcome).toBe('already_applied');
      exactTransitionRetries += 1;
      await Promise.all([
        waitForLocalTask(
          primary.database,
          taskId,
          (task) => task.revision === 3 && task.lifecycle === 'completed',
        ),
        waitForLocalTask(
          secondary.database,
          taskId,
          (task) => task.revision === 3 && task.lifecycle === 'completed',
        ),
      ]);

      if (cycles % 25 === 0) {
        secondary = await restartClient(secondary, testDirectory, ownerId, connector);
        clientRestarts += 1;
        await waitForLocalTask(
          secondary.database,
          taskId,
          (task) => task.revision === 3 && task.lifecycle === 'completed',
        );
        console.info(
          `[tasks-sustained] cycles=${cycles} elapsed_ms=${Date.now() - startedAt} restarts=${clientRestarts}`,
        );
      }

      const delayMs = cadenceMs - (Date.now() - cycleStartedAt);
      if (delayMs > 0) await delay(delayMs);
    }

    await Promise.all([
      waitForUploadQueue(primary.database, 0),
      waitForUploadQueue(secondary.database, 0),
    ]);
    await waitForOwnerTaskCount(primary.database, ownerId, cycles);
    await waitForOwnerTaskCount(secondary.database, ownerId, cycles);

    const { count: remoteTaskCount, error: remoteTaskCountError } = await supabase
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    expect(remoteTaskCountError).toBeNull();
    expect(remoteTaskCount).toBe(cycles);

    const { count: completedTaskCount, error: completedTaskCountError } = await supabase
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('lifecycle', 'completed')
      .eq('revision', 3);
    expect(completedTaskCountError).toBeNull();
    expect(completedTaskCount).toBe(cycles);

    const { count: historyCount, error: historyCountError } = await supabase
      .from('tasks_history_events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    expect(historyCountError).toBeNull();
    expect(historyCount).toBe(cycles * 3);

    const primaryConflictCount = await primary.database.getOptional<SyncIssueCount>(
      `SELECT COUNT(*) AS count
       FROM tasks_sync_issues
       WHERE kind = 'conflict' AND code = 'revision_conflict'`,
    );
    expect(Number(primaryConflictCount?.count ?? 0)).toBe(offlineConflictReceipts);

    const elapsedMs = Date.now() - startedAt;
    console.info(
      `[tasks-sustained] passed duration_ms=${elapsedMs} cycles=${cycles} tasks=${remoteTaskCount} history=${historyCount} offline_conflicts=${offlineConflictReceipts} stale_mcp_conflicts=${staleMcpConflictReceipts} capture_retries=${exactCaptureRetries} transition_retries=${exactTransitionRetries} restarts=${clientRestarts}`,
    );

    expect(elapsedMs).toBeGreaterThanOrEqual(requestedDurationMs);
    expect(cycles).toBeGreaterThanOrEqual(minimumCycles);
    expect(offlineConflictReceipts + staleMcpConflictReceipts).toBe(cycles);
    expect(exactCaptureRetries).toBe(cycles);
    expect(exactTransitionRetries).toBe(cycles);
  });
});

async function openClient(
  directory: string,
  filename: string,
  ownerId: string,
  connector: ReturnType<typeof createTasksSupabaseConnector>,
): Promise<TestClient> {
  const database = new PowerSyncDatabase({
    schema: tasksPowerSyncSchema,
    database: {
      dbFilename: filename,
      dbLocation: directory,
      implementation: { type: 'better-sqlite3' },
    },
  });
  openedDatabases.add(database);
  await database.waitForReady();
  await bindTasksDatabaseOwner(database, ownerId);
  await database.connect(connector);
  await database.waitForFirstSync(AbortSignal.timeout(30_000));
  return { filename, database, repository: new TaskRepository(database) };
}

async function restartClient(
  client: TestClient,
  directory: string,
  ownerId: string,
  connector: ReturnType<typeof createTasksSupabaseConnector>,
): Promise<TestClient> {
  await client.database.disconnect();
  await client.database.close();
  return openClient(directory, client.filename, ownerId, connector);
}

async function waitForUploadQueue(
  database: PowerSyncDatabase,
  expectedCount: number,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await database.getUploadQueueStats()).count === expectedCount) return;
    await delay(100);
  }
  throw new Error(`Upload queue did not reach ${expectedCount}`);
}

async function waitForLocalSettings(
  database: PowerSyncDatabase,
  ownerId: string,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const settings = await database.getOptional<{ owner_id: string }>(
      'SELECT owner_id FROM tasks_user_settings WHERE owner_id = ?',
      [ownerId],
    );
    if (settings?.owner_id === ownerId) return;
    await delay(100);
  }
  throw new Error('Secondary client did not receive task settings');
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
    await delay(100);
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
    await delay(100);
  }
  throw new Error(`Remote task ${taskId} did not reach the expected state`);
}

async function waitForOwnerTaskCount(
  database: PowerSyncDatabase,
  ownerId: string,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const row = await database.getOptional<{ count: number }>(
      'SELECT COUNT(*) AS count FROM tasks_todos WHERE owner_id = ?',
      [ownerId],
    );
    if (Number(row?.count ?? 0) === expectedCount) return;
    await delay(100);
  }
  throw new Error(`Local task count did not reach ${expectedCount}`);
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { TaskTemplateService } from '@/modules/tasks/data/taskTemplateService';
import { generateTaskOrderKey } from '@/modules/tasks/domain/taskOrder';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const integrationEnabled = process.env.RUN_TASKS_OFFLINE_INTEGRATION === '1';
const localSupabaseUrl = process.env.TASKS_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const localPowerSyncUrl = process.env.TASKS_TEST_POWERSYNC_URL ?? 'http://127.0.0.1:8081';
const localSupabaseAnonKey = process.env.TASKS_TEST_SUPABASE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

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

describe.skipIf(!integrationEnabled)('Tasks offline persistence integration', () => {
  it('survives restart and reconciles every core offline mutation', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-tasks-offline-'));
    const databaseFilename = 'offline-workflows.db';
    supabase = createClient<Database>(localSupabaseUrl, localSupabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const unique = `${Date.now()}-${crypto.randomUUID()}`;
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email: `bathos-offline-${unique}@example.test`,
      password: `BathOS-${crypto.randomUUID()}-offline`,
    });
    expect(signUpError).toBeNull();
    expect(signUp.session).not.toBeNull();
    const ownerId = signUp.user?.id;
    expect(ownerId).toBeTruthy();
    if (!ownerId) throw new Error('Synthetic owner creation failed');

    activeDatabase = createNodeDatabase(testDirectory, databaseFilename);
    await activeDatabase.waitForReady();
    await bindTasksDatabaseOwner(activeDatabase, ownerId);
    const connector = createTasksSupabaseConnector({
      endpoint: localPowerSyncUrl,
      supabase,
    });
    await activeDatabase.connect(connector);
    await activeDatabase.waitForFirstSync(AbortSignal.timeout(30_000));

    let repository = new TaskRepository(activeDatabase);
    await repository.ensurePlanningSettings(ownerId, 'America/Los_Angeles');
    const alpha = await repository.createTask({
      ownerId,
      title: 'Offline Alpha',
      destination: 'anytime',
      todaySection: 'next',
      startDate: '2026-07-20',
    });
    const beta = await repository.createTask({
      ownerId,
      title: 'Offline Beta',
      destination: 'anytime',
      todaySection: 'next',
      startDate: '2026-07-20',
    });
    const recurrenceSource = await repository.createTask({
      ownerId,
      title: 'Offline Recurrence Source',
      destination: 'anytime',
    });
    await waitForUploadQueue(activeDatabase, 0);

    const template = await new TaskTemplateService(supabase, ownerId).capture({
      sourceType: 'todo',
      sourceId: recurrenceSource.id,
      name: 'Offline Recurrence Template',
      anchorDate: '2026-07-20',
    });
    const recurrenceService = new TaskRecurrenceService(supabase, ownerId);
    const recurrence = await recurrenceService.save({
      name: 'Offline Recurrence',
      templateId: template.template.id,
      templateRevision: template.revision.revision,
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 1,
      startDate: '2026-07-20',
      planningTimeZone: 'America/Los_Angeles',
      missedPolicy: 'latest',
    });
    const evaluation = await recurrenceService.evaluate(
      recurrence.definition.id,
      '2026-07-20',
    );
    expect(evaluation.generated_count).toBe(1);
    const { data: occurrenceRecord, error: occurrenceError } = await supabase
      .from('tasks_recurrence_occurrences')
      .select('root_id')
      .eq('id', evaluation.occurrence_ids[0])
      .single();
    expect(occurrenceError).toBeNull();
    expect(occurrenceRecord?.root_id).toBeTruthy();
    if (!occurrenceRecord?.root_id) throw new Error('Recurrence occurrence root is missing');
    const occurrence = await waitForTask(
      activeDatabase,
      occurrenceRecord.root_id,
      30_000,
    );

    await activeDatabase.disconnect();

    const createdOffline = await repository.createTask({
      ownerId,
      title: 'Created While Offline',
      destination: 'anytime',
      todaySection: 'later',
    });
    await repository.updateTask(ownerId, alpha.id, {
      title: 'Offline Alpha Edited',
      notes: 'Edited without a network connection',
    });
    await repository.moveTask(ownerId, alpha.id, {
      destination: 'anytime',
      todaySection: 'none',
      startDate: '2026-07-21',
    });
    await repository.updateTask(ownerId, beta.id, {
      order_key: generateTaskOrderKey(null, alpha.order_key),
    });
    await repository.transitionTask(ownerId, beta.id, 'complete');
    await repository.transitionTask(ownerId, occurrence.id, 'complete');
    await repository.transitionTask(ownerId, alpha.id, 'delete');
    await repository.transitionTask(ownerId, alpha.id, 'restore');
    await repository.transitionTask(ownerId, createdOffline.id, 'delete');

    const queueBeforeRestart = await activeDatabase.getUploadQueueStats();
    expect(queueBeforeRestart.count).toBeGreaterThan(0);
    await activeDatabase.close();
    activeDatabase = null;

    activeDatabase = createNodeDatabase(testDirectory, databaseFilename);
    await activeDatabase.waitForReady();
    await bindTasksDatabaseOwner(activeDatabase, ownerId);
    repository = new TaskRepository(activeDatabase);

    const afterRestart = await readTasks(activeDatabase, ownerId);
    expect(afterRestart.get(alpha.id)).toMatchObject({
      title: 'Offline Alpha Edited',
      notes: 'Edited without a network connection',
      start_date: '2026-07-21',
      disposition: 'present',
    });
    expect(afterRestart.get(beta.id)).toMatchObject({ lifecycle: 'completed' });
    expect(afterRestart.get(occurrence.id)).toMatchObject({
      lifecycle: 'completed',
      template_instantiation_id: occurrence.template_instantiation_id,
    });
    expect(afterRestart.get(createdOffline.id)).toMatchObject({
      disposition: 'deleted',
    });
    expect((await activeDatabase.getUploadQueueStats()).count).toBeGreaterThan(0);

    await repository.transitionTask(ownerId, createdOffline.id, 'restore');
    await activeDatabase.connect(connector);
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    await waitForRemoteTask(supabase, alpha.id, 5);
    await waitForRemoteTask(supabase, beta.id, 3);
    await waitForRemoteTask(supabase, occurrence.id, occurrence.revision + 1);
    await waitForRemoteTask(supabase, createdOffline.id, 3);

    const { data: remoteRows, error: remoteError } = await supabase
      .from('tasks_todos')
      .select('*')
      .in('id', [alpha.id, beta.id, occurrence.id, createdOffline.id]);
    expect(remoteError).toBeNull();
    expect(remoteRows).toHaveLength(4);
    const remote = new Map(remoteRows?.map((task) => [task.id, task]) ?? []);
    expect(remote.get(alpha.id)).toMatchObject({
      title: 'Offline Alpha Edited',
      start_date: '2026-07-21',
      disposition: 'present',
    });
    expect(remote.get(beta.id)).toMatchObject({ lifecycle: 'completed' });
    expect(remote.get(occurrence.id)).toMatchObject({ lifecycle: 'completed' });
    expect(remote.get(createdOffline.id)).toMatchObject({ disposition: 'present' });

    await activeDatabase.close();
    activeDatabase = createNodeDatabase(testDirectory, databaseFilename);
    await activeDatabase.waitForReady();
    await bindTasksDatabaseOwner(activeDatabase, ownerId);
    const finalRows = await readTasks(activeDatabase, ownerId);
    expect(finalRows.size).toBe(5);
    expect(finalRows.get(alpha.id)?.revision).toBe(5);
    expect(finalRows.get(beta.id)?.lifecycle).toBe('completed');
    expect(finalRows.get(occurrence.id)?.lifecycle).toBe('completed');
    expect(finalRows.get(createdOffline.id)?.disposition).toBe('present');
    expect((await activeDatabase.getUploadQueueStats()).count).toBe(0);
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

async function waitForTask(
  database: PowerSyncDatabase,
  taskId: string,
  timeoutMs: number,
): Promise<TaskTodo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await database.getOptional<TaskTodo>(
      'SELECT * FROM tasks_todos WHERE id = ?',
      [taskId],
    );
    if (task !== null) return task;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Task ${taskId} did not synchronize`);
}

async function waitForRemoteTask(
  client: SupabaseClient<Database>,
  taskId: string,
  expectedRevision: number,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('tasks_todos')
      .select('revision')
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw error;
    if (data?.revision === expectedRevision) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Remote task ${taskId} did not reach revision ${expectedRevision}`);
}

async function readTasks(
  database: PowerSyncDatabase,
  ownerId: string,
): Promise<Map<string, TaskTodo>> {
  const tasks = await database.getAll<TaskTodo>(
    'SELECT * FROM tasks_todos WHERE owner_id = ?',
    [ownerId],
  );
  return new Map(tasks.map((task) => [task.id, task]));
}

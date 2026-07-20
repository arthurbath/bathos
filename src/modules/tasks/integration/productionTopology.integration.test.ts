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
import { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { TaskTemplateService } from '@/modules/tasks/data/taskTemplateService';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const integrationEnabled = process.env.RUN_TASKS_PRODUCTION_TOPOLOGY === '1';

type OwnerSession = {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
};

type TestClient = {
  filename: string;
  database: PowerSyncDatabase;
  repository: TaskRepository;
};

type SyncIssue = {
  task_id: string;
  kind: string;
  code: string;
};

type ProjectionReceiptTable =
  | 'tasks_recurrence_evaluations'
  | 'tasks_recurrence_status_events'
  | 'tasks_reminder_occurrences'
  | 'tasks_delivery_targets'
  | 'tasks_reminder_deliveries'
  | 'tasks_reminder_claims';

const projectionReceiptTables: ProjectionReceiptTable[] = [
  'tasks_recurrence_evaluations',
  'tasks_recurrence_status_events',
  'tasks_reminder_occurrences',
  'tasks_delivery_targets',
  'tasks_reminder_deliveries',
  'tasks_reminder_claims',
];

let testDirectory: string | null = null;
let admin: SupabaseClient<Database> | null = null;
const openedDatabases = new Set<PowerSyncDatabase>();
const signedInClients = new Set<SupabaseClient<Database>>();
const syntheticUserIds = new Set<string>();

afterAll(async () => {
  for (const database of openedDatabases) {
    await database.disconnectAndClear().catch(() => undefined);
    await database.close().catch(() => undefined);
  }
  for (const client of signedInClients) {
    await client.auth.signOut().catch(() => undefined);
  }
  if (admin !== null) {
    for (const userId of syntheticUserIds) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
  if (testDirectory !== null) {
    await rm(testDirectory, { recursive: true, force: true });
  }
});

describe.skipIf(!integrationEnabled)('Tasks production topology integration', () => {
  it('proves synthetic cross-client convergence, owner isolation, restart, and cleanup', async () => {
    const environment = productionEnvironment();
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-tasks-production-topology-'));
    admin = createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ownerA = await createSyntheticOwner('a', environment);
    const ownerB = await createSyntheticOwner('b', environment);
    const connectorA = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: ownerA.client,
    });
    const connectorB = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: ownerB.client,
    });

    const primary = await openClient(testDirectory, 'owner-a-primary.db', ownerA.id, connectorA);
    let secondary = await openClient(
      testDirectory,
      'owner-a-secondary.db',
      ownerA.id,
      connectorA,
    );
    const unrelated = await openClient(testDirectory, 'owner-b.db', ownerB.id, connectorB);
    await primary.repository.ensurePlanningSettings(ownerA.id, 'America/Los_Angeles');
    await unrelated.repository.ensurePlanningSettings(ownerB.id, 'America/Los_Angeles');
    await Promise.all([
      waitForUploadQueue(primary.database, 0),
      waitForUploadQueue(unrelated.database, 0),
      waitForLocalSettings(secondary.database, ownerA.id),
    ]);

    const authA = { userId: ownerA.id, email: ownerA.email, supabase: ownerA.client };
    const authB = { userId: ownerB.id, email: ownerB.email, supabase: ownerB.client };
    const captureInput = {
      idempotency_key: crypto.randomUUID(),
      title: 'Synthetic Production Topology Task',
      notes: 'Disposable topology validation only',
      destination: 'inbox' as const,
      today_section: 'daytime' as const,
      entry_channel: 'raycast' as const,
    };
    const captures = await Promise.all([
      createTaskData(captureInput, authA),
      createTaskData(captureInput, authA),
    ]);
    expect(captures.map(({ idempotency_outcome: outcome }) => outcome).sort())
      .toEqual(['already_applied', 'created']);
    const taskId = captures[0].task.id;
    expect(captures[1].task.id).toBe(taskId);
    await Promise.all([
      waitForLocalTask(primary.database, taskId, (task) => task.revision === 1),
      waitForLocalTask(secondary.database, taskId, (task) => task.revision === 1),
    ]);

    expect(await localTaskCount(unrelated.database)).toBe(0);
    await expect(updateTaskData({
      task_id: taskId,
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
      title: 'Cross-Owner Mutation Must Fail',
    }, authB)).rejects.toThrow('task is unavailable');

    const template = await new TaskTemplateService(ownerA.client, ownerA.id).capture({
      sourceType: 'todo',
      sourceId: taskId,
      name: 'Synthetic Topology Template',
      anchorDate: '2030-01-01',
    });
    const recurrenceService = new TaskRecurrenceService(ownerA.client, ownerA.id);
    const recurrence = await recurrenceService.save({
      name: 'Synthetic Topology Recurrence',
      templateId: template.template.id,
      templateRevision: template.revision.revision,
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 1,
      startDate: '2030-01-01',
      planningTimeZone: 'America/Los_Angeles',
      missedPolicy: 'latest',
    });
    const recurrenceEvaluation = await recurrenceService.evaluate(
      recurrence.definition.id,
      '2030-01-01',
    );
    expect(recurrenceEvaluation.generated_count).toBe(1);
    const recurrenceStatus = await recurrenceService.setStatus(
      recurrenceEvaluation.definition,
      'paused',
    );
    expect(recurrenceStatus.outcome).toBe('accepted');

    const reminderService = new TaskReminderService(ownerA.client);
    const reminder = await reminderService.save({
      rootType: 'todo',
      rootId: taskId,
      localDate: '2030-01-01',
      localTime: '09:00',
      timeZone: 'America/Los_Angeles',
    });
    expect(reminder.outcome).toBe('accepted');
    const claim = await reminderService.claimDue('2030-01-02T00:00:00.000Z');
    expect(claim.items).toHaveLength(1);
    for (const table of projectionReceiptTables) {
      await Promise.all([
        waitForLocalTableCount(primary.database, table, 1),
        waitForLocalTableCount(secondary.database, table, 1),
      ]);
      expect(await localTableCount(unrelated.database, table)).toBe(0);
    }

    await primary.database.disconnect();
    await primary.repository.updateTask(ownerA.id, taskId, {
      title: 'Queued Offline Web Edit',
    });
    const mcpWinner = await updateTaskData({
      task_id: taskId,
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
      title: 'Accepted MCP Edit',
    }, authA);
    expect(mcpWinner.mutation_outcome).toBe('applied');
    await primary.database.connect(connectorA);
    await waitForUploadQueue(primary.database, 0, 60_000);
    await Promise.all([
      waitForLocalTask(
        primary.database,
        taskId,
        (task) => task.revision === 2 && task.title === 'Accepted MCP Edit',
      ),
      waitForLocalTask(
        secondary.database,
        taskId,
        (task) => task.revision === 2 && task.title === 'Accepted MCP Edit',
      ),
    ]);
    expect(await primary.database.getOptional<SyncIssue>(
      `SELECT task_id, kind, code
       FROM tasks_sync_issues
       WHERE task_id = ? AND kind = 'conflict'
       ORDER BY detected_at DESC
       LIMIT 1`,
      [taskId],
    )).toEqual({ task_id: taskId, kind: 'conflict', code: 'revision_conflict' });

    const transitionInput = {
      task_id: taskId,
      expected_revision: 2,
      client_mutation_id: crypto.randomUUID(),
      transition: 'complete' as const,
    };
    const completion = await transitionTaskData(transitionInput, authA);
    const completionReplay = await transitionTaskData(transitionInput, authA);
    expect(completion.mutation_outcome).toBe('applied');
    expect(completionReplay.mutation_outcome).toBe('already_applied');
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

    secondary = await restartClient(secondary, testDirectory, ownerA.id, connectorA);
    await waitForLocalTask(
      secondary.database,
      taskId,
      (task) => task.revision === 3 && task.lifecycle === 'completed',
    );
    expect(await localTaskCount(primary.database)).toBe(2);
    expect(await localTaskCount(secondary.database)).toBe(2);
    expect(await localTaskCount(unrelated.database)).toBe(0);

    const { count: taskCount, error: taskCountError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerA.id)
      .eq('id', taskId);
    expect(taskCountError).toBeNull();
    expect(taskCount).toBe(1);
    const { count: historyCount, error: historyCountError } = await admin
      .from('tasks_history_events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerA.id)
      .eq('task_id', taskId);
    expect(historyCountError).toBeNull();
    expect(historyCount).toBe(3);

    await disposeClient(primary);
    await disposeClient(secondary);
    await disposeClient(unrelated);
    await deleteSyntheticOwner(ownerA.id);
    await deleteSyntheticOwner(ownerB.id);
    const { count: residueCount, error: residueError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('id', taskId);
    expect(residueError).toBeNull();
    expect(residueCount).toBe(0);
  });
});

function productionEnvironment() {
  if (process.env.TASKS_PRODUCTION_TEST_CONFIRM !== 'synthetic-only') {
    throw new Error('TASKS_PRODUCTION_TEST_CONFIRM must equal synthetic-only');
  }
  return {
    supabaseUrl: requireEnvironment('TASKS_PRODUCTION_TEST_SUPABASE_URL'),
    publishableKey: requireEnvironment('TASKS_PRODUCTION_TEST_SUPABASE_KEY'),
    serviceRoleKey: requireEnvironment('TASKS_PRODUCTION_TEST_SERVICE_ROLE_KEY'),
    powerSyncUrl: requireEnvironment('TASKS_PRODUCTION_TEST_POWERSYNC_URL'),
  };
}

async function createSyntheticOwner(
  label: string,
  environment: ReturnType<typeof productionEnvironment>,
): Promise<OwnerSession> {
  if (admin === null) throw new Error('The synthetic-user administrator is unavailable');
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `bathos-production-topology-${label}-${unique}@example.test`;
  const password = `BathOS-${crypto.randomUUID()}-topology`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_purpose: 'tasks-production-topology' },
  });
  if (error) throw error;
  syntheticUserIds.add(data.user.id);
  const client = createClient<Database>(environment.supabaseUrl, environment.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  signedInClients.add(client);
  return { id: data.user.id, email, client };
}

async function deleteSyntheticOwner(userId: string): Promise<void> {
  if (admin === null) throw new Error('The synthetic-user administrator is unavailable');
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  syntheticUserIds.delete(userId);
}

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
  await database.waitForFirstSync(AbortSignal.timeout(45_000));
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
  openedDatabases.delete(client.database);
  return openClient(directory, client.filename, ownerId, connector);
}

async function disposeClient(client: TestClient): Promise<void> {
  await client.database.disconnectAndClear();
  await client.database.close();
  openedDatabases.delete(client.database);
}

async function waitForUploadQueue(
  database: PowerSyncDatabase,
  expectedCount: number,
  timeoutMs = 45_000,
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
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const row = await database.getOptional<{ owner_id: string }>(
      'SELECT owner_id FROM tasks_user_settings WHERE owner_id = ?',
      [ownerId],
    );
    if (row?.owner_id === ownerId) return;
    await delay(100);
  }
  throw new Error('The secondary client did not receive planning settings');
}

async function waitForLocalTask(
  database: PowerSyncDatabase,
  taskId: string,
  predicate: (task: TaskTodo) => boolean,
): Promise<TaskTodo> {
  const deadline = Date.now() + 45_000;
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

async function localTaskCount(database: PowerSyncDatabase): Promise<number> {
  const row = await database.getOptional<{ count: number }>(
    'SELECT COUNT(*) AS count FROM tasks_todos',
  );
  return Number(row?.count ?? 0);
}

async function waitForLocalTableCount(
  database: PowerSyncDatabase,
  table: ProjectionReceiptTable,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await localTableCount(database, table) === expectedCount) return;
    await delay(100);
  }
  throw new Error(`${table} did not reach ${expectedCount} synchronized rows`);
}

async function localTableCount(
  database: PowerSyncDatabase,
  table: ProjectionReceiptTable,
): Promise<number> {
  const row = await database.getOptional<{ count: number }>(
    `SELECT COUNT(*) AS count FROM ${table}`,
  );
  return Number(row?.count ?? 0);
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

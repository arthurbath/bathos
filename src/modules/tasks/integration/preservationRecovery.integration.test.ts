// @vitest-environment node

import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import {
  beginMailRetirementData,
  createMailTaskData,
  resolveMailRetirementData,
} from '@/lib/mcp/tools/tasks-mail';
import { transitionTaskData } from '@/lib/mcp/tools/tasks-mutate';
import { TaskHierarchyRepository } from '@/modules/tasks/data/taskHierarchyRepository';
import {
  createTaskExport,
  getTaskExportFilename,
  mergeTaskRestore,
  parseTaskExport,
  previewTaskRestore,
  serializeTaskExport,
  taskExportV10Collections,
} from '@/modules/tasks/data/taskPortability';
import { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { TaskTemplateService } from '@/modules/tasks/data/taskTemplateService';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';
import type { TaskHistoryEvent } from '@/modules/tasks/domain/taskHistory';
import type { TaskTodo } from '@/modules/tasks/types/tasks';

const integrationEnabled = process.env.RUN_TASKS_PRESERVATION_INTEGRATION === '1';
const localSupabaseUrl = process.env.TASKS_TEST_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const localPowerSyncUrl = process.env.TASKS_TEST_POWERSYNC_URL ?? 'http://127.0.0.1:8081';
const fallbackLocalAnonKey
  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const fallbackLocalJwtSecret = 'super-secret-jwt-token-with-at-least-32-characters-long';

let testDirectory: string | null = null;
let activeDatabase: PowerSyncDatabase | null = null;
let sourceClient: SupabaseClient<Database> | null = null;
let targetClient: SupabaseClient<Database> | null = null;
let adminClient: SupabaseClient<Database> | null = null;
const syntheticUserIds = new Set<string>();

afterAll(async () => {
  if (activeDatabase !== null) {
    await activeDatabase.disconnectAndClear().catch(() => undefined);
    await activeDatabase.close().catch(() => undefined);
  }
  if (adminClient !== null) {
    for (const userId of syntheticUserIds) {
      await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
  await sourceClient?.auth.signOut().catch(() => undefined);
  await targetClient?.auth.signOut().catch(() => undefined);
  if (testDirectory !== null) {
    await rm(testDirectory, { recursive: true, force: true });
  }
});

describe.skipIf(!integrationEnabled)('Tasks preservation and recovery integration', () => {
  it('survives undo, Trash, backup, source loss, verified restore, and replay', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-tasks-preservation-'));
    const anonKey = process.env.TASKS_TEST_SUPABASE_KEY ?? fallbackLocalAnonKey;
    sourceClient = createClient<Database>(localSupabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    targetClient = createClient<Database>(localSupabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    adminClient = createClient<Database>(
      localSupabaseUrl,
      process.env.TASKS_TEST_SUPABASE_SERVICE_KEY ?? createLocalServiceRoleKey(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const source = await createSyntheticOwner(sourceClient, 'preservation-source');
    const target = await createSyntheticOwner(targetClient, 'preservation-target');
    syntheticUserIds.add(source.id);
    syntheticUserIds.add(target.id);

    activeDatabase = createNodeDatabase(testDirectory, 'preservation.db');
    await activeDatabase.waitForReady();
    await bindTasksDatabaseOwner(activeDatabase, source.id);
    const connector = createTasksSupabaseConnector({
      endpoint: localPowerSyncUrl,
      supabase: sourceClient,
    });
    await activeDatabase.connect(connector);
    await activeDatabase.waitForFirstSync(AbortSignal.timeout(30_000));

    const repository = new TaskRepository(activeDatabase);
    const hierarchy = new TaskHierarchyRepository(activeDatabase);
    await repository.ensurePlanningSettings(source.id, 'America/Los_Angeles');
    const area = await hierarchy.createArea({ ownerId: source.id, title: 'Recovery Area' });
    const project = await hierarchy.createProject({
      ownerId: source.id,
      areaId: area.id,
      title: 'Recovery Project',
      notes: 'Representative hierarchy for backup validation',
    });
    const heading = await hierarchy.createHeading({
      ownerId: source.id,
      projectId: project.id,
      title: 'Recovery Heading',
    });
    const primary = await repository.createTask({
      ownerId: source.id,
      title: 'Preserve This Task',
      notes: 'Original notes',
      destination: 'anytime',
      projectId: project.id,
      headingId: heading.id,
    });
    await hierarchy.createChecklistItem({
      ownerId: source.id,
      taskId: primary.id,
      title: 'Preserve this checklist item',
    });
    const trashTask = await repository.createTask({
      ownerId: source.id,
      title: 'Restore Me From Backup Trash',
      destination: 'inbox',
    });
    await waitForUploadQueue(activeDatabase, 0, 60_000);

    const edited = await repository.updateTask(source.id, primary.id, {
      title: 'Temporary Edited Title',
      notes: 'Temporary edited notes',
    });
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    const editEvent = await waitForLocalHistory(
      activeDatabase,
      source.id,
      edited.client_mutation_id,
    );
    const undone = await repository.undoTask(source.id, editEvent.id);
    expect(undone).toMatchObject({
      title: 'Preserve This Task',
      notes: 'Original notes',
      revision: 3,
      undo_source_event_id: editEvent.id,
    });
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    await waitForRemoteTask(sourceClient, primary.id, 3, 'Preserve This Task');

    await repository.transitionTask(source.id, primary.id, 'delete');
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    await waitForRemoteDisposition(sourceClient, primary.id, 'deleted');
    await repository.transitionTask(source.id, primary.id, 'restore');
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    await waitForRemoteDisposition(sourceClient, primary.id, 'present');

    await repository.transitionTask(source.id, trashTask.id, 'delete');
    await waitForUploadQueue(activeDatabase, 0, 60_000);
    await waitForRemoteDisposition(sourceClient, trashTask.id, 'deleted');

    const sourceAuth = { userId: source.id, email: source.email, supabase: sourceClient };
    const messageIdentifier = `<${crypto.randomUUID()}@example.test>`;
    const mailCapture = await createMailTaskData({
      idempotency_key: crypto.randomUUID(),
      title: 'Preserve Structured Mail Task',
      notes: 'Synthetic Mail capture for export coverage',
      account_identifier: 'synthetic-account',
      mailbox_identifier: 'synthetic-inbox',
      message_identifier: messageIdentifier,
      deep_link: `message://${crypto.randomUUID()}`,
      retirement_destination_identifier: 'synthetic-archive',
      source_title: 'Synthetic source message',
      area_id: area.id,
    }, sourceAuth);
    expect(mailCapture).toMatchObject({
      idempotency_outcome: 'created',
      receipt: { outcome: 'accepted', mutation_channel: 'mail_automation' },
    });
    const { data: capturedMailSource, error: capturedMailSourceError } = await sourceClient
      .from('tasks_mail_sources')
      .select('*')
      .eq('message_identifier', messageIdentifier)
      .single();
    expect(capturedMailSourceError).toBeNull();
    if (!capturedMailSource) throw new Error('Captured Mail source is unavailable');
    const retirementStarted = await beginMailRetirementData({
      task_id: capturedMailSource.task_id,
      expected_revision: capturedMailSource.revision,
      idempotency_key: crypto.randomUUID(),
    }, sourceAuth);
    expect(retirementStarted).toMatchObject({
      idempotency_outcome: 'applied',
      receipt: { outcome: 'accepted', transition: 'retirement_started' },
    });
    const { data: pendingMailSource, error: pendingMailSourceError } = await sourceClient
      .from('tasks_mail_sources')
      .select('*')
      .eq('task_id', capturedMailSource.task_id)
      .single();
    expect(pendingMailSourceError).toBeNull();
    if (!pendingMailSource) throw new Error('Pending Mail source is unavailable');
    const retirementFailed = await resolveMailRetirementData({
      task_id: pendingMailSource.task_id,
      expected_revision: pendingMailSource.revision,
      idempotency_key: crypto.randomUUID(),
      result: 'failed',
      error_code: 'synthetic_test_failure',
    }, sourceAuth);
    expect(retirementFailed).toMatchObject({
      idempotency_outcome: 'applied',
      receipt: { outcome: 'accepted', transition: 'retirement_failed' },
    });

    const template = await new TaskTemplateService(sourceClient, source.id).capture({
      sourceType: 'todo',
      sourceId: primary.id,
      name: 'Preservation Template',
      anchorDate: '2026-07-20',
    });
    const recurrenceService = new TaskRecurrenceService(sourceClient, source.id);
    const recurrence = await recurrenceService.save({
      name: 'Preservation Recurrence',
      templateId: template.template.id,
      templateRevision: template.revision.revision,
      ruleMode: 'calendar',
      frequency: 'weekly',
      intervalCount: 1,
      startDate: '2026-07-20',
      planningTimeZone: 'America/Los_Angeles',
      missedPolicy: 'latest',
    });
    const recurrenceEvaluation = await recurrenceService.evaluate(
      recurrence.definition.id,
      '2026-07-20',
    );
    expect(recurrenceEvaluation.generated_count).toBe(1);
    const pausedRecurrence = await recurrenceService.setStatus(
      recurrenceEvaluation.definition,
      'paused',
    );
    expect(pausedRecurrence).toMatchObject({ outcome: 'accepted', definition: { status: 'paused' } });
    const resumedRecurrence = await recurrenceService.setStatus(
      pausedRecurrence.definition,
      'active',
    );
    expect(resumedRecurrence).toMatchObject({ outcome: 'accepted', definition: { status: 'active' } });

    const reminder = await new TaskReminderService(sourceClient).save({
      rootType: 'todo',
      rootId: primary.id,
      localDate: '2026-07-21',
      localTime: '09:00',
      timeZone: 'America/Los_Angeles',
    });
    expect(reminder.outcome).toBe('accepted');

    const taskExport = await createTaskExport(sourceClient);
    expect(taskExport.schema_version).toBe(10);
    for (const collection of taskExportV10Collections) {
      expect(taskExport.manifest.counts[collection], collection).toBeGreaterThan(0);
    }
    expect(taskExport.data.tasks_todos.find((task) => task.id === primary.id)).toMatchObject({
      title: 'Preserve This Task',
      disposition: 'present',
      revision: 5,
    });
    expect(taskExport.data.tasks_todos.find((task) => task.id === trashTask.id)).toMatchObject({
      disposition: 'deleted',
      deletion_root_id: trashTask.id,
    });

    const serialized = serializeTaskExport(taskExport);
    expect(serialized.endsWith('\n')).toBe(true);
    expect(parseTaskExport(JSON.parse(serialized))).toEqual(taskExport);
    expect(getTaskExportFilename(taskExport.created_at)).toMatch(/^bathos-tasks-\d{4}-\d{2}-\d{2}\.json$/);

    const tampered = structuredClone(taskExport);
    tampered.data.tasks_todos[0].title = 'Tampered Without New Checksum';
    await expect(previewTaskRestore(sourceClient, tampered))
      .rejects.toMatchObject({ message: expect.stringContaining('tasks_todos is invalid') });

    await activeDatabase.disconnectAndClear();
    await activeDatabase.close();
    activeDatabase = null;
    const { error: deleteSourceError } = await adminClient.auth.admin.deleteUser(source.id);
    expect(deleteSourceError).toBeNull();
    syntheticUserIds.delete(source.id);
    await expectOwnerCounts(adminClient, source.id, 0, 0);

    const preview = await previewTaskRestore(targetClient, taskExport);
    expect(preview).toMatchObject({ dry_run: true, schema_version: 10, applied: false });
    for (const collection of taskExportV10Collections) {
      expect(preview[collection]).toMatchObject({
        inserts: taskExport.manifest.counts[collection],
        matches: 0,
        conflicts: 0,
      });
    }
    await expectOwnerCounts(adminClient, target.id, 0, 0);

    const restored = await mergeTaskRestore(targetClient, taskExport);
    expect(restored).toMatchObject({ dry_run: false, schema_version: 10, applied: true });
    for (const collection of taskExportV10Collections) {
      expect(restored[collection]).toMatchObject({
        inserts: taskExport.manifest.counts[collection],
        matches: 0,
        conflicts: 0,
      });
    }
    await expectOwnerCounts(
      adminClient,
      target.id,
      taskExport.manifest.counts.tasks_todos,
      taskExport.manifest.counts.tasks_history_events,
    );
    const { data: restoredHistory, error: restoredHistoryError } = await targetClient
      .from('tasks_history_events')
      .select('*');
    expect(restoredHistoryError).toBeNull();
    const restoredHistoryById = new Map(
      restoredHistory?.map((event) => [event.id, event]) ?? [],
    );
    for (const exportedEvent of taskExport.data.tasks_history_events) {
      const restoredEvent = restoredHistoryById.get(exportedEvent.id);
      expect(restoredEvent, exportedEvent.id).toBeTruthy();
      if (!restoredEvent) throw new Error(`Restored history ${exportedEvent.id} is unavailable`);
      const { owner_id: _ownerId, ...withoutOwner } = restoredEvent;
      expect(withoutOwner, exportedEvent.id).toEqual(exportedEvent);
    }

    const replay = await mergeTaskRestore(targetClient, taskExport);
    expect(replay).toMatchObject({
      dry_run: false,
      schema_version: 10,
      applied: false,
      code: 'already_applied',
    });
    for (const collection of taskExportV10Collections) {
      expect(replay[collection], collection).toMatchObject({
        inserts: 0,
        matches: taskExport.manifest.counts[collection],
        conflicts: 0,
      });
    }

    const { data: restoredTrash, error: restoredTrashError } = await targetClient
      .from('tasks_todos')
      .select('*')
      .eq('id', trashTask.id)
      .single();
    expect(restoredTrashError).toBeNull();
    expect(restoredTrash).toMatchObject({
      owner_id: target.id,
      title: 'Restore Me From Backup Trash',
      disposition: 'deleted',
    });
    if (!restoredTrash) throw new Error('Restored Trash task is unavailable');
    const targetAuth = { userId: target.id, email: target.email, supabase: targetClient };
    const recoveredTrash = await transitionTaskData({
      task_id: restoredTrash.id,
      expected_revision: restoredTrash.revision,
      client_mutation_id: crypto.randomUUID(),
      transition: 'restore',
    }, targetAuth);
    expect(recoveredTrash).toMatchObject({
      mutation_outcome: 'applied',
      receipt: { transition: 'restore', outcome: 'accepted' },
      task: { disposition: 'present', deletion_root_id: null },
    });

    const recoveryExport = await createTaskExport(targetClient);
    expect(recoveryExport.data.tasks_todos.find((task) => task.id === trashTask.id))
      .toMatchObject({ disposition: 'present', deletion_root_id: null });
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

function createLocalServiceRoleKey(): string {
  const header = encodeJwtPart({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJwtPart({
    iss: 'supabase-demo',
    role: 'service_role',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac(
    'sha256',
    process.env.TASKS_TEST_SUPABASE_JWT_SECRET ?? fallbackLocalJwtSecret,
  ).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function encodeJwtPart(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function createSyntheticOwner(client: SupabaseClient<Database>, prefix: string) {
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `bathos-${prefix}-${unique}@example.test`;
  const { data, error } = await client.auth.signUp({
    email,
    password: `BathOS-${crypto.randomUUID()}-${prefix}`,
  });
  expect(error).toBeNull();
  expect(data.session).not.toBeNull();
  if (!data.user) throw new Error(`Synthetic ${prefix} owner creation failed`);
  return { id: data.user.id, email };
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

async function waitForLocalHistory(
  database: PowerSyncDatabase,
  ownerId: string,
  mutationId: string,
  timeoutMs = 30_000,
): Promise<TaskHistoryEvent> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = await database.getOptional<TaskHistoryEvent>(
      `SELECT * FROM tasks_history_events
       WHERE owner_id = ? AND client_mutation_id = ?`,
      [ownerId, mutationId],
    );
    if (event !== null) return event;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`History event ${mutationId} did not synchronize`);
}

async function waitForRemoteTask(
  client: SupabaseClient<Database>,
  taskId: string,
  expectedRevision: number,
  expectedTitle: string,
): Promise<TaskTodo> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('tasks_todos')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw error;
    if (data?.revision === expectedRevision && data.title === expectedTitle) {
      return data as TaskTodo;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Remote task ${taskId} did not reach the expected revision`);
}

async function waitForRemoteDisposition(
  client: SupabaseClient<Database>,
  taskId: string,
  disposition: 'present' | 'deleted',
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('tasks_todos')
      .select('disposition')
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw error;
    if (data?.disposition === disposition) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Remote task ${taskId} did not reach ${disposition}`);
}

async function expectOwnerCounts(
  client: SupabaseClient<Database>,
  ownerId: string,
  expectedTasks: number,
  expectedHistory: number,
): Promise<void> {
  const [tasks, history] = await Promise.all([
    client.from('tasks_todos').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    client.from('tasks_history_events').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
  ]);
  expect(tasks.error).toBeNull();
  expect(history.error).toBeNull();
  expect(tasks.count).toBe(expectedTasks);
  expect(history.count).toBe(expectedHistory);
}

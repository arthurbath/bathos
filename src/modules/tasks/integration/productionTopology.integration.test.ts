// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { PowerSyncDatabase } from '@powersync/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import { createTaskData } from '@/lib/mcp/tools/tasks-create';
import { createTaskProjectData } from '@/lib/mcp/tools/tasks-hierarchy-create';
import { scheduleTaskData, transitionTaskData, updateTaskData } from '@/lib/mcp/tools/tasks-mutate';
import { getTaskViewData, planningDateInTimeZone } from '@/lib/mcp/tools/tasks-read';
import { TaskPortabilityService } from '@/modules/tasks/data/taskPortability';
import { TaskRecurrenceService } from '@/modules/tasks/data/taskRecurrenceService';
import { TaskReminderService } from '@/modules/tasks/data/taskReminderService';
import { TaskRepository } from '@/modules/tasks/data/taskRepository';
import { TaskTemplateService } from '@/modules/tasks/data/taskTemplateService';
import { cleanupProductionTopology } from '@/modules/tasks/integration/productionTopologyCleanup';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';
import type { TaskProject, TaskReminder, TaskTodo } from '@/modules/tasks/types/tasks';

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

type ProjectedHistoryEvent = {
  id: string;
  client_mutation_id: string;
  base_revision: number;
  result_revision: number;
  transition: string;
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
  await cleanupProductionTopology({
    databases: openedDatabases,
    signedInClients,
    syntheticUserIds,
    admin,
    testDirectory,
    removeTestDirectory: (directory) => rm(directory, { recursive: true, force: true }),
  });
});

describe.skipIf(!integrationEnabled)('Tasks production topology integration', () => {
  it('proves synthetic cross-client convergence, owner isolation, restart, and cleanup', async () => {
    const environment = productionEnvironment();
    testDirectory ??= await mkdtemp(join(tmpdir(), 'bathos-tasks-production-topology-'));
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
      destination: 'anytime' as const,
      today_section: 'later' as const,
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
    await signOutSyntheticClient(ownerA.client);
    await signOutSyntheticClient(ownerB.client);
    await deleteSyntheticOwner(ownerA.id);
    await deleteSyntheticOwner(ownerB.id);
    const { count: residueCount, error: residueError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('id', taskId);
    expect(residueError).toBeNull();
    expect(residueCount).toBe(0);
  });

  it('proves future day-horizon activation through a fresh projection and cleanup', async () => {
    const environment = productionEnvironment();
    testDirectory ??= await mkdtemp(join(tmpdir(), 'bathos-tasks-production-topology-'));
    admin ??= createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const owner = await createSyntheticOwner('day-horizon', environment);
    const connector = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: owner.client,
    });
    const setupClient = await openClient(
      testDirectory,
      'day-horizon-setup.db',
      owner.id,
      connector,
    );
    await setupClient.repository.ensurePlanningSettings(owner.id, 'America/Los_Angeles');
    await waitForUploadQueue(setupClient.database, 0);

    const auth = { userId: owner.id, email: owner.email, supabase: owner.client };
    const horizons = ['inbox', 'now', 'next', 'later'] as const;
    const creations = [];
    for (const horizon of horizons) {
      creations.push(await createTaskData({
        idempotency_key: crypto.randomUUID(),
        title: `Synthetic Day Horizon ${horizon}`,
        notes: 'Disposable future day-horizon validation only',
        destination: 'anytime',
        today_section: horizon,
        start_date: '2099-12-31',
        entry_channel: 'mcp',
      }, auth));
    }

    await Promise.all(creations.map(({ task }) => waitForLocalTask(
      setupClient.database,
      task.id,
      (projected) => projected.revision === 1
        && projected.start_date === '2099-12-31'
        && projected.today_section === task.today_section,
    )));

    const planningDate = planningDateInTimeZone('America/Los_Angeles');
    for (const { task } of creations) {
      const scheduled = await scheduleTaskData({
        task_id: task.id,
        expected_revision: 1,
        client_mutation_id: crypto.randomUUID(),
        start_date: planningDate,
      }, auth);
      expect(scheduled.mutation_outcome).toBe('applied');
      expect(scheduled.task).toMatchObject({
        revision: 2,
        start_date: planningDate,
        today_section: task.today_section,
      });
    }

    const todayView = await getTaskViewData({
      view: 'today',
      planning_date: planningDate,
      limit: 50,
    }, auth);
    if (!('todos' in todayView)) throw new Error('Expected a Today planning result.');
    expect(Object.fromEntries(todayView.todos.map((task) => [task.id, task.derived_section])))
      .toEqual(Object.fromEntries(creations.map(({ task }) => [
        task.id,
        task.today_section,
      ])));

    await Promise.all(creations.map(({ task }) => waitForLocalTask(
      setupClient.database,
      task.id,
      (projected) => projected.revision === 2
        && projected.start_date === planningDate
        && projected.today_section === task.today_section,
    )));
    await disposeClient(setupClient);

    const freshClient = await openClient(
      testDirectory,
      'day-horizon-fresh.db',
      owner.id,
      connector,
    );
    await Promise.all(creations.map(({ task }) => waitForLocalTask(
      freshClient.database,
      task.id,
      (projected) => projected.revision === 2
        && projected.start_date === planningDate
        && projected.today_section === task.today_section,
    )));

    const { count: taskCount, error: taskCountError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id);
    expect(taskCountError).toBeNull();
    expect(taskCount).toBe(horizons.length);

    await disposeClient(freshClient);
    await signOutSyntheticClient(owner.client);
    await deleteSyntheticOwner(owner.id);
    const { count: residueCount, error: residueError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id);
    expect(residueError).toBeNull();
    expect(residueCount).toBe(0);
  });

  it('proves deep undo and redo through a fresh projection and cleanup', async () => {
    const environment = productionEnvironment();
    testDirectory ??= await mkdtemp(join(tmpdir(), 'bathos-tasks-production-topology-'));
    admin ??= createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const owner = await createSyntheticOwner('undo-redo', environment);
    const connector = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: owner.client,
    });
    const setupClient = await openClient(
      testDirectory,
      'undo-redo-setup.db',
      owner.id,
      connector,
    );
    await setupClient.repository.ensurePlanningSettings(owner.id, 'America/Los_Angeles');
    await waitForUploadQueue(setupClient.database, 0);

    const auth = { userId: owner.id, email: owner.email, supabase: owner.client };
    const creation = await createTaskData({
      idempotency_key: crypto.randomUUID(),
      title: 'Synthetic Undo Redo Before',
      notes: 'Disposable production undo and redo validation only',
      destination: 'anytime',
      today_section: 'next',
      entry_channel: 'mcp',
    }, auth);
    const taskId = creation.task.id;
    await waitForLocalTask(
      setupClient.database,
      taskId,
      (task) => task.revision === 1 && task.title === 'Synthetic Undo Redo Before',
    );

    const forward = await updateTaskData({
      task_id: taskId,
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
      title: 'Synthetic Undo Redo After',
    }, auth);
    expect(forward.mutation_outcome).toBe('applied');
    await waitForLocalTask(
      setupClient.database,
      taskId,
      (task) => task.revision === 2 && task.title === 'Synthetic Undo Redo After',
    );
    const sourceEvent = await waitForLocalHistoryTransition(
      setupClient.database,
      taskId,
      'update',
      2,
    );
    expect(sourceEvent.base_revision).toBe(1);

    const undone = await setupClient.repository.undoTask(owner.id, sourceEvent.id);
    expect(undone).toMatchObject({
      revision: 3,
      title: 'Synthetic Undo Redo Before',
      undo_source_event_id: sourceEvent.id,
    });
    await waitForUploadQueue(setupClient.database, 0, 60_000);
    await waitForLocalTask(
      setupClient.database,
      taskId,
      (task) => task.revision === 3 && task.title === 'Synthetic Undo Redo Before',
    );
    const undoEvent = await waitForLocalHistoryTransition(
      setupClient.database,
      taskId,
      'undo',
      3,
    );
    expect(undoEvent.client_mutation_id).toBe(undone.client_mutation_id);

    const redone = await setupClient.repository.redoTask(owner.id, sourceEvent.id);
    expect(redone).toMatchObject({
      revision: 4,
      title: 'Synthetic Undo Redo After',
      undo_source_event_id: sourceEvent.id,
    });
    await waitForUploadQueue(setupClient.database, 0, 60_000);
    await waitForLocalTask(
      setupClient.database,
      taskId,
      (task) => task.revision === 4 && task.title === 'Synthetic Undo Redo After',
    );
    const redoEvent = await waitForLocalHistoryTransition(
      setupClient.database,
      taskId,
      'redo',
      4,
    );
    expect(redoEvent.client_mutation_id).toBe(redone.client_mutation_id);
    await disposeClient(setupClient);

    const freshClient = await openClient(
      testDirectory,
      'undo-redo-fresh.db',
      owner.id,
      connector,
    );
    await waitForLocalTask(
      freshClient.database,
      taskId,
      (task) => task.revision === 4 && task.title === 'Synthetic Undo Redo After',
    );
    const freshHistory = await freshClient.database.getAll<ProjectedHistoryEvent>(
      `SELECT id, client_mutation_id, base_revision, result_revision, transition
       FROM tasks_history_events
       WHERE task_id = ?
       ORDER BY result_revision, id`,
      [taskId],
    );
    expect(freshHistory.map((event) => event.transition))
      .toEqual(['create', 'update', 'undo', 'redo']);
    expect(freshHistory.map((event) => event.result_revision)).toEqual([1, 2, 3, 4]);

    await disposeClient(freshClient);
    await signOutSyntheticClient(owner.client);
    await deleteSyntheticOwner(owner.id);
    const { count: residueCount, error: residueError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id);
    expect(residueError).toBeNull();
    expect(residueCount).toBe(0);
  });

  it('proves simplified scheduling through schema 12 and a fresh projection', async () => {
    const environment = productionEnvironment();
    testDirectory ??= await mkdtemp(join(tmpdir(), 'bathos-tasks-production-topology-'));
    admin ??= createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const owner = await createSyntheticOwner('structure-simplification', environment);
    const connector = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: owner.client,
    });
    const setupClient = await openClient(
      testDirectory,
      'structure-simplification-setup.db',
      owner.id,
      connector,
    );
    await setupClient.repository.ensurePlanningSettings(owner.id, 'America/Los_Angeles');
    await waitForUploadQueue(setupClient.database, 0);

    const auth = { userId: owner.id, email: owner.email, supabase: owner.client };
    const taskCreation = await createTaskData({
      idempotency_key: crypto.randomUUID(),
      title: 'Synthetic Simplified Scheduling Task',
      notes: 'Disposable structure and scheduling validation only',
      destination: 'anytime',
      actionability: 'rechecking',
      start_date: '2099-12-31',
      deadline: '2099-01-01',
      primary_link: 'https://example.test/synthetic-structure-simplification',
      entry_channel: 'mcp',
    }, auth);
    expect(taskCreation.task).toMatchObject({
      actionability: 'rechecking',
      start_date: '2099-12-31',
      deadline: '2099-01-01',
      today_section: 'next',
      primary_link: 'https://example.test/synthetic-structure-simplification',
    });
    const taskId = taskCreation.task.id;

    const projectCreation = await createTaskProjectData({
      idempotency_key: crypto.randomUUID(),
      title: 'Synthetic Simplified Scheduling Project',
      notes: 'Disposable structure and scheduling validation only',
      destination: 'anytime',
      start_date: '2099-12-31',
      deadline: '2099-01-01',
    }, auth);
    if (!('planning_order_key' in projectCreation.record)) {
      throw new Error('Expected a project creation result.');
    }
    const project = projectCreation.record as TaskProject;
    expect(project).toMatchObject({
      start_date: '2099-12-31',
      deadline: '2099-01-01',
      today_section: 'next',
    });

    await Promise.all([
      waitForLocalTask(
        setupClient.database,
        taskId,
        (task) => task.today_section === 'next' && task.actionability === 'rechecking',
      ),
      waitForLocalProject(
        setupClient.database,
        project.id,
        (projected) => projected.today_section === 'next',
      ),
    ]);

    const reminderService = new TaskReminderService(owner.client);
    const savedReminder = await reminderService.save({
      rootType: 'todo',
      rootId: taskId,
      localTime: '09:00',
      timeZone: 'America/Los_Angeles',
      mutationChannel: 'mcp',
      actorType: 'automation',
    });
    expect(savedReminder.outcome).toBe('accepted');
    expect(savedReminder.reminder).toMatchObject({
      local_time: '09:00:00',
      status: 'active',
    });
    const firstResolvedAt = savedReminder.reminder.resolved_at;

    const rescheduled = await scheduleTaskData({
      task_id: taskId,
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
      start_date: '2099-12-30',
    }, auth);
    expect(rescheduled.mutation_outcome).toBe('applied');
    const reboundReminder = await waitForLocalReminder(
      setupClient.database,
      savedReminder.reminder.id,
      (reminder) => reminder.status === 'active' && reminder.resolved_at !== firstResolvedAt,
    );
    expect(reboundReminder.local_time).toMatch(/^09:00:00(?:\.0+)?$/);

    const cleared = await scheduleTaskData({
      task_id: taskId,
      expected_revision: 2,
      client_mutation_id: crypto.randomUUID(),
      start_date: null,
    }, auth);
    expect(cleared.mutation_outcome).toBe('applied');
    expect(cleared.task).toMatchObject({ start_date: null, today_section: 'next' });
    await Promise.all([
      waitForLocalTask(
        setupClient.database,
        taskId,
        (task) => task.revision === 3 && task.start_date === null && task.today_section === 'next',
      ),
      waitForLocalReminder(
        setupClient.database,
        savedReminder.reminder.id,
        (reminder) => reminder.status === 'canceled',
      ),
    ]);

    const taskExport = await new TaskPortabilityService(owner.client).createExport();
    expect(taskExport.schema_version).toBe(12);
    expect(taskExport.manifest.collections).not.toContain('tasks_headings');
    expect(taskExport.data.tasks_todos.find((task) => task.id === taskId)).toMatchObject({
      actionability: 'rechecking',
      start_date: null,
      today_section: 'next',
      primary_link: 'https://example.test/synthetic-structure-simplification',
    });

    const activationCreation = await createTaskData({
      idempotency_key: crypto.randomUUID(),
      title: 'Synthetic Due Activation Task',
      notes: 'Disposable owner-scoped activation validation only',
      destination: 'anytime',
      today_section: 'later',
      start_date: '2099-12-29',
      entry_channel: 'mcp',
    }, auth);
    const activationTaskId = activationCreation.task.id;
    const activationReminder = await reminderService.save({
      rootType: 'todo',
      rootId: activationTaskId,
      localTime: '09:00',
      timeZone: 'America/Los_Angeles',
      mutationChannel: 'mcp',
      actorType: 'automation',
    });
    expect(activationReminder.outcome).toBe('accepted');
    runScopedDueActivation(owner.id, '2099-12-29T08:01:00.000Z');
    await Promise.all([
      waitForLocalTask(
        setupClient.database,
        activationTaskId,
        (task) => task.start_date === null && task.today_section === 'later',
      ),
      waitForLocalReminder(
        setupClient.database,
        activationReminder.reminder.id,
        (reminder) => reminder.status === 'active',
      ),
    ]);

    await disposeClient(setupClient);
    const freshClient = await openClient(
      testDirectory,
      'structure-simplification-fresh.db',
      owner.id,
      connector,
    );
    await Promise.all([
      waitForLocalTask(
        freshClient.database,
        taskId,
        (task) => task.revision === 3 && task.actionability === 'rechecking',
      ),
      waitForLocalProject(
        freshClient.database,
        project.id,
        (projected) => projected.today_section === 'next',
      ),
      waitForLocalTask(
        freshClient.database,
        activationTaskId,
        (task) => task.start_date === null && task.today_section === 'later',
      ),
      waitForLocalReminder(
        freshClient.database,
        savedReminder.reminder.id,
        (reminder) => reminder.status === 'canceled',
      ),
    ]);
    expect(await freshClient.database.getOptional(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'tasks_headings'",
    )).toBeNull();

    await disposeClient(freshClient);
    await signOutSyntheticClient(owner.client);
    await deleteSyntheticOwner(owner.id);
    const { count: residueCount, error: residueError } = await admin
      .from('tasks_todos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id);
    expect(residueError).toBeNull();
    expect(residueCount).toBe(0);
  });

  it('proves the owner-local day-31 Done purge boundary and fresh projection removal', async () => {
    const environment = productionEnvironment();
    testDirectory ??= await mkdtemp(join(tmpdir(), 'bathos-tasks-production-topology-'));
    admin ??= createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const owner = await createSyntheticOwner('done-retention', environment);
    const connector = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: owner.client,
    });
    const setupClient = await openClient(
      testDirectory,
      'done-retention-setup.db',
      owner.id,
      connector,
    );
    await setupClient.repository.ensurePlanningSettings(owner.id, 'America/Los_Angeles');
    await waitForUploadQueue(setupClient.database, 0);

    const auth = { userId: owner.id, email: owner.email, supabase: owner.client };
    const captureInput = {
      idempotency_key: crypto.randomUUID(),
      title: 'Synthetic Done Retention Boundary Task',
      notes: 'Disposable production retention validation only',
      destination: 'anytime' as const,
      today_section: 'later' as const,
      entry_channel: 'mcp' as const,
      source: {
        kind: 'other' as const,
        external_id: `production-done-retention:${crypto.randomUUID()}`,
      },
    };
    const creation = await createTaskData(captureInput, auth);
    const taskId = creation.task.id;
    const completion = await transitionTaskData({
      task_id: taskId,
      expected_revision: 1,
      client_mutation_id: crypto.randomUUID(),
      transition: 'complete',
    }, auth);
    expect(completion.mutation_outcome).toBe('applied');

    await waitForLocalTask(
      setupClient.database,
      taskId,
      (task) => task.lifecycle === 'completed' && task.completed_at !== null,
    );
    await disposeClient(setupClient);

    const beforeBoundary = await openClient(
      testDirectory,
      'done-retention-before.db',
      owner.id,
      connector,
    );
    await waitForLocalTask(
      beforeBoundary.database,
      taskId,
      (task) => task.lifecycle === 'completed' && task.completed_at !== null,
    );
    await disposeClient(beforeBoundary);

    const boundaryResult = runGuardedBoundaryPurge(owner.id, taskId);
    expect(boundaryResult).toEqual({ receipt_count: 1 });

    const afterBoundary = await openClient(
      testDirectory,
      'done-retention-after.db',
      owner.id,
      connector,
    );
    expect(await afterBoundary.database.getOptional(
      'SELECT id FROM tasks_todos WHERE id = ?',
      [taskId],
    )).toBeNull();
    expect(await afterBoundary.database.getOptional(
      'SELECT id FROM tasks_history_events WHERE task_id = ?',
      [taskId],
    )).toBeNull();
    await disposeClient(afterBoundary);

    const receipt = runLinkedSql(`
      SELECT count(*)::integer AS count
      FROM tasks_private.purged_creation_receipts
      WHERE owner_id = '${sqlUuid(owner.id)}'::uuid
        AND entity_type = 'todo'
        AND entity_id = '${sqlUuid(taskId)}'::uuid;
    `).rows?.[0] as { count?: number } | undefined;
    expect(receipt?.count).toBe(1);
    await expect(createTaskData(captureInput, auth)).rejects.toThrow(
      'The idempotency key is unavailable',
    );

    await signOutSyntheticClient(owner.client);
    await deleteSyntheticOwner(owner.id);
    const cleanup = runLinkedSql(`
      SELECT count(*)::integer AS count
      FROM tasks_private.purged_creation_receipts
      WHERE owner_id = '${sqlUuid(owner.id)}'::uuid;
    `).rows?.[0] as { count?: number } | undefined;
    expect(cleanup?.count).toBe(0);
  });
});

type LinkedQueryResult = {
  rows?: Array<Record<string, unknown>>;
};

function runLinkedSql(sql: string): LinkedQueryResult {
  const result = spawnSync(
    'supabase',
    ['db', 'query', '--linked', '--output-format', 'json', sql],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `Supabase query failed with exit code ${result.status}`,
    );
  }
  return JSON.parse(result.stdout) as LinkedQueryResult;
}

function runScopedDueActivation(ownerId: string, evaluatedAt: string): void {
  const owner = sqlUuid(ownerId);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(evaluatedAt)) {
    throw new Error('A canonical synthetic activation instant is required.');
  }
  runLinkedSql(`
    SELECT tasks_private.activate_due_roots(
      '${evaluatedAt}'::timestamptz,
      '${owner}'::uuid
    );
  `);
}

function runGuardedBoundaryPurge(
  ownerId: string,
  taskId: string,
): { receipt_count: number } {
  const owner = sqlUuid(ownerId);
  const task = sqlUuid(taskId);
  const response = runLinkedSql(`
    DO $tasks_done_boundary$
    DECLARE
      _before timestamptz := '2026-02-01T07:59:59.999999Z'::timestamptz;
      _boundary timestamptz := '2026-02-01T08:00:00.000000Z'::timestamptz;
      _before_candidates integer;
      _boundary_candidates integer;
      _before_result jsonb;
      _boundary_result jsonb;
    BEGIN
      UPDATE public.tasks_todos
      SET completed_at = '2026-01-01T20:00:00.000Z'::timestamptz,
          revision = revision + 1,
          client_mutation_id = gen_random_uuid(),
          last_mutation_channel = 'import',
          last_actor_type = 'system',
          updated_at = clock_timestamp()
      WHERE owner_id = '${owner}'::uuid
        AND id = '${task}'::uuid;

      WITH owner_zones AS (
        SELECT users.id AS owner_id,
          COALESCE(settings.planning_timezone, 'UTC') AS planning_timezone
        FROM auth.users AS users
        LEFT JOIN public.tasks_user_settings AS settings
          ON settings.owner_id = users.id
      ), candidates AS (
        SELECT area.owner_id, 'area'::text AS root_type, area.id AS root_id,
          area.deleted_at AS terminal_at
        FROM public.tasks_areas AS area
        WHERE area.disposition = 'deleted' AND area.deletion_root_id = area.id
        UNION ALL
        SELECT project.owner_id, 'project', project.id,
          COALESCE(project.deleted_at, project.completed_at, project.canceled_at)
        FROM public.tasks_projects AS project
        WHERE (project.disposition = 'deleted' AND project.deletion_root_id = project.id)
          OR (project.disposition = 'present' AND project.lifecycle IN ('completed', 'canceled'))
        UNION ALL
        SELECT todo.owner_id, 'todo', todo.id,
          COALESCE(todo.deleted_at, todo.completed_at, todo.canceled_at)
        FROM public.tasks_todos AS todo
        WHERE (todo.disposition = 'deleted' AND todo.deletion_root_id = todo.id)
          OR (todo.disposition = 'present' AND todo.lifecycle IN ('completed', 'canceled'))
        UNION ALL
        SELECT item.owner_id, 'checklist_item', item.id, item.deleted_at
        FROM public.tasks_checklist_items AS item
        WHERE item.disposition = 'deleted' AND item.deletion_root_id = item.id
      )
      SELECT
        count(*) FILTER (
          WHERE (candidate.terminal_at AT TIME ZONE zone.planning_timezone)::date + 31
            <= (_before AT TIME ZONE zone.planning_timezone)::date
        ),
        count(*) FILTER (
          WHERE (candidate.terminal_at AT TIME ZONE zone.planning_timezone)::date + 31
            <= (_boundary AT TIME ZONE zone.planning_timezone)::date
        )
      INTO _before_candidates, _boundary_candidates
      FROM candidates AS candidate
      JOIN owner_zones AS zone ON zone.owner_id = candidate.owner_id
      WHERE candidate.terminal_at IS NOT NULL;

      IF _before_candidates <> 0 OR _boundary_candidates <> 1 THEN
        RAISE EXCEPTION 'Synthetic Done boundary candidate guard failed';
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM public.tasks_todos
        WHERE owner_id = '${owner}'::uuid
          AND id = '${task}'::uuid
          AND lifecycle = 'completed'
          AND (completed_at AT TIME ZONE 'America/Los_Angeles')::date + 31
            = (_boundary AT TIME ZONE 'America/Los_Angeles')::date
      ) THEN
        RAISE EXCEPTION 'Synthetic Done boundary owner guard failed';
      END IF;

      _before_result := tasks_private.purge_expired_done(_before, 500);
      IF (_before_result ->> 'purged_roots')::integer <> 0
        OR NOT EXISTS (
          SELECT 1 FROM public.tasks_todos
          WHERE owner_id = '${owner}'::uuid AND id = '${task}'::uuid
        ) THEN
        RAISE EXCEPTION 'Done content did not survive immediately before its boundary';
      END IF;

      _boundary_result := tasks_private.purge_expired_done(_boundary, 500);
      IF (_boundary_result ->> 'purged_roots')::integer <> 1
        OR (_boundary_result ->> 'purged_records')::integer <> 1
        OR EXISTS (
          SELECT 1 FROM public.tasks_todos
          WHERE owner_id = '${owner}'::uuid AND id = '${task}'::uuid
        ) THEN
        RAISE EXCEPTION 'Done content was not purged exactly at its boundary';
      END IF;
    END;
    $tasks_done_boundary$;

    SELECT count(*)::integer AS receipt_count
    FROM tasks_private.purged_creation_receipts
    WHERE owner_id = '${owner}'::uuid
      AND entity_type = 'todo'
      AND entity_id = '${task}'::uuid;
  `);
  const row = response.rows?.[0] as { receipt_count?: number } | undefined;
  if (row?.receipt_count !== 1) {
    throw new Error('The guarded production Done boundary returned no private receipt');
  }
  return { receipt_count: row.receipt_count };
}

function sqlUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Expected a UUID for the synthetic production fixture');
  }
  return value;
}

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

async function signOutSyntheticClient(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
  signedInClients.delete(client);
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

async function waitForLocalProject(
  database: PowerSyncDatabase,
  projectId: string,
  predicate: (project: TaskProject) => boolean,
): Promise<TaskProject> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const project = await database.getOptional<TaskProject>(
      'SELECT * FROM tasks_projects WHERE id = ?',
      [projectId],
    );
    if (project !== null && predicate(project)) return project;
    await delay(100);
  }
  throw new Error(`Local project ${projectId} did not reach the expected state`);
}

async function waitForLocalReminder(
  database: PowerSyncDatabase,
  reminderId: string,
  predicate: (reminder: TaskReminder) => boolean,
): Promise<TaskReminder> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const reminder = await database.getOptional<TaskReminder>(
      'SELECT * FROM tasks_reminders WHERE id = ?',
      [reminderId],
    );
    if (reminder !== null && predicate(reminder)) return reminder;
    await delay(100);
  }
  throw new Error(`Local reminder ${reminderId} did not reach the expected state`);
}

async function waitForLocalHistoryTransition(
  database: PowerSyncDatabase,
  taskId: string,
  transition: string,
  resultRevision: number,
): Promise<ProjectedHistoryEvent> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const event = await database.getOptional<ProjectedHistoryEvent>(
      `SELECT id, client_mutation_id, base_revision, result_revision, transition
       FROM tasks_history_events
       WHERE task_id = ? AND transition = ? AND result_revision = ?
       ORDER BY occurred_at DESC, id DESC
       LIMIT 1`,
      [taskId, transition, resultRevision],
    );
    if (event !== null) return event;
    await delay(100);
  }
  throw new Error(
    `Local task ${taskId} did not receive ${transition} history revision ${resultRevision}`,
  );
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

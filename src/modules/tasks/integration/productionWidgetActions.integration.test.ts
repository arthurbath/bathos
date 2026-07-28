// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PowerSyncDatabase } from '@powersync/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import { createTaskData } from '@/lib/mcp/tools/tasks-create';
import { cleanupProductionTopology } from '@/modules/tasks/integration/productionTopologyCleanup';
import { bindTasksDatabaseOwner } from '@/modules/tasks/sync/database';
import { createTasksSupabaseConnector } from '@/modules/tasks/sync/connector';
import { tasksPowerSyncSchema } from '@/modules/tasks/sync/schema';

const integrationEnabled = process.env.RUN_TASKS_PRODUCTION_WIDGET_ACTIONS === '1';
const fixedIdentifiers = {
  installation: '76000000-0000-4000-8000-000000000001',
  create: '76000000-0000-4000-8000-000000000002',
  completeMutation: '76000000-0000-4000-8000-000000000003',
  completeOperation: '76000000-0000-4000-8000-000000000004',
  noopMutation: '76000000-0000-4000-8000-000000000005',
  noopOperation: '76000000-0000-4000-8000-000000000006',
  revokedMutation: '76000000-0000-4000-8000-000000000007',
  revokedOperation: '76000000-0000-4000-8000-000000000008',
};

let testDirectory: string | null = null;
let admin: SupabaseClient<Database> | null = null;
const databases = new Set<PowerSyncDatabase>();
const signedInClients = new Set<SupabaseClient<Database>>();
const syntheticUserIds = new Set<string>();

afterAll(async () => {
  await cleanupProductionTopology({
    databases,
    signedInClients,
    syntheticUserIds,
    admin,
    testDirectory,
    removeTestDirectory: (directory) => rm(directory, { recursive: true, force: true }),
  });
});

describe.skipIf(!integrationEnabled)('Tasks production widget actions', () => {
  it('proves owner-scoped completion, retry, revocation, projection, and cleanup', async () => {
    const environment = productionEnvironment();
    testDirectory = await mkdtemp(join(tmpdir(), 'bathos-tasks-widget-actions-'));
    admin = createClient<Database>(environment.supabaseUrl, environment.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const owner = await createSyntheticOwner(environment);
    const session = await owner.client.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) throw new Error('Synthetic widget owner has no access token');

    const task = await createTaskData({
      idempotency_key: fixedIdentifiers.create,
      title: 'Synthetic Widget Completion Acceptance',
      notes: 'Disposable production acceptance fixture',
      destination: 'anytime',
      today_section: 'inbox',
      actionability: 'actionable',
      entry_channel: 'native',
      primary_link: 'https://example.test/tasks-widget-acceptance',
    }, {
      userId: owner.id,
      email: owner.email,
      supabase: owner.client,
    });

    const connector = createTasksSupabaseConnector({
      endpoint: environment.powerSyncUrl,
      supabase: owner.client,
    });
    const database = new PowerSyncDatabase({
      schema: tasksPowerSyncSchema,
      database: {
        dbFilename: 'widget-actions.db',
        dbLocation: testDirectory,
        implementation: { type: 'better-sqlite3' },
      },
    });
    databases.add(database);
    await withPhase('prepare local PowerSync database', () => database.waitForReady());
    await withPhase('bind synthetic PowerSync owner', () => (
      bindTasksDatabaseOwner(database, owner.id)
    ));
    await withPhase('connect synthetic PowerSync client', () => database.connect(connector));
    await withPhase('complete initial PowerSync projection', () => (
      database.waitForFirstSync(AbortSignal.timeout(45_000))
    ));
    await withPhase('project the open task and Primary Link', () => (
      waitForLocalTask(database, task.task.id, (row) => (
        row.lifecycle === 'open'
        && row.primary_link === 'https://example.test/tasks-widget-acceptance'
      ))
    ));

    const issueResponse = await fetch(`${environment.supabaseUrl}/functions/v1/tasks-widget-actions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'issue',
        installationId: fixedIdentifiers.installation,
      }),
    });
    expect(issueResponse.status).toBe(200);
    const issued = await issueResponse.json() as {
      outcome?: string;
      credential?: string;
      ownerId?: string;
      installationId?: string;
    };
    expect(issued).toMatchObject({
      outcome: 'issued',
      ownerId: owner.id,
      installationId: fixedIdentifiers.installation,
    });
    expect(issued.credential).toMatch(/^twc_[A-Za-z0-9_-]{43}$/);
    const credential = issued.credential;
    if (!credential) throw new Error('Widget credential was not issued');

    const accepted = await completeTask(environment.supabaseUrl, credential, task.task.id, {
      mutation: fixedIdentifiers.completeMutation,
      operation: fixedIdentifiers.completeOperation,
    });
    expect(accepted).toMatchObject({ status: 200, outcome: 'accepted' });

    const replay = await completeTask(environment.supabaseUrl, credential, task.task.id, {
      mutation: fixedIdentifiers.completeMutation,
      operation: fixedIdentifiers.completeOperation,
    });
    expect(replay).toMatchObject({ status: 200, outcome: 'already_applied' });

    const noop = await completeTask(environment.supabaseUrl, credential, task.task.id, {
      mutation: fixedIdentifiers.noopMutation,
      operation: fixedIdentifiers.noopOperation,
    });
    expect(noop).toMatchObject({ status: 200, outcome: 'noop' });

    await withPhase('project the widget completion', () => (
      waitForLocalTask(database, task.task.id, (row) => row.lifecycle === 'completed')
    ));
    const localHistory = await database.getAll<{
      mutation_channel: string;
      transition: string;
    }>(
      `SELECT mutation_channel, transition
       FROM tasks_history_events
       WHERE task_id = ? AND transition = 'complete'`,
      [task.task.id],
    );
    expect(localHistory).toEqual([{ mutation_channel: 'widget', transition: 'complete' }]);

    const { count: completionCount, error: completionCountError } = await admin
      .from('tasks_history_events')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id)
      .eq('task_id', task.task.id)
      .eq('transition', 'complete');
    if (completionCountError) throw completionCountError;
    expect(completionCount).toBe(1);

    const { count: recurrenceCount, error: recurrenceCountError } = await admin
      .from('tasks_recurrence_occurrences')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id);
    if (recurrenceCountError) throw recurrenceCountError;
    expect(recurrenceCount).toBe(0);

    const revokeResponse = await fetch(
      `${environment.supabaseUrl}/functions/v1/tasks-widget-actions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Widget ${credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'revoke' }),
      },
    );
    expect(revokeResponse.status).toBe(200);
    expect(await revokeResponse.json()).toMatchObject({ outcome: 'revoked' });

    const rejected = await completeTask(environment.supabaseUrl, credential, task.task.id, {
      mutation: fixedIdentifiers.revokedMutation,
      operation: fixedIdentifiers.revokedOperation,
    });
    expect(rejected).toMatchObject({ status: 401, error: 'Task could not be completed' });

    await database.disconnectAndClear();
    await database.close();
    databases.delete(database);
    const { error: signOutError } = await owner.client.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    signedInClients.delete(owner.client);
    const { error: deleteError } = await admin.auth.admin.deleteUser(owner.id);
    if (deleteError) throw deleteError;
    syntheticUserIds.delete(owner.id);
    await rm(testDirectory, { recursive: true, force: true });
    testDirectory = null;

    const cleanupChecks = await Promise.all([
      admin.from('tasks_todos').select('id', { count: 'exact', head: true }).eq('owner_id', owner.id),
      admin.from('tasks_history_events').select('id', { count: 'exact', head: true }).eq('owner_id', owner.id),
    ]);
    for (const check of cleanupChecks) {
      if (check.error) throw check.error;
      expect(check.count).toBe(0);
    }
  });
});

async function createSyntheticOwner(environment: ReturnType<typeof productionEnvironment>) {
  if (!admin) throw new Error('Synthetic widget administrator is unavailable');
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `bathos-production-widget-${unique}@example.test`;
  const password = `BathOS-${crypto.randomUUID()}-widget`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_purpose: 'tasks-widget-actions-acceptance' },
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

async function completeTask(
  supabaseUrl: string,
  credential: string,
  taskId: string,
  identifiers: { mutation: string; operation: string },
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/tasks-widget-actions`, {
    method: 'POST',
    headers: {
      Authorization: `Widget ${credential}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'complete',
      taskId,
      clientMutationId: identifiers.mutation,
      operationId: identifiers.operation,
    }),
  });
  const body = await response.json() as { outcome?: string; error?: string };
  return { status: response.status, ...body };
}

async function waitForLocalTask(
  database: PowerSyncDatabase,
  taskId: string,
  predicate: (row: { lifecycle: string; primary_link: string | null }) => boolean,
) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const row = await database.getOptional<{ lifecycle: string; primary_link: string | null }>(
      'SELECT lifecycle, primary_link FROM tasks_todos WHERE id = ?',
      [taskId],
    );
    if (row && predicate(row)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the widget fixture in PowerSync');
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

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function withPhase<T>(label: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const detail = error instanceof Error
      ? error.message || error.name
      : JSON.stringify(error);
    throw new Error(`${label} failed: ${detail || 'unknown error'}`);
  }
}

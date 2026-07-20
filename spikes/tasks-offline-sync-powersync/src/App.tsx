import { useQuery, useStatus } from '@powersync/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { connector } from './connector';
import { powerSync } from './database';
import { CONFLICTS_TABLE, TASKS_TABLE, type ConflictRecord, type TaskRecord } from './schema';
import {
  clearConflicts,
  completeTask,
  createTask,
  deleteTask,
  moveBefore,
  reopenTask,
  restoreTask,
  updateTitle,
  type TaskDestination
} from './tasks';
import { useSystem } from './system-context';

declare global {
  interface Window {
    tasksSpike: {
      clearConflicts: typeof clearConflicts;
      completeTask: typeof completeTask;
      connect: () => Promise<void>;
      createTask: typeof createTask;
      deleteTask: typeof deleteTask;
      disconnect: () => Promise<void>;
      getSnapshot: () => Promise<unknown>;
      moveBefore: typeof moveBefore;
      reopenTask: typeof reopenTask;
      restoreTask: typeof restoreTask;
      updateTitle: typeof updateTitle;
    };
  }
}

export default function App() {
  const system = useSystem();
  const syncStatus = useStatus();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('spike-a@bathos.local');
  const [password, setPassword] = useState('bathos-spike-password');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState<TaskDestination>('today');

  const { data: tasks = [] } = useQuery<TaskRecord>(
    `SELECT * FROM ${TASKS_TABLE} ORDER BY destination, order_key, id`
  );
  const { data: conflicts = [] } = useQuery<ConflictRecord>(
    `SELECT * FROM ${CONFLICTS_TABLE} ORDER BY detected_at DESC`
  );
  const { data: queueRows = [] } = useQuery<{ pending: number }>(
    'SELECT COUNT(*) AS pending FROM ps_crud'
  );

  const active = useMemo(
    () => tasks.filter((task) => !task.deleted_at && !task.completed_at),
    [tasks]
  );
  const completed = useMemo(
    () => tasks.filter((task) => !task.deleted_at && task.completed_at),
    [tasks]
  );
  const deleted = useMemo(() => tasks.filter((task) => task.deleted_at), [tasks]);

  useEffect(() => {
    window.tasksSpike = {
      clearConflicts,
      completeTask,
      connect: () => powerSync.connect(connector, { crudUploadThrottleMs: 100 }),
      createTask,
      deleteTask,
      disconnect: () => powerSync.disconnect(),
      getSnapshot: async () => ({
        tasks: await powerSync.getAll(`SELECT * FROM ${TASKS_TABLE} ORDER BY order_key, id`),
        conflicts: await powerSync.getAll(`SELECT * FROM ${CONFLICTS_TABLE} ORDER BY detected_at`),
        pending: await powerSync.getAll('SELECT COUNT(*) AS count FROM ps_crud'),
        status: powerSync.currentStatus
      }),
      moveBefore,
      reopenTask,
      restoreTask,
      updateTitle
    };
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function submitTask(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await createTask(title, destination);
      setTitle('');
    });
  }

  if (!system.ready) {
    return <main className="shell">Opening Local Database</main>;
  }

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Disposable Architecture Spike</p>
        <h1>Capture and Run Today</h1>
        <p className="lede">Synthetic data only. This surface tests persistence, synchronization, conflicts, and ordering.</p>
      </header>

      <section className="status-grid" aria-label="Spike Status">
        <Status label="Authentication" value={system.session ? 'Signed In' : 'Signed Out'} />
        <Status label="PowerSync" value={syncStatus.connected ? 'Connected' : syncStatus.connecting ? 'Connecting' : 'Offline'} />
        <Status label="Initial Sync" value={syncStatus.hasSynced ? 'Complete' : 'Pending'} />
        <Status label="Queued Mutations" value={String(queueRows[0]?.pending ?? 0)} />
      </section>

      {(error ||
        system.error ||
        syncStatus.dataFlowStatus.uploadError ||
        syncStatus.dataFlowStatus.downloadError) && (
        <p className="error" role="alert">
          {error ??
            system.error ??
            syncStatus.dataFlowStatus.uploadError?.message ??
            syncStatus.dataFlowStatus.downloadError?.message}
        </p>
      )}

      {!system.session ? (
        <section className="panel auth-panel">
          <h2>Local Synthetic Account</h2>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="actions">
            <button onClick={() => run(() => connector.login(email, password))}>Sign In</button>
            <button className="secondary" onClick={() => run(() => connector.register(email, password))}>Register</button>
          </div>
        </section>
      ) : (
        <>
          <section className="toolbar" aria-label="Connection Controls">
            <button className="secondary" onClick={() => run(() => powerSync.disconnect())}>Disconnect Sync</button>
            <button className="secondary" onClick={() => run(() => powerSync.connect(connector, { crudUploadThrottleMs: 100 }))}>Connect Sync</button>
            <button className="secondary" onClick={() => run(() => connector.logout())}>Sign Out</button>
          </section>

          <section className="panel">
            <h2>Capture</h2>
            <form className="capture" onSubmit={submitTask}>
              <label>
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label>
                Destination
                <select value={destination} onChange={(event) => setDestination(event.target.value as TaskDestination)}>
                  <option value="today">Today</option>
                  <option value="inbox">Inbox</option>
                </select>
              </label>
              <button type="submit">Create Locally</button>
              <button type="button" className="secondary" onClick={() => run(() => createTask(title || 'Server-originated synthetic task', destination, 'server'))}>
                Create on Server
              </button>
            </form>
          </section>

          <TaskSection title="Active" tasks={active} run={run} />
          <TaskSection title="Logbook" tasks={completed} run={run} />
          <TaskSection title="Recoverable Delete" tasks={deleted} run={run} />

          <section className="panel">
            <div className="section-heading">
              <h2>Conflicts and Upload Failures</h2>
              <button className="secondary" onClick={() => run(clearConflicts)}>Clear</button>
            </div>
            {conflicts.length === 0 ? (
              <p className="empty">No recorded conflicts.</p>
            ) : (
              <ul className="conflicts">
                {conflicts.map((conflict) => (
                  <li key={conflict.id}>
                    <strong>{conflict.kind}</strong>
                    <span>Task {conflict.task_id}</span>
                    <span>Local revision {conflict.local_revision}, remote revision {conflict.remote_revision ?? 'missing'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="status">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  run
}: {
  title: string;
  tasks: TaskRecord[];
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {tasks.length === 0 ? (
        <p className="empty">No tasks in this state.</p>
      ) : (
        <ol className="tasks">
          {tasks.map((task, index) => {
            const next = tasks[index + 1] ?? null;
            const afterNext = tasks[index + 2] ?? null;
            return (
              <li key={task.id} data-task-id={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.destination} · {task.origin} · revision {task.revision}</span>
                  <code>{task.order_key}</code>
                </div>
                <div className="task-actions">
                  {!task.completed_at && !task.deleted_at && (
                    <button onClick={() => run(() => completeTask(task.id))}>Complete</button>
                  )}
                  {task.completed_at && !task.deleted_at && (
                    <button onClick={() => run(() => reopenTask(task.id))}>Reopen</button>
                  )}
                  {task.deleted_at ? (
                    <button onClick={() => run(() => restoreTask(task.id))}>Restore</button>
                  ) : (
                    <button className="secondary" onClick={() => run(() => deleteTask(task.id))}>Delete</button>
                  )}
                  {!task.completed_at && !task.deleted_at && task.destination === 'today' && index > 0 && (
                    <button className="secondary" onClick={() => run(() => moveBefore(task.id, tasks[index - 1].id))}>Move Up</button>
                  )}
                  {!task.completed_at && !task.deleted_at && task.destination === 'today' && next && (
                    <button className="secondary" onClick={() => run(() => moveBefore(task.id, afterNext?.id ?? null))}>Move Down</button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

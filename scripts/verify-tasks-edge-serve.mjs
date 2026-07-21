import { pathToFileURL } from 'node:url';
import {
  cleanupLocalFunctionsTempDirectory,
  spawnLocalFunctionsServe,
} from './supabase-functions-local.mjs';

const REMINDER_URL = 'http://127.0.0.1:54321/functions/v1/dispatch-task-reminders';
const START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5_000;
const MAX_DIAGNOSTIC_CHARACTERS = 12_000;

function appendDiagnostic(current, chunk) {
  const combined = current + chunk.toString();
  return combined.slice(-MAX_DIAGNOSTIC_CHARACTERS);
}

function timeout(milliseconds, value) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(value), milliseconds);
    timer.unref?.();
  });
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGINT');
  const stopped = await Promise.race([
    waitForExit(child).then(() => true),
    timeout(STOP_TIMEOUT_MS, false),
  ]);
  if (stopped) return;

  child.kill('SIGTERM');
  const terminated = await Promise.race([
    waitForExit(child).then(() => true),
    timeout(STOP_TIMEOUT_MS, false),
  ]);
  if (terminated) return;

  child.kill('SIGKILL');
  await waitForExit(child);
}

export async function verifyTasksEdgeServe({
  environment = process.env,
  repositoryRoot = process.cwd(),
} = {}) {
  const child = spawnLocalFunctionsServe({
    environment,
    repositoryRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let diagnostic = '';
  let spawnError = null;
  let ready = false;
  let resolveReady;
  let resolveSpawnError;
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const spawnErrorPromise = new Promise((resolve) => {
    resolveSpawnError = resolve;
  });
  child.once('error', (error) => {
    spawnError = error;
    resolveSpawnError(error);
  });
  const capture = (chunk) => {
    diagnostic = appendDiagnostic(diagnostic, chunk);
    if (!ready && diagnostic.includes('Serving functions on ')) {
      ready = true;
      resolveReady();
    }
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  try {
    const startup = await Promise.race([
      readyPromise.then(() => ({ type: 'ready' })),
      spawnErrorPromise.then((error) => ({ type: 'error', error })),
      waitForExit(child).then(({ code, signal }) => ({ type: 'exit', code, signal })),
      timeout(START_TIMEOUT_MS, { type: 'timeout' }),
    ]);

    if (startup.type === 'exit') {
      throw new Error(
        `Supabase Functions exited before becoming ready (${startup.code ?? startup.signal ?? 'unknown'}).`,
      );
    }
    if (startup.type === 'error') throw startup.error;
    if (startup.type === 'timeout') {
      throw new Error(`Supabase Functions did not become ready within ${START_TIMEOUT_MS}ms.`);
    }

    const response = await fetch(REMINDER_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.json().catch(() => null);
    if (
      response.status !== 405
      || response.headers.get('allow') !== 'POST'
      || body?.error !== 'Method not allowed'
    ) {
      throw new Error(
        `Reminder HTTP boundary returned ${response.status} instead of the expected 405 response.`,
      );
    }

    return { status: response.status, allow: response.headers.get('allow') };
  } catch (error) {
    if (diagnostic.trim()) {
      console.error('Supabase Functions diagnostic output:');
      console.error(diagnostic.trim());
    }
    throw error;
  } finally {
    if (spawnError === null) await stopChild(child);
    child.stdout.destroy();
    child.stderr.destroy();
    cleanupLocalFunctionsTempDirectory(repositoryRoot);
  }
}

async function run() {
  const result = await verifyTasksEdgeServe();
  console.log('Task reminder HTTP runtime booted successfully.');
  console.log(`GET boundary: ${result.status} Method Not Allowed`);
  console.log(`Allowed method: ${result.allow}`);
  console.log('Local Edge Runtime stopped cleanly.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Task reminder HTTP verification failed');
    process.exitCode = 1;
  });
}

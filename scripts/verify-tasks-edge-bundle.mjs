import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE_RUNTIME_REPOSITORY = 'public.ecr.aws/supabase/edge-runtime';

export function selectEdgeRuntimeImage(imageList, override) {
  const requested = override?.trim();
  if (requested) {
    if (!requested.startsWith(`${EDGE_RUNTIME_REPOSITORY}:`)) {
      throw new Error(
        `TASKS_EDGE_RUNTIME_IMAGE must use ${EDGE_RUNTIME_REPOSITORY}`,
      );
    }
    return requested;
  }

  const candidates = [...new Set(imageList
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${EDGE_RUNTIME_REPOSITORY}:`))
    .filter((value) => !value.endsWith(':<none>')))]
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  if (candidates.length === 0) {
    throw new Error(
      `No cached ${EDGE_RUNTIME_REPOSITORY} image was found. Start the local Supabase stack first.`,
    );
  }
  return candidates[0];
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(detail || `${command} exited with status ${result.status}`);
  }
  return result.stdout;
}

export function verifyTaskReminderEdgeBundle({
  environment = process.env,
  repositoryRoot = process.cwd(),
} = {}) {
  const functionDirectory = join(
    repositoryRoot,
    'supabase/functions/dispatch-task-reminders',
  );
  const entrypoint = join(functionDirectory, 'index.ts');
  if (!existsSync(entrypoint)) {
    throw new Error(`Task reminder Edge Function entrypoint not found: ${entrypoint}`);
  }

  const image = selectEdgeRuntimeImage(
    commandOutput('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}']),
    environment.TASKS_EDGE_RUNTIME_IMAGE,
  );
  const artifact = join(
    repositoryRoot,
    `.tasks-edge-bundle-${process.pid}-${Date.now()}.eszip.local`,
  );

  try {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--volume',
        `${functionDirectory}:/work:ro`,
        '--volume',
        `${repositoryRoot}:/output`,
        image,
        'bundle',
        '--entrypoint',
        '/work/index.ts',
        '--output',
        `/output/${basename(artifact)}`,
        '--timeout',
        '120',
      ],
      { stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Supabase Edge Runtime bundle exited with status ${result.status}`);
    }
    if (!existsSync(artifact) || statSync(artifact).size === 0) {
      throw new Error('Supabase Edge Runtime did not produce a non-empty bundle');
    }

    const bytes = readFileSync(artifact);
    return {
      image,
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  } finally {
    rmSync(artifact, { force: true });
  }
}

function run() {
  const result = verifyTaskReminderEdgeBundle();
  console.log('Task reminder dispatcher bundled successfully.');
  console.log(`Edge Runtime image: ${result.image}`);
  console.log(`Bundle size: ${result.bytes} bytes`);
  console.log(`Bundle SHA-256: ${result.sha256}`);
  console.log('Temporary bundle removed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Task reminder bundle verification failed');
    process.exitCode = 1;
  }
}

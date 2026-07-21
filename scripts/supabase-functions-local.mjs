import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveLocalFunctionsTempDirectory(repositoryRoot = process.cwd()) {
  return resolve(repositoryRoot, 'supabase', '.temp', 'functions-serve');
}

export function buildLocalFunctionsEnvironment({
  environment = process.env,
  repositoryRoot = process.cwd(),
} = {}) {
  const tempDirectory = resolveLocalFunctionsTempDirectory(repositoryRoot);
  return {
    ...environment,
    TMPDIR: tempDirectory,
    TMP: tempDirectory,
    TEMP: tempDirectory,
  };
}

export function cleanupLocalFunctionsTempDirectory(repositoryRoot = process.cwd()) {
  rmSync(resolveLocalFunctionsTempDirectory(repositoryRoot), {
    recursive: true,
    force: true,
  });
}

export function spawnLocalFunctionsServe({
  args = [],
  environment = process.env,
  repositoryRoot = process.cwd(),
  stdio = 'inherit',
} = {}) {
  const tempDirectory = resolveLocalFunctionsTempDirectory(repositoryRoot);
  cleanupLocalFunctionsTempDirectory(repositoryRoot);
  mkdirSync(tempDirectory, { recursive: true });

  return spawn('supabase', ['functions', 'serve', ...args], {
    cwd: repositoryRoot,
    env: buildLocalFunctionsEnvironment({ environment, repositoryRoot }),
    stdio,
  });
}

function run() {
  const repositoryRoot = process.cwd();
  const child = spawnLocalFunctionsServe({
    args: process.argv.slice(2),
    repositoryRoot,
  });
  const signals = ['SIGINT', 'SIGTERM'];
  let finished = false;

  const removeSignalHandlers = () => {
    for (const signal of signals) process.removeListener(signal, signalHandlers[signal]);
  };
  const finish = ({ code = null, signal = null, error = null } = {}) => {
    if (finished) return;
    finished = true;
    cleanupLocalFunctionsTempDirectory(repositoryRoot);
    removeSignalHandlers();

    if (error !== null) {
      console.error(error instanceof Error ? error.message : 'Failed to start Supabase Functions');
      process.exitCode = 1;
      return;
    }
    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  };
  const signalHandlers = Object.fromEntries(signals.map((signal) => [
    signal,
    () => {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    },
  ]));
  for (const signal of signals) process.once(signal, signalHandlers[signal]);

  child.once('error', (error) => {
    finish({ error });
  });
  child.once('exit', (code, signal) => {
    finish({ code, signal });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}

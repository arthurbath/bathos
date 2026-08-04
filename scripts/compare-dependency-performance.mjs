import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import {
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';

const [baselineArgument, finalArgument, outputArgument, runArgument = '10'] = process.argv.slice(2);
if (!baselineArgument || !finalArgument || !outputArgument) {
  throw new Error(
    'Usage: node scripts/compare-dependency-performance.mjs <baseline> <final> <output> [runs]',
  );
}

const revisions = {
  baseline: resolve(baselineArgument),
  final: resolve(finalArgument),
};
const outputPath = resolve(outputArgument);
const performanceRunCount = Number.parseInt(runArgument, 10);
if (!Number.isInteger(performanceRunCount) || performanceRunCount < 10) {
  throw new Error('Performance comparison requires at least ten runs per revision.');
}

const result = {
  generatedAt: new Date().toISOString(),
  host: {
    platform: process.platform,
    architecture: process.arch,
    release: os.release(),
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    node: process.version,
  },
  revisions,
  performanceRuns: [],
  buildRuns: [],
};

for (let cycle = 0; cycle < performanceRunCount; cycle += 1) {
  const order = cycle % 2 === 0 ? ['baseline', 'final'] : ['final', 'baseline'];
  for (const revision of order) {
    const sample = runPerformance(revision, revisions[revision], cycle + 1);
    result.performanceRuns.push(sample);
    persistResult();
    console.log(
      `performance ${cycle + 1}/${performanceRunCount} ${revision}: `
      + `${sample.elapsedMs.toFixed(0)}ms, exit ${sample.exitStatus}`,
    );
  }
}

for (let cycle = 0; cycle < 3; cycle += 1) {
  const order = cycle % 2 === 0 ? ['baseline', 'final'] : ['final', 'baseline'];
  for (const revision of order) {
    const sample = runBuild(revision, revisions[revision], cycle + 1);
    result.buildRuns.push(sample);
    persistResult();
    console.log(
      `build ${cycle + 1}/3 ${revision}: ${sample.elapsedMs.toFixed(0)}ms, `
      + `${sample.javascriptBytes} JavaScript bytes`,
    );
  }
}

persistResult();
console.log(`Wrote ${outputPath}`);

function persistResult() {
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}

function runPerformance(revision, repositoryRoot, cycle) {
  const startedAt = performance.now();
  const command = spawnSync('npm', ['run', 'test:tasks:performance'], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      CI: '1',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (command.error) throw command.error;
  const output = `${command.stdout}\n${command.stderr}`;
  const metrics = parsePerformanceMetrics(output);
  const expectedMetrics = [
    'today view p95',
    'upcoming view p95',
    'anytime view p95',
    'someday view p95',
    'done view p95',
    'search index p95',
    'text query p95',
    'rendered view',
    'search dialog',
    'practical rendered view',
  ];
  const missingMetrics = expectedMetrics.filter((metric) => metrics[metric] === undefined);
  if (missingMetrics.length > 0) {
    throw new Error(
      `${revision} cycle ${cycle} did not report: ${missingMetrics.join(', ')}\n${output}`,
    );
  }
  return {
    revision,
    cycle,
    elapsedMs: performance.now() - startedAt,
    exitStatus: command.status,
    metrics,
    host: sampleHost(),
  };
}

function parsePerformanceMetrics(output) {
  const metrics = {};
  for (const match of output.matchAll(
    /\[tasks-performance\] ([^:\n]+): median=([0-9.]+)ms p95=([0-9.]+)ms/g,
  )) {
    metrics[`${match[1]} median`] = Number(match[2]);
    metrics[`${match[1]} p95`] = Number(match[3]);
  }
  for (const match of output.matchAll(
    /\[tasks-performance\] (rendered view|search dialog|practical rendered view): [^\n]*duration=([0-9.]+)ms/g,
  )) {
    metrics[match[1]] = Number(match[2]);
  }
  return metrics;
}

function runBuild(revision, repositoryRoot, cycle) {
  rmSync(join(repositoryRoot, 'dist'), { recursive: true, force: true });
  const startedAt = performance.now();
  const command = spawnSync('npm', ['run', 'build'], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      CI: '1',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const elapsedMs = performance.now() - startedAt;
  if (command.error) throw command.error;
  if (command.status !== 0) {
    throw new Error(`${revision} build ${cycle} failed:\n${command.stdout}\n${command.stderr}`);
  }
  const chunks = collectJavaScript(join(repositoryRoot, 'dist'));
  return {
    revision,
    cycle,
    elapsedMs,
    javascriptBytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
    javascriptGzipBytes: chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
    chunks,
    host: sampleHost(),
  };
}

function collectJavaScript(directory, root = directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      entries.push(...collectJavaScript(path, root));
    } else if (name.endsWith('.js')) {
      const bytes = readFileSync(path);
      entries.push({
        path: path.slice(root.length + 1),
        bytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes).byteLength,
      });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function sampleHost() {
  return {
    timestamp: new Date().toISOString(),
    loadAverage: os.loadavg(),
    freeMemoryBytes: os.freemem(),
  };
}

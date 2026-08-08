#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TASKS_APP_BUNDLE_ID = 'garden.bath.tasks';
export const TASKS_MAC_WIDGET_BUNDLE_ID = 'garden.bath.tasks.widgets';
export const TASKS_APP_GROUP_ID = 'group.garden.bath.tasks';
export const TASKS_APPLE_TEAM_ID = 'SPJYXE7ZA3';

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? `: ${(result.stderr || result.stdout).trim()}` : '';
    fail(`${command} ${args.join(' ')} failed${detail}`);
  }
  return result.stdout ?? '';
}

function readBundleIdentifier(infoPlist) {
  return run('/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', infoPlist], {
    capture: true,
  }).trim();
}

function assertBundleIdentifier(infoPlist, expected) {
  const actual = readBundleIdentifier(infoPlist);
  if (actual !== expected) {
    fail(`Expected bundle identifier ${expected}, found ${actual || 'none'}`);
  }
}

export function assertAppleSigningContract(output, label) {
  if (!output.includes(`TeamIdentifier=${TASKS_APPLE_TEAM_ID}`)) {
    fail(`${label} is not signed by the expected Apple development team`);
  }
  if (!output.includes(TASKS_APP_GROUP_ID)) {
    fail(`${label} does not contain the expected Tasks App Group entitlement`);
  }
}

function verifyAppleSigningContract(bundlePath, label) {
  const result = spawnSync('/usr/bin/codesign', [
    '-d',
    '--entitlements',
    '-',
    '--verbose=2',
    bundlePath,
  ], { encoding: 'utf8', stdio: 'pipe' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`Unable to inspect ${label} signing metadata`);
  }
  assertAppleSigningContract(`${result.stdout}\n${result.stderr}`, label);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walkFiles(root, entries = []) {
  if (!existsSync(root)) return entries;
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, item.name);
    if (item.isDirectory()) {
      walkFiles(path, entries);
    } else if (item.isFile()) {
      entries.push(path);
    }
  }
  return entries;
}

export function createTasksMacCacheManifest(containerRoot) {
  const normalizedRoot = resolve(containerRoot);
  const fileSystemSegment = `${sep}FileSystem${sep}`;
  return walkFiles(normalizedRoot)
    .filter((file) => file.includes(fileSystemSegment))
    .filter((file) => /^bathos-tasks-v\d+\.db$/.test(basename(file)))
    .sort()
    .map((file) => ({
      path: relative(normalizedRoot, file),
      bytes: statSync(file).size,
      sha256: sha256(file),
    }));
}

export function assertTasksMacCacheContinuity(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    fail('The Tasks PowerSync cache changed during application installation');
  }
}

function assertMacAppNotRunning() {
  const result = spawnSync('/usr/bin/pgrep', [
    '-f',
    '/Tasks\\.app/Contents/MacOS/Tasks',
  ], { encoding: 'utf8', stdio: 'pipe' });
  if (result.error) throw result.error;
  if (result.status === 0) {
    fail('Quit Tasks before installing so its PowerSync cache can be verified');
  }
  if (result.status !== 1) {
    fail('Unable to confirm that Tasks is stopped');
  }
}

function verifyMacApp(appPath) {
  const widget = join(appPath, 'Contents', 'PlugIns', 'TasksMacWidgets.appex');
  if (!existsSync(join(appPath, 'Contents', 'Info.plist')) || !existsSync(widget)) {
    fail('The staged macOS Tasks app or embedded widget is incomplete');
  }
  assertBundleIdentifier(join(appPath, 'Contents', 'Info.plist'), TASKS_APP_BUNDLE_ID);
  assertBundleIdentifier(join(widget, 'Contents', 'Info.plist'), TASKS_MAC_WIDGET_BUNDLE_ID);
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', widget]);
  verifyAppleSigningContract(appPath, 'macOS Tasks app');
  verifyAppleSigningContract(widget, 'macOS Tasks widget');
}

function uniqueTrashPath(name) {
  const trash = join(homedir(), '.Trash');
  mkdirSync(trash, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  return join(trash, `${name}.previous-${stamp}.app`);
}

export function installTasksMac({
  appPath,
  installedApp = '/Applications/Tasks.app',
  containerRoot = join(
    homedir(),
    'Library',
    'Containers',
    TASKS_APP_BUNDLE_ID,
    'Data',
    'Library',
    'WebKit',
    'WebsiteData',
  ),
  launch = true,
}) {
  const source = resolve(appPath);
  const destination = resolve(installedApp);
  if (!existsSync(source)) fail(`Staged app does not exist: ${source}`);
  verifyMacApp(source);
  assertMacAppNotRunning();

  const cacheBefore = createTasksMacCacheManifest(containerRoot);
  const parent = dirname(destination);
  mkdirSync(parent, { recursive: true });
  const staging = join(parent, `.Tasks.installing-${process.pid}.app`);
  const previous = join(parent, `.Tasks.previous-${process.pid}.app`);
  if (existsSync(staging) || existsSync(previous)) {
    fail('A prior guarded Tasks installation artifact still exists');
  }

  run('/usr/bin/ditto', [source, staging]);
  verifyMacApp(staging);
  let movedPrevious = false;
  let replacementInstalled = false;
  try {
    if (existsSync(destination)) {
      renameSync(destination, previous);
      movedPrevious = true;
    }
    renameSync(staging, destination);
    replacementInstalled = true;
    verifyMacApp(destination);
    const cacheAfter = createTasksMacCacheManifest(containerRoot);
    assertTasksMacCacheContinuity(cacheBefore, cacheAfter);
  } catch (error) {
    if (replacementInstalled && existsSync(destination)) {
      rmSync(destination, { recursive: true, force: true });
    }
    if (movedPrevious && existsSync(previous)) {
      renameSync(previous, destination);
    }
    if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
    throw error;
  }

  if (movedPrevious && existsSync(previous)) {
    renameSync(previous, uniqueTrashPath('Tasks'));
  }
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
  if (launch) run('/usr/bin/open', [destination]);
  return { cacheState: cacheBefore.length === 0 ? 'cacheless' : 'preserved', cacheBefore };
}

function findObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) findObjects(item, output);
    return output;
  }
  if (value && typeof value === 'object') {
    output.push(value);
    for (const item of Object.values(value)) findObjects(item, output);
  }
  return output;
}

function firstString(object, paths) {
  for (const path of paths) {
    let value = object;
    for (const key of path) {
      value = value && typeof value === 'object' ? value[key] : undefined;
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function parseTasksIOSInstallation(json) {
  const objects = findObjects(json);
  const app = objects.find((candidate) => candidate.bundleIdentifier === TASKS_APP_BUNDLE_ID)
    ?? objects.find((candidate) => candidate.bundleID === TASKS_APP_BUNDLE_ID)
    ?? objects.find((candidate) => candidate.identifier === TASKS_APP_BUNDLE_ID);
  if (!app) return null;
  const dataContainerIdentity = firstString(app, [
    ['dataContainer', 'identifier'],
    ['dataContainerIdentifier'],
    ['dataContainer', 'url'],
    ['dataContainer', 'path'],
    ['dataContainer'],
    ['dataContainerURL'],
    ['dataContainerPath'],
  ]);
  return {
    bundleIdentifier: TASKS_APP_BUNDLE_ID,
    dataContainerIdentity,
  };
}

export function assertTasksIOSContainerContinuity(before, after) {
  if (!before) return;
  if (!before.dataContainerIdentity) {
    fail('The existing iOS Tasks data-container identity is unavailable');
  }
  if (!after || after.dataContainerIdentity !== before.dataContainerIdentity) {
    fail('The iOS Tasks data-container identity changed during installation');
  }
}

export function buildTasksIOSInstallArguments(device, appPath) {
  return ['devicectl', 'device', 'install', 'app', '--device', device, resolve(appPath)];
}

function queryTasksIOSInstallation(device, developerDir) {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'bathos-tasks-device-info-'));
  const output = join(outputDirectory, 'apps.json');
  try {
    run('/usr/bin/xcrun', [
      'devicectl',
      'device',
      'info',
      'apps',
      '--device',
      device,
      '--bundle-id',
      TASKS_APP_BUNDLE_ID,
      '--include-container-paths',
      '--json-output',
      output,
    ], { env: { ...process.env, DEVELOPER_DIR: developerDir } });
    return parseTasksIOSInstallation(JSON.parse(readFileSync(output, 'utf8')));
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
}

function verifyIOSApp(appPath) {
  const infoPlist = join(appPath, 'Info.plist');
  if (!existsSync(infoPlist)) fail('The staged iOS Tasks app is incomplete');
  assertBundleIdentifier(infoPlist, TASKS_APP_BUNDLE_ID);
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
  verifyAppleSigningContract(appPath, 'iOS Tasks app');
}

export function installTasksIOS({
  appPath,
  device,
  developerDir = '/Applications/Xcode-beta.app/Contents/Developer',
}) {
  const source = resolve(appPath);
  if (!existsSync(source)) fail(`Staged app does not exist: ${source}`);
  if (!device?.trim()) fail('An iOS device identifier is required');
  verifyIOSApp(source);
  const before = queryTasksIOSInstallation(device, developerDir);
  if (before && !before.dataContainerIdentity) {
    fail('The existing iOS Tasks data-container identity is unavailable');
  }
  run('/usr/bin/xcrun', buildTasksIOSInstallArguments(device, source), {
    env: { ...process.env, DEVELOPER_DIR: developerDir },
  });
  const after = queryTasksIOSInstallation(device, developerDir);
  if (!after) fail('Tasks was not present after iOS installation');
  assertTasksIOSContainerContinuity(before, after);
  return { cacheState: before ? 'preserved' : 'new-install', dataContainer: after };
}

function parseArguments(arguments_) {
  const [platform, ...rest] = arguments_;
  const options = { platform };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (key === '--no-launch') {
      options.launch = false;
      continue;
    }
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      fail(`Invalid argument: ${key ?? ''}`);
    }
    options[key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.app) {
    fail('Usage: install-tasks-native.mjs <macos|ios> --app <Tasks.app> [options]');
  }
  const result = options.platform === 'macos'
    ? installTasksMac({
        appPath: options.app,
        installedApp: options.installedApp,
        containerRoot: options.containerRoot,
        launch: options.launch !== false,
      })
    : options.platform === 'ios'
      ? installTasksIOS({
          appPath: options.app,
          device: options.device,
          developerDir: options.developerDir,
        })
      : fail('Platform must be macos or ios');
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

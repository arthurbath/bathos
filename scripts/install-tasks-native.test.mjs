import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertAppleSigningContract,
  assertTasksIOSContainerContinuity,
  assertTasksMacCacheContinuity,
  buildTasksIOSInstallArguments,
  createTasksMacCacheManifest,
  parseTasksIOSInstallation,
} from './install-tasks-native.mjs';

test('native signing contract requires the expected team and App Group', () => {
  const valid = [
    'TeamIdentifier=SPJYXE7ZA3',
    '<string>group.garden.bath.tasks</string>',
  ].join('\n');
  assert.doesNotThrow(() => assertAppleSigningContract(valid, 'Tasks app'));
  assert.throws(
    () => assertAppleSigningContract(valid.replace('SPJYXE7ZA3', 'OTHERTEAM'), 'Tasks app'),
    /expected Apple development team/,
  );
  assert.throws(
    () => assertAppleSigningContract(valid.replace('group.garden.bath.tasks', 'group.other'), 'Tasks app'),
    /expected Tasks App Group entitlement/,
  );
});

test('macOS cache manifest fingerprints only active PowerSync namespaces', () => {
  const root = mkdtempSync(join(tmpdir(), 'tasks-cache-manifest-'));
  const active = join(root, 'Default', 'origin', 'origin', 'FileSystem');
  const retired = join(root, 'Default', 'origin', 'origin', 'FileSystem.corrupt-previous');
  mkdirSync(active, { recursive: true });
  mkdirSync(retired, { recursive: true });
  writeFileSync(join(active, 'bathos-tasks-v2.db'), 'active-cache');
  writeFileSync(join(active, 'bathos-tasks-v2.db-wal'), 'changing-wal');
  writeFileSync(join(retired, 'bathos-tasks-v1.db'), 'retired-cache');

  const manifest = createTasksMacCacheManifest(root);
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].path.endsWith('FileSystem/bathos-tasks-v2.db'), true);
  assert.equal(manifest[0].bytes, 12);
  assert.equal(manifest[0].sha256.length, 64);
});

test('macOS continuity rejects an altered or replaced cache', () => {
  const before = [{ path: 'FileSystem/bathos-tasks-v1.db', bytes: 4, sha256: 'a' }];
  assert.doesNotThrow(() => assertTasksMacCacheContinuity(before, structuredClone(before)));
  assert.throws(
    () => assertTasksMacCacheContinuity(before, [{ ...before[0], sha256: 'b' }]),
    /PowerSync cache changed/,
  );
});

test('iOS installation parser extracts the stable data-container identity', () => {
  const installation = parseTasksIOSInstallation({
    result: {
      apps: [{
        bundleIdentifier: 'garden.bath.tasks',
        dataContainer: {
          identifier: '2A65F7DD-6BC5-45A8-8853-224850BDEA12',
          path: '/private/var/mobile/Containers/Data/Application/2A65F7DD',
        },
      }],
    },
  });
  assert.deepEqual(installation, {
    bundleIdentifier: 'garden.bath.tasks',
    dataContainerIdentity: '2A65F7DD-6BC5-45A8-8853-224850BDEA12',
  });
});

test('iOS installation parser accepts alternate CoreDevice field names', () => {
  const installation = parseTasksIOSInstallation({
    result: [{
      bundleID: 'garden.bath.tasks',
      dataContainer: '/private/var/mobile/Containers/Data/Application/CONTAINER-A',
    }],
  });
  assert.deepEqual(installation, {
    bundleIdentifier: 'garden.bath.tasks',
    dataContainerIdentity: '/private/var/mobile/Containers/Data/Application/CONTAINER-A',
  });
});

test('iOS continuity fails closed when an existing container is missing or changes', () => {
  const before = {
    bundleIdentifier: 'garden.bath.tasks',
    dataContainerIdentity: 'container-a',
  };
  assert.throws(
    () => assertTasksIOSContainerContinuity({
      bundleIdentifier: 'garden.bath.tasks',
      dataContainerIdentity: null,
    }, before),
    /identity is unavailable/,
  );
  assert.throws(
    () => assertTasksIOSContainerContinuity(before, null),
    /data-container identity changed/,
  );
  assert.throws(
    () => assertTasksIOSContainerContinuity(before, {
      bundleIdentifier: 'garden.bath.tasks',
      dataContainerIdentity: 'container-b',
    }),
    /data-container identity changed/,
  );
  assert.doesNotThrow(() => assertTasksIOSContainerContinuity(null, before));
});

test('iOS installer command is in-place and never contains uninstall', () => {
  const arguments_ = buildTasksIOSInstallArguments('Art iPhone', '/tmp/Tasks.app');
  assert.deepEqual(arguments_.slice(0, 4), ['devicectl', 'device', 'install', 'app']);
  assert.equal(arguments_.includes('uninstall'), false);
  assert.deepEqual(arguments_.slice(4, 6), ['--device', 'Art iPhone']);
});

#!/usr/bin/env node

import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '..');
const projectRef = 'rsqfokyqntmtdejfwmjs';
const keychainAccount = 'tasks-production';
const keychainServices = {
  powersyncPassword: 'garden.bath.bathos.tasks.powersync.database',
  reminderDispatch: 'garden.bath.bathos.tasks.reminders.dispatch',
  vapidPublic: 'garden.bath.bathos.tasks.reminders.vapid.public',
  vapidPrivate: 'garden.bath.bathos.tasks.reminders.vapid.private',
};

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    fail(`${command} failed with exit code ${result.status ?? 'unknown'}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

function readKeychain(service) {
  const result = spawnSync('security', [
    'find-generic-password',
    '-a', keychainAccount,
    '-s', service,
    '-w',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return result.status === 0 ? result.stdout.trim() : null;
}

function writeKeychain(service, value) {
  const result = spawnSync('security', [
    'add-generic-password',
    '-U',
    '-a', keychainAccount,
    '-s', service,
    '-w', value,
  ], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.status !== 0) fail(`Could not store ${service} in macOS Keychain`);
}

function getOrCreateSecret(service, create) {
  const existing = readKeychain(service);
  if (existing) return existing;
  const created = create();
  writeKeychain(service, created);
  return created;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function withoutPsqlMetaCommands(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('\\'))
    .join('\n');
}

function writePrivate(path, contents) {
  writeFileSync(path, contents, { encoding: 'utf8', mode: 0o600 });
  chmodSync(path, 0o600);
}

function generateVapidKeys() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  if (!jwk.x || !jwk.y || !jwk.d) fail('Could not export the generated VAPID key pair');
  const publicBytes = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from(jwk.y, 'base64url'),
  ]);
  return { publicKey: publicBytes.toString('base64url'), privateKey: jwk.d };
}

function provisionSyncDatabase(tempDirectory) {
  const password = getOrCreateSecret(
    keychainServices.powersyncPassword,
    () => randomBytes(48).toString('base64url'),
  );
  const roleTemplate = readFileSync(
    join(repositoryRoot, 'deploy/tasks-powersync/database-role.sql'),
    'utf8',
  );
  const normalizationMarker = '-- TASKS_POWERSYNC_ROLE_NORMALIZATION';
  const normalizationStart = roleTemplate.indexOf(normalizationMarker);
  if (normalizationStart < 0) fail('The PowerSync role normalization contract could not be found');
  const roleSql = `DO $tasks_powersync_role$\nBEGIN\n  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasks_powersync_role') THEN\n    EXECUTE format('ALTER ROLE tasks_powersync_role WITH LOGIN REPLICATION BYPASSRLS PASSWORD %L', ${sqlLiteral(password)});\n  ELSE\n    EXECUTE format('CREATE ROLE tasks_powersync_role WITH LOGIN REPLICATION BYPASSRLS PASSWORD %L', ${sqlLiteral(password)});\n  END IF;\nEND\n$tasks_powersync_role$;\n\n${roleTemplate.slice(normalizationStart)}`;
  const rolePath = join(tempDirectory, 'tasks-powersync-role.sql');
  const publicationPath = join(tempDirectory, 'tasks-powersync-publication.sql');
  const verifyPath = join(tempDirectory, 'tasks-powersync-verify.sql');
  const publicationStatus = JSON.parse(run('supabase', [
    'db', 'query', '--linked', '--output-format', 'json',
    "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'powersync') AS publication_exists",
  ], { capture: true }));
  const publicationExists = publicationStatus?.rows?.[0]?.publication_exists;
  if (typeof publicationExists !== 'boolean') {
    fail('Supabase returned an unexpected PowerSync publication status');
  }
  const publicationSource = publicationExists
    ? 'publication-update.sql'
    : 'publication-create.sql';
  writePrivate(rolePath, roleSql);
  writePrivate(
    publicationPath,
    withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-powersync', publicationSource)),
  );
  writePrivate(
    verifyPath,
    withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-powersync/verify.sql')),
  );

  run('supabase', ['db', 'query', '--linked', '--file', rolePath]);
  run('supabase', ['db', 'query', '--linked', '--file', publicationPath]);
  run('supabase', ['db', 'query', '--linked', '--file', verifyPath]);
  process.stdout.write('PowerSync database boundary is ready; password is stored in macOS Keychain.\n');
}

function provisionReminders(tempDirectory) {
  let publicKey = readKeychain(keychainServices.vapidPublic);
  let privateKey = readKeychain(keychainServices.vapidPrivate);
  if (!publicKey || !privateKey) {
    const generated = generateVapidKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    writeKeychain(keychainServices.vapidPublic, publicKey);
    writeKeychain(keychainServices.vapidPrivate, privateKey);
  }
  const dispatchSecret = getOrCreateSecret(
    keychainServices.reminderDispatch,
    () => randomBytes(48).toString('base64url'),
  );
  const subject = 'https://os.bath.garden';
  const secretsPath = join(tempDirectory, 'tasks-reminder-secrets.env');
  const vaultPath = join(tempDirectory, 'tasks-reminder-vault.sql');
  const extensionsPath = join(tempDirectory, 'tasks-reminder-extensions.sql');
  const cronPath = join(tempDirectory, 'tasks-reminder-cron.sql');
  const verifyPath = join(tempDirectory, 'tasks-reminder-verify.sql');
  writePrivate(secretsPath, [
    `TASKS_REMINDER_DISPATCH_SECRET=${dispatchSecret}`,
    `TASKS_WEB_PUSH_VAPID_PUBLIC_KEY=${publicKey}`,
    `TASKS_WEB_PUSH_VAPID_PRIVATE_KEY=${privateKey}`,
    `TASKS_WEB_PUSH_SUBJECT=${subject}`,
    '',
  ].join('\n'));
  writePrivate(vaultPath, `DO $tasks_reminder_vault$\nBEGIN\n  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'tasks_reminder_dispatch_secret') THEN\n    RAISE EXCEPTION 'tasks_reminder_dispatch_secret already exists; rotate it deliberately instead of duplicating it';\n  END IF;\n  PERFORM vault.create_secret(\n    ${sqlLiteral(dispatchSecret)},\n    'tasks_reminder_dispatch_secret',\n    'BathOS Tasks reminder dispatcher authentication'\n  );\nEND\n$tasks_reminder_vault$;\n`);
  writePrivate(
    extensionsPath,
    withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-reminders/extensions-enable.sql')),
  );
  writePrivate(
    cronPath,
    withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-reminders/cron-create.sql')),
  );
  writePrivate(
    verifyPath,
    withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-reminders/verify.sql')),
  );

  run('node', [join(repositoryRoot, 'scripts/verify-tasks-web-push-config.mjs')], {
    env: {
      ...process.env,
      TASKS_REMINDER_DISPATCH_SECRET: dispatchSecret,
      TASKS_WEB_PUSH_VAPID_PUBLIC_KEY: publicKey,
      TASKS_WEB_PUSH_VAPID_PRIVATE_KEY: privateKey,
      TASKS_WEB_PUSH_SUBJECT: subject,
      VITE_TASKS_WEB_PUSH_PUBLIC_KEY: publicKey,
    },
  });
  run('supabase', ['secrets', 'set', '--project-ref', projectRef, '--env-file', secretsPath]);
  run('supabase', [
    'functions', 'deploy', 'dispatch-task-reminders',
    '--project-ref', projectRef,
    '--no-verify-jwt',
    '--use-api',
  ]);
  run('supabase', ['db', 'query', '--linked', '--file', extensionsPath]);
  run('supabase', ['db', 'query', '--linked', '--file', vaultPath]);
  run('supabase', ['db', 'query', '--linked', '--file', cronPath]);
  run('supabase', ['db', 'query', '--linked', '--file', verifyPath]);
  process.stdout.write(`TASKS_PUBLIC_VAPID_KEY=${publicKey}\n`);
  process.stdout.write('Reminder dispatcher, Vault boundary, and Cron job are ready.\n');
}

function verifyReminders(tempDirectory) {
  const verifyPath = join(tempDirectory, 'tasks-reminder-verify.sql');
  const runsPath = join(tempDirectory, 'tasks-reminder-runs.sql');
  writePrivate(
    verifyPath,
    withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-reminders/verify.sql')),
  );
  writePrivate(runsPath, `SELECT status, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'tasks-dispatch-reminders')
ORDER BY start_time DESC
LIMIT 3;
`);
  run('supabase', ['db', 'query', '--linked', '--file', verifyPath]);
  run('supabase', ['db', 'query', '--linked', '--file', runsPath]);
}

function runSyntheticTopology(powerSyncUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(powerSyncUrl);
  } catch {
    fail('A valid PowerSync HTTPS instance URL is required');
  }
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.powersync.journeyapps.com')) {
    fail('The synthetic topology gate only accepts a PowerSync Cloud HTTPS instance URL');
  }

  const apiKeyResponse = JSON.parse(run('supabase', [
    'projects', 'api-keys',
    '--project-ref', projectRef,
    '--reveal',
    '--output', 'json',
  ], { capture: true }));
  const apiKeys = Array.isArray(apiKeyResponse)
    ? apiKeyResponse
    : apiKeyResponse.api_keys ?? apiKeyResponse.keys;
  if (!Array.isArray(apiKeys)) fail('Supabase returned an unexpected API-key response');
  const readKey = (entry) => entry?.api_key ?? entry?.apiKey ?? entry?.key;
  const publishableKey = readKey(apiKeys.find((entry) => entry.type === 'publishable'))
    ?? readKey(apiKeys.find((entry) => entry.name === 'anon'));
  const serviceRoleKey = readKey(apiKeys.find((entry) => entry.type === 'secret'))
    ?? readKey(apiKeys.find((entry) => entry.name === 'service_role'));
  if (!publishableKey || !serviceRoleKey) {
    fail('Could not resolve the managed publishable and server-only Supabase keys');
  }

  run('npm', ['run', 'test:tasks:production-topology'], {
    env: {
      ...process.env,
      TASKS_PRODUCTION_TEST_CONFIRM: 'synthetic-only',
      TASKS_PRODUCTION_TEST_SUPABASE_URL: `https://${projectRef}.supabase.co`,
      TASKS_PRODUCTION_TEST_SUPABASE_KEY: publishableKey,
      TASKS_PRODUCTION_TEST_SERVICE_ROLE_KEY: serviceRoleKey,
      TASKS_PRODUCTION_TEST_POWERSYNC_URL: parsedUrl.origin,
    },
  });
  process.stdout.write('Synthetic production topology gate passed.\n');
}

const command = process.argv[2];
if (!['sync-database', 'reminders', 'verify-reminders', 'synthetic-topology'].includes(command)) {
  fail('Usage: node scripts/provision-tasks-production.mjs <sync-database|reminders|verify-reminders|synthetic-topology> [PowerSync URL]');
}

const tempDirectory = mkdtempSync(join(tmpdir(), 'bathos-tasks-production-'));
try {
  if (command === 'sync-database') provisionSyncDatabase(tempDirectory);
  if (command === 'reminders') provisionReminders(tempDirectory);
  if (command === 'verify-reminders') verifyReminders(tempDirectory);
  if (command === 'synthetic-topology') runSyntheticTopology(process.argv[3]);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

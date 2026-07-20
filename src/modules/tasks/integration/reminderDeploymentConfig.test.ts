import { createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateTaskReminderConfiguration } from '../../../../scripts/verify-tasks-web-push-config.mjs';
import { selectEdgeRuntimeImage } from '../../../../scripts/verify-tasks-edge-bundle.mjs';

function validEnvironment() {
  const key = createECDH('prime256v1');
  key.generateKeys();
  const publicKey = key.getPublicKey(undefined, 'uncompressed').toString('base64url');
  return {
    TASKS_REMINDER_DISPATCH_SECRET: 'a'.repeat(32),
    TASKS_WEB_PUSH_VAPID_PUBLIC_KEY: publicKey,
    TASKS_WEB_PUSH_VAPID_PRIVATE_KEY: key.getPrivateKey().toString('base64url'),
    TASKS_WEB_PUSH_SUBJECT: 'mailto:owner@example.test',
    VITE_TASKS_WEB_PUSH_PUBLIC_KEY: publicKey,
  };
}

describe('task reminder deployment configuration', () => {
  it('selects the newest cached official Edge Runtime image', () => {
    expect(selectEdgeRuntimeImage([
      'unrelated/image:latest',
      'public.ecr.aws/supabase/edge-runtime:v1.9.0',
      'public.ecr.aws/supabase/edge-runtime:v1.74.2',
      'public.ecr.aws/supabase/edge-runtime:<none>',
    ].join('\n'))).toBe('public.ecr.aws/supabase/edge-runtime:v1.74.2');
  });

  it('rejects a runtime override outside the official Supabase repository', () => {
    expect(() => selectEdgeRuntimeImage('', 'example.test/edge-runtime:v1')).toThrow(
      'TASKS_EDGE_RUNTIME_IMAGE must use public.ecr.aws/supabase/edge-runtime',
    );
  });

  it('accepts one internally consistent server and browser configuration', () => {
    expect(validateTaskReminderConfiguration(validEnvironment())).toEqual({
      publicKeyFingerprint: expect.stringMatching(/^[a-f0-9]{12}$/),
    });
  });

  it('rejects short dispatch secrets', () => {
    const environment = validEnvironment();
    environment.TASKS_REMINDER_DISPATCH_SECRET = 'too-short';
    expect(() => validateTaskReminderConfiguration(environment)).toThrow(
      'TASKS_REMINDER_DISPATCH_SECRET must contain at least 32 bytes',
    );
  });

  it('rejects mismatched public and private key material', () => {
    const environment = validEnvironment();
    const otherKey = createECDH('prime256v1');
    otherKey.generateKeys();
    environment.TASKS_WEB_PUSH_VAPID_PRIVATE_KEY = otherKey.getPrivateKey().toString('base64url');
    expect(() => validateTaskReminderConfiguration(environment)).toThrow(
      'The VAPID public and private keys do not form a key pair',
    );
  });

  it('rejects a browser key that differs from the server key', () => {
    const environment = validEnvironment();
    environment.VITE_TASKS_WEB_PUSH_PUBLIC_KEY = `${environment.VITE_TASKS_WEB_PUSH_PUBLIC_KEY}a`;
    expect(() => validateTaskReminderConfiguration(environment)).toThrow(
      'The server and client VAPID public keys do not match',
    );
  });

  it('rejects localhost and malformed VAPID contact subjects', () => {
    const environment = validEnvironment();
    environment.TASKS_WEB_PUSH_SUBJECT = 'https://localhost/support';
    expect(() => validateTaskReminderConfiguration(environment)).toThrow(
      'TASKS_WEB_PUSH_SUBJECT must be a mailto: or public HTTPS URI',
    );
  });

  it('keeps the public function boundary on custom dispatch-secret authentication', () => {
    const config = readFileSync(join(process.cwd(), 'supabase/config.toml'), 'utf8');
    expect(config).toMatch(
      /\[functions\.dispatch-task-reminders\]\nverify_jwt = false\nentrypoint = "\.\/functions\/dispatch-task-reminders\/index\.ts"\nimport_map = "\.\/functions\/dispatch-task-reminders\/deno\.json"/,
    );
  });

  it('pins Cron to the approved job, endpoint, cadence, and Vault lookup', () => {
    const extensionsSql = readFileSync(
      join(process.cwd(), 'deploy/tasks-reminders/extensions-enable.sql'),
      'utf8',
    );
    const createSql = readFileSync(
      join(process.cwd(), 'deploy/tasks-reminders/cron-create.sql'),
      'utf8',
    );
    const verifySql = readFileSync(
      join(process.cwd(), 'deploy/tasks-reminders/verify.sql'),
      'utf8',
    );
    const localTestSql = readFileSync(
      join(process.cwd(), 'deploy/tasks-reminders/test-local.sql'),
      'utf8',
    );
    expect(extensionsSql).toContain('CREATE EXTENSION IF NOT EXISTS pg_cron');
    expect(extensionsSql).toContain('CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions');
    expect(localTestSql).toContain('\\ir extensions-enable.sql');
    expect(localTestSql).not.toContain('CREATE EXTENSION IF NOT EXISTS pg_cron');
    for (const value of [createSql, verifySql]) {
      expect(value).toContain('tasks-dispatch-reminders');
      expect(value).toContain('* * * * *');
      expect(value).toContain(
        'https://rsqfokyqntmtdejfwmjs.supabase.co/functions/v1/dispatch-task-reminders',
      );
      expect(value).toContain('tasks_reminder_dispatch_secret');
    }
    expect(createSql).not.toContain('TASKS_REMINDER_DISPATCH_SECRET=');
    expect(verifySql).toContain('position(dispatch_secret in job_command)');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { tasksPowerSyncSchema } from './schema';

const root = resolve(import.meta.dirname, '../../../..');
const productionSyncConfig = read('deploy/tasks-powersync/sync-config.yaml');
const productionPublicationCreate = read('deploy/tasks-powersync/publication-create.sql');
const productionPublicationUpdate = read('deploy/tasks-powersync/publication-update.sql');
const productionRole = read('deploy/tasks-powersync/database-role.sql');
const productionVerify = read('deploy/tasks-powersync/verify.sql');
const productionProvisioner = read('scripts/provision-tasks-production.mjs');
const packageJson = read('package.json');
const externalBoundaryMigration = read(
  'supabase/migrations/20260721134118_harden_tasks_external_boundaries.sql',
);
const publicFunctionBoundaryMigration = read(
  'supabase/migrations/20260721140852_close_powersync_public_function_path.sql',
);
const selfHostedExample = read('deploy/tasks-powersync/service.self-hosted.example.yaml');
const disposableSyncConfig = read('spikes/tasks-module-reconnection/powersync/sync-config.yaml');
const disposablePublication = read('spikes/tasks-module-reconnection/sql/setup.sql');
const disposableCleanup = read('spikes/tasks-module-reconnection/sql/cleanup.sql');

describe('Tasks PowerSync deployment configuration', () => {
  const schema = tasksPowerSyncSchema.toJSON() as {
    tables: Array<{ name: string; local_only: boolean }>;
  };
  const synchronizedTables = schema.tables
    .filter(({ local_only: localOnly }) => !localOnly)
    .map(({ name }) => name)
    .sort();
  const authorizationTables = ['bathos_module_access_grants'];
  const publicationContract = [...authorizationTables, ...synchronizedTables].sort();

  it('keeps every stream and publication aligned with the nonlocal client schema', () => {
    expect(streamTables(productionSyncConfig)).toEqual(synchronizedTables);
    expect(streamTables(disposableSyncConfig)).toEqual(synchronizedTables);
    expect(publicationTables(productionPublicationCreate)).toEqual(publicationContract);
    expect(publicationTables(productionPublicationUpdate)).toEqual(publicationContract);
    expect(publicationTables(disposablePublication)).toEqual(publicationContract);
    expect(grantedTables(productionRole)).toEqual(publicationContract);
    expect(verifiedTables(productionVerify)).toEqual(publicationContract);
  });

  it('keeps every download query owner-scoped and gated by module access', () => {
    const queries = productionSyncConfig.match(/^\s+- SELECT .+$/gm) ?? [];
    expect(queries).toHaveLength(synchronizedTables.length);
    for (const table of synchronizedTables) {
      expect(queries).toContain(
        `      - SELECT * FROM ${table} WHERE owner_id IN tasks_access`,
      );
    }
    expect(productionSyncConfig).toContain(
      "tasks_access: SELECT user_id FROM bathos_module_access_grants WHERE module_id = 'tasks' AND user_id = auth.user_id()",
    );
    expect(productionSyncConfig).not.toMatch(/JOIN|FOR ALL TABLES/i);
  });

  it('keeps the disposable and production owner stream identical', () => {
    expect(disposableSyncConfig).toBe(productionSyncConfig);
  });

  it('removes only inactive disposable replication slots during local harness cleanup', () => {
    expect(disposableCleanup).toContain("slot_name LIKE 'powersync_1_%'");
    expect(disposableCleanup).toContain('database = current_database()');
    expect(disposableCleanup).toContain('AND NOT active');
    expect(disposableCleanup).toContain('DROP PUBLICATION IF EXISTS powersync');
  });

  it('keeps deployment secrets external and requires verified TLS for self-hosting', () => {
    expect(productionRole).toContain('\\getenv tasks_powersync_password');
    expect(productionRole).toContain("length(:'tasks_powersync_password') >= 32");
    expect(productionRole).not.toMatch(/PASSWORD\s+'[^']+'/i);
    expect(selfHostedExample).toContain('uri: !env PS_DATA_SOURCE_URI');
    expect(selfHostedExample).toContain('uri: !env PS_STORAGE_URI');
    expect(selfHostedExample.match(/sslmode: verify-full/g)).toHaveLength(2);
  });

  it('normalizes and verifies the replication login as a bounded effective data surface', () => {
    expect(productionRole).toContain('TASKS_POWERSYNC_ROLE_NORMALIZATION');
    expect(productionRole).toContain('NOCREATEDB NOCREATEROLE NOINHERIT');
    expect(productionRole).toContain('tasks_powersync_role is a superuser');
    expect(productionRole).toContain('aclexplode(relation.relacl)');
    expect(productionRole).toContain('aclexplode(attribute.attacl)');
    expect(productionRole).toContain('REVOKE %I FROM tasks_powersync_role');
    expect(productionVerify).toContain('has_schema_privilege');
    expect(productionVerify).toContain('can create persistent database objects');
    expect(productionVerify).toContain('public SECURITY DEFINER function');
    expect(productionVerify).toContain('managed pg_net exception');
    expect(productionVerify).toContain('unexpected role memberships');
    expect(externalBoundaryMigration).not.toContain('REVOKE USAGE ON SCHEMA net FROM PUBLIC');
    expect(publicFunctionBoundaryMigration).toContain(
      'REVOKE EXECUTE ON FUNCTION public.is_snake_household_member(uuid, uuid)',
    );
  });

  it('selects the existing-publication update path without losing the fresh-install path', () => {
    expect(productionProvisioner).toContain('pg_catalog.pg_publication');
    expect(productionProvisioner).toContain("? 'publication-update.sql'");
    expect(productionProvisioner).toContain(": 'publication-create.sql'");
    expect(productionProvisioner).toContain(
      "typeof publicationExists !== 'boolean'",
    );
  });

  it('keeps a read-only production verifier separate from database normalization', () => {
    expect(productionProvisioner).toContain("'verify-sync-database'");
    expect(productionProvisioner).toContain(
      "if (command === 'verify-sync-database') verifySyncDatabase(tempDirectory)",
    );
    expect(productionProvisioner).toContain(
      "withoutPsqlMetaCommands(join(repositoryRoot, 'deploy/tasks-powersync/verify.sql'))",
    );
  });

  it('keeps the exclusive Start production gate synthetic, focused, and cleanup-backed', () => {
    expect(productionProvisioner).toContain("'synthetic-exclusive-start'");
    expect(productionProvisioner).toContain("'test:tasks:production-exclusive-start'");
    expect(packageJson).toContain('"test:tasks:production-exclusive-start"');
    expect(packageJson).toContain("-t 'proves exclusive Start and Today horizons'");
    expect(packageJson).not.toContain(
      'test:tasks:production-exclusive-start": "npm run test:tasks:production-topology',
    );
  });

  it('keeps the structure-simplification gate synthetic, focused, and cleanup-backed', () => {
    expect(productionProvisioner).toContain("'synthetic-structure-simplification'");
    expect(productionProvisioner).toContain(
      "'test:tasks:production-structure-simplification'",
    );
    expect(packageJson).toContain('"test:tasks:production-structure-simplification"');
    expect(packageJson).toContain(
      "-t 'proves simplified scheduling through schema 12 and a fresh projection'",
    );
    expect(packageJson).not.toContain(
      'test:tasks:production-structure-simplification": "npm run test:tasks:production-topology',
    );
  });

  it('keeps the unified Start gate synthetic, focused, and cleanup-backed', () => {
    expect(productionProvisioner).toContain("'synthetic-unified-start'");
    expect(productionProvisioner).toContain("'test:tasks:production-unified-start'");
    expect(packageJson).toContain('"test:tasks:production-unified-start"');
    expect(packageJson).toContain(
      "-t 'proves unified Start planning, explicit link clearing, and a fresh projection'",
    );
    expect(packageJson).not.toContain(
      'test:tasks:production-unified-start": "npm run test:tasks:production-topology',
    );
  });

  it('keeps the undo and redo production gate synthetic, focused, and cleanup-backed', () => {
    expect(productionProvisioner).toContain("'synthetic-undo-redo'");
    expect(productionProvisioner).toContain("'test:tasks:production-undo-redo'");
    expect(packageJson).toContain('"test:tasks:production-undo-redo"');
    expect(packageJson).toContain("-t 'proves deep undo and redo through a fresh projection'");
    expect(packageJson).not.toContain(
      'test:tasks:production-undo-redo": "npm run test:tasks:production-topology',
    );
  });
});

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function streamTables(contents: string): string[] {
  return uniqueMatches(contents, /FROM\s+(tasks_[a-z_]+)/g);
}

function publicationTables(contents: string): string[] {
  return uniqueMatches(contents, /public\.((?:bathos_module_access_grants|tasks_[a-z_]+))/g);
}

function grantedTables(contents: string): string[] {
  const grant = contents.match(/GRANT SELECT ON TABLE([\s\S]+?)TO tasks_powersync_role;/)?.[1] ?? '';
  return publicationTables(grant);
}

function verifiedTables(contents: string): string[] {
  const expected = contents.match(/expected_tables text\[\] := ARRAY\[([\s\S]+?)\];/)?.[1] ?? '';
  return uniqueMatches(expected, /'((?:bathos_module_access_grants|tasks_[a-z_]+))'/g);
}

function uniqueMatches(contents: string, pattern: RegExp): string[] {
  return Array.from(contents.matchAll(pattern), (match) => match[1]).sort();
}

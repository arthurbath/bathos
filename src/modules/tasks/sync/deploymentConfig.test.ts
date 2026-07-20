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
const selfHostedExample = read('deploy/tasks-powersync/service.self-hosted.example.yaml');
const disposableSyncConfig = read('spikes/tasks-module-reconnection/powersync/sync-config.yaml');
const disposablePublication = read('spikes/tasks-module-reconnection/sql/setup.sql');

describe('Tasks PowerSync deployment configuration', () => {
  const schema = tasksPowerSyncSchema.toJSON() as {
    tables: Array<{ name: string; local_only: boolean }>;
  };
  const synchronizedTables = schema.tables
    .filter(({ local_only: localOnly }) => !localOnly)
    .map(({ name }) => name)
    .sort();

  it('keeps every stream and publication aligned with the nonlocal client schema', () => {
    expect(streamTables(productionSyncConfig)).toEqual(synchronizedTables);
    expect(streamTables(disposableSyncConfig)).toEqual(synchronizedTables);
    expect(publicationTables(productionPublicationCreate)).toEqual(synchronizedTables);
    expect(publicationTables(productionPublicationUpdate)).toEqual(synchronizedTables);
    expect(publicationTables(disposablePublication)).toEqual(synchronizedTables);
    expect(grantedTables(productionRole)).toEqual(synchronizedTables);
    expect(verifiedTables(productionVerify)).toEqual(synchronizedTables);
  });

  it('keeps every download query owner-scoped without joins or wildcard table selection', () => {
    const queries = productionSyncConfig.match(/^\s+- SELECT .+$/gm) ?? [];
    expect(queries).toHaveLength(synchronizedTables.length);
    for (const table of synchronizedTables) {
      expect(queries).toContain(
        `      - SELECT * FROM ${table} WHERE owner_id = auth.user_id()`,
      );
    }
    expect(productionSyncConfig).not.toMatch(/JOIN|FOR ALL TABLES/i);
  });

  it('keeps the disposable and production owner stream identical', () => {
    expect(disposableSyncConfig).toBe(productionSyncConfig);
  });

  it('keeps deployment secrets external and requires verified TLS for self-hosting', () => {
    expect(productionRole).toContain('\\getenv tasks_powersync_password');
    expect(productionRole).toContain("length(:'tasks_powersync_password') >= 32");
    expect(productionRole).not.toMatch(/PASSWORD\s+'[^']+'/i);
    expect(selfHostedExample).toContain('uri: !env PS_DATA_SOURCE_URI');
    expect(selfHostedExample).toContain('uri: !env PS_STORAGE_URI');
    expect(selfHostedExample.match(/sslmode: verify-full/g)).toHaveLength(2);
  });
});

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function streamTables(contents: string): string[] {
  return uniqueMatches(contents, /FROM\s+(tasks_[a-z_]+)/g);
}

function publicationTables(contents: string): string[] {
  return uniqueMatches(contents, /public\.(tasks_[a-z_]+)/g);
}

function grantedTables(contents: string): string[] {
  const grant = contents.match(/GRANT SELECT ON TABLE([\s\S]+?)TO tasks_powersync_role;/)?.[1] ?? '';
  return publicationTables(grant);
}

function verifiedTables(contents: string): string[] {
  const expected = contents.match(/expected_tables text\[\] := ARRAY\[([\s\S]+?)\];/)?.[1] ?? '';
  return uniqueMatches(expected, /'(tasks_[a-z_]+)'/g);
}

function uniqueMatches(contents: string, pattern: RegExp): string[] {
  return Array.from(contents.matchAll(pattern), (match) => match[1]).sort();
}

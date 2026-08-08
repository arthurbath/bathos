// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const functionsRoot = join(repositoryRoot, 'supabase/functions');
const approvedSupabaseVersion = '2.112.2';
const mappedFunctions = [
  'admin-delete-users',
  'check-auth-rate-limit',
  'delete-user-account',
  'dispatch-task-reminders',
  'notify-new-signup',
  'send-feedback-email',
  'submit-help-request',
  'tasks-widget-actions',
] as const;
const lockedFunctions = [
  'dispatch-task-reminders',
  'tasks-widget-actions',
] as const;

const exactNpmSpecifier = /^npm:(?:@[^/]+\/[^@/]+|[^@/]+)@\d+\.\d+\.\d+(?:\/.*)?$/;

describe('Edge dependency pins', () => {
  it('uses function-local exact npm mappings for every hand-maintained function', () => {
    for (const functionName of mappedFunctions) {
      const functionRoot = join(functionsRoot, functionName);
      const configPath = join(functionRoot, 'deno.json');
      expect(existsSync(configPath), `${functionName} must own deno.json`).toBe(true);

      const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
        imports?: Record<string, string>;
        compilerOptions?: { types?: string[] };
      };
      expect(config.imports?.['@supabase/supabase-js']).toBe(
        `npm:@supabase/supabase-js@${approvedSupabaseVersion}`,
      );

      const externalSpecifiers = [
        ...Object.values(config.imports ?? {}),
        ...(config.compilerOptions?.types ?? []),
      ].filter((value) => value.startsWith('npm:'));
      expect(externalSpecifiers.length, `${functionName} must map npm dependencies`).toBeGreaterThan(0);
      for (const specifier of externalSpecifiers) {
        expect(specifier, `${functionName} has a floating npm specifier`).toMatch(exactNpmSpecifier);
      }

      const entrypoint = readFileSync(join(functionRoot, 'index.ts'), 'utf8');
      expect(entrypoint).not.toMatch(/https?:\/\/(?:esm\.sh|deno\.land|unpkg\.com|cdn\.skypack\.dev)/);
      expect(entrypoint).toMatch(/from ["']@supabase\/supabase-js["']/);
    }
  });

  it('keeps every direct external Edge import exact and npm-hosted', () => {
    for (const functionName of edgeFunctionDirectories()) {
      const source = readFileSync(join(functionsRoot, functionName, 'index.ts'), 'utf8');
      expect(source, `${functionName} uses a CDN-hosted dependency`).not.toMatch(
        /https?:\/\/(?:esm\.sh|deno\.land|unpkg\.com|cdn\.skypack\.dev)/,
      );
      for (const [, specifier] of source.matchAll(/from\s+["'](npm:[^"']+)["']/g)) {
        expect(specifier, `${functionName} has a floating npm import`).toMatch(exactNpmSpecifier);
      }
    }
  });

  it('locks the task Edge dependency graphs to the approved Supabase version', () => {
    for (const functionName of lockedFunctions) {
      const lockPath = join(functionsRoot, functionName, 'deno.lock');
      expect(existsSync(lockPath), `${functionName} must own deno.lock`).toBe(true);
      const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
        specifiers?: Record<string, string>;
        npm?: Record<string, unknown>;
      };
      expect(lock.specifiers?.[`npm:@supabase/supabase-js@${approvedSupabaseVersion}`]).toBe(
        approvedSupabaseVersion,
      );
      expect(Object.keys(lock.npm ?? {})).toContain(
        `@supabase/supabase-js@${approvedSupabaseVersion}`,
      );
      expect(JSON.stringify(lock)).not.toContain('@supabase/supabase-js@2.95.3');
    }
  });

  it('reproduces exact generated MCP imports from exact root generator inputs', () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(packageJson.dependencies['@lovable.dev/mcp-js']).toBe('0.20.1');
    expect(packageJson.dependencies.zod).toBe('3.25.76');
    expect(packageJson.dependencies['@supabase/supabase-js']).toBe(approvedSupabaseVersion);

    const mcpSource = readFileSync(join(functionsRoot, 'mcp/index.ts'), 'utf8');
    expect(mcpSource).toContain('npm:@lovable.dev/mcp-js@0.20.1');
    expect(mcpSource).toContain('npm:zod@3.25.76');
    expect(mcpSource).toContain(`npm:@supabase/supabase-js@${approvedSupabaseVersion}`);
    expect(mcpSource).toContain('npm:fractional-indexing@4.0.0');
  });
});

function edgeFunctionDirectories(): string[] {
  return readdirSync(functionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(functionsRoot, name, 'index.ts')))
    .sort();
}

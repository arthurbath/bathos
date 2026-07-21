import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Tasks MCP deployment bundle', () => {
  const bundle = readFileSync(
    join(process.cwd(), 'supabase/functions/mcp/index.ts'),
    'utf8',
  );

  it('registers the production task creation tool', () => {
    expect(bundle).toContain('name: "create_task"');
    expect(bundle).toContain('createTask,');
  });

  it('inlines BathOS task-domain modules instead of emitting invalid npm aliases', () => {
    expect(bundle).toContain('// src/modules/tasks/domain/taskDates.ts');
    expect(bundle).toContain('// src/modules/tasks/domain/taskOrder.ts');
    expect(bundle).not.toContain('from "npm:@/');
  });
});

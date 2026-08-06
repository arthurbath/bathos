import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getTaskNativeQuickEntryCreationPlacement,
  getTaskNativeQuickEntryFieldLabel,
  normalizeTaskNativeQuickEntryChecklist,
  normalizeTaskNativeQuickEntrySummary,
  TASK_NATIVE_QUICK_ENTRY_ACTIONABILITIES,
  TASK_NATIVE_QUICK_ENTRY_COMMANDS,
  TASK_NATIVE_QUICK_ENTRY_FIELDS,
  TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS,
  TASK_NATIVE_QUICK_ENTRY_TODAY_SECTIONS,
  taskNativeQuickEntryContractFingerprint,
} from '@/modules/tasks/domain/taskNativeQuickEntryContract';
import { isTaskNativeQuickEntryMetadataCommand } from '@/modules/tasks/domain/taskKeyboardCommands';

const repositoryRoot = resolve(process.cwd());

describe('native Quick Entry contract', () => {
  it('preserves the complete shared field and option order', () => {
    expect(TASK_NATIVE_QUICK_ENTRY_FIELDS.map(({ id }) => id)).toEqual([
      'summary',
      'start',
      'reminder',
      'deadline',
      'area',
      'actionability',
      'notes',
      'link',
      'checklist',
    ]);
    expect(TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS).toEqual([
      { id: 'summary', fieldIds: ['summary'] },
      { id: 'temporal', fieldIds: ['start', 'reminder', 'deadline'] },
      { id: 'identity', fieldIds: ['area', 'actionability'] },
      { id: 'optional', fieldIds: ['notes', 'link', 'checklist'] },
    ]);
    expect(TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS.flatMap(({ fieldIds }) => fieldIds))
      .toEqual(TASK_NATIVE_QUICK_ENTRY_FIELDS.map(({ id }) => id));
    expect(TASK_NATIVE_QUICK_ENTRY_TODAY_SECTIONS.map(({ value }) => value)).toEqual([
      'inbox', 'now', 'next', 'later',
    ]);
    expect(TASK_NATIVE_QUICK_ENTRY_ACTIONABILITIES.map(({ value }) => value)).toEqual([
      'actionable', 'rechecking', 'waiting',
    ]);
    expect(getTaskNativeQuickEntryCreationPlacement()).toEqual({ todaySection: 'inbox' });
    expect(getTaskNativeQuickEntryFieldLabel('link')).toBe('Link');
  });

  it('makes the ordinary Quick Entry metadata allowlist contract-driven', () => {
    expect(TASK_NATIVE_QUICK_ENTRY_COMMANDS.map(({ key }) => key)).toEqual([
      'e', 'r', 't', 'y', 'n', 'd', 'f', 'g', 'h', 'c', 'v',
    ]);
    for (const { command } of TASK_NATIVE_QUICK_ENTRY_COMMANDS) {
      expect(isTaskNativeQuickEntryMetadataCommand(command)).toBe(true);
    }
    expect(isTaskNativeQuickEntryMetadataCommand('toggle-completion')).toBe(false);
    expect(isTaskNativeQuickEntryMetadataCommand('capture')).toBe(false);
  });

  it('normalizes Summary and checklist values at the shared boundary', () => {
    expect(normalizeTaskNativeQuickEntrySummary('  Call Babs  ')).toBe('Call Babs');
    expect(() => normalizeTaskNativeQuickEntrySummary('   ')).toThrow(
      'A task summary is required',
    );
    expect(normalizeTaskNativeQuickEntryChecklist([
      '  First  ',
      '',
      'Second',
    ])).toEqual(['First', 'Second']);
  });

  it('keeps generated TypeScript and Swift artifacts fingerprinted to the neutral source', () => {
    const source = readFileSync(
      `${repositoryRoot}/contracts/tasks-native-quick-entry-v1.json`,
      'utf8',
    );
    const canonical = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
    const fingerprint = createHash('sha256').update(canonical).digest('hex');
    expect(taskNativeQuickEntryContractFingerprint).toBe(fingerprint);

    const generatedSwift = readFileSync(
      `${repositoryRoot}/macos/TasksCompanion/TasksMac/TasksNativeQuickEntryContract.generated.swift`,
      'utf8',
    );
    expect(generatedSwift).toContain(`sourceFingerprint = "${fingerprint}"`);
  });

  it('keeps the ordinary web drawer sections in neutral contract order', () => {
    const drawerSource = readFileSync(
      `${repositoryRoot}/src/modules/tasks/components/TaskMetadataDrawerFields.tsx`,
      'utf8',
    );
    let priorOffset = -1;
    for (const { id } of TASK_NATIVE_QUICK_ENTRY_LAYOUT_SECTIONS) {
      const marker = `data-task-native-quick-entry-layout-section="${id}"`;
      const offset = drawerSource.indexOf(marker);
      expect(offset, `Missing web drawer layout section ${id}`).toBeGreaterThan(priorOffset);
      priorOffset = offset;
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  parseTaskChecklistClipboard,
  serializeTaskChecklistClipboard,
  TASK_CHECKLIST_CLIPBOARD_KIND,
  TASK_CHECKLIST_CLIPBOARD_MAX_ITEMS,
} from './taskChecklistClipboard';

describe('task checklist clipboard', () => {
  it('round-trips ordered checklist items and completion state', () => {
    const serialized = serializeTaskChecklistClipboard('copy', [
      { title: 'First', completed: false },
      { title: 'Second', completed: true },
    ]);

    expect(parseTaskChecklistClipboard(serialized)).toEqual({
      kind: 'checklist-items',
      envelope: {
        kind: TASK_CHECKLIST_CLIPBOARD_KIND,
        version: 1,
        operation: 'copy',
        items: [
          { title: 'First', completed: false },
          { title: 'Second', completed: true },
        ],
      },
    });
  });

  it('retains ordinary text outside the checklist envelope', () => {
    expect(parseTaskChecklistClipboard('First\nSecond')).toEqual({
      kind: 'text',
      text: 'First\nSecond',
    });
    expect(parseTaskChecklistClipboard('')).toEqual({ kind: 'empty' });
  });

  it.each([
    [{ kind: TASK_CHECKLIST_CLIPBOARD_KIND, version: 2, operation: 'copy', items: [] }],
    [{
      kind: TASK_CHECKLIST_CLIPBOARD_KIND,
      version: 1,
      operation: 'move',
      items: [{ title: 'Item', completed: false }],
    }],
    [{
      kind: TASK_CHECKLIST_CLIPBOARD_KIND,
      version: 1,
      operation: 'copy',
      items: [{ title: '', completed: false }],
    }],
    [{
      kind: TASK_CHECKLIST_CLIPBOARD_KIND,
      version: 1,
      operation: 'copy',
      items: [{ title: 'Item', completed: 'no' }],
    }],
  ])('rejects malformed checklist envelopes', (payload) => {
    expect(parseTaskChecklistClipboard(JSON.stringify(payload))).toMatchObject({
      kind: 'invalid-checklist-payload',
    });
  });

  it('enforces checklist count limits when serializing', () => {
    expect(() => serializeTaskChecklistClipboard('cut', [])).toThrow(
      'Checklist clipboard requires',
    );
    expect(() => serializeTaskChecklistClipboard(
      'copy',
      Array.from({ length: TASK_CHECKLIST_CLIPBOARD_MAX_ITEMS + 1 }, (_, index) => ({
        title: `Item ${index}`,
        completed: false,
      })),
    )).toThrow('Checklist clipboard requires');
  });
});

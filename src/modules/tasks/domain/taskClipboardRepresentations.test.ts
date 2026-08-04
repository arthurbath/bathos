import { describe, expect, it } from 'vitest';

import {
  createTaskClipboardRepresentations,
  readTaskClipboardStructuredText,
} from './taskClipboardRepresentations';

describe('task clipboard representations', () => {
  it('provides readable text and round-trippable private task data', () => {
    const structuredText = JSON.stringify({ kind: 'garden.bath.tasks.clipboard' });
    const representations = createTaskClipboardRepresentations(
      'tasks',
      structuredText,
      ['First task', 'Second <task>'],
    );

    expect(representations.plainText).toBe('First task\nSecond <task>');
    expect(representations.html).toContain('Second &lt;task&gt;');
    expect(representations.webMimeType).toBe(
      'web application/vnd.garden.bath.tasks+json',
    );
    expect(readTaskClipboardStructuredText({
      getData: (type) => (type === 'text/html' ? representations.html : ''),
    }, 'tasks')).toBe(structuredText);
  });

  it('prefers a private checklist format over HTML fallback data', () => {
    const representations = createTaskClipboardRepresentations(
      'checklist-items',
      '{"source":"html"}',
      ['First', 'Second'],
    );
    expect(readTaskClipboardStructuredText({
      getData: (type) => (
        type === representations.webMimeType
          ? '{"source":"private"}'
          : type === 'text/html'
            ? representations.html
            : ''
      ),
    }, 'checklist-items')).toBe('{"source":"private"}');
  });

  it('ignores malformed and cross-kind HTML payload markers', () => {
    const tasks = createTaskClipboardRepresentations(
      'tasks',
      '{"task":true}',
      ['Task'],
    );
    expect(readTaskClipboardStructuredText({
      getData: (type) => (type === 'text/html' ? tasks.html : ''),
    }, 'checklist-items')).toBeNull();
    expect(readTaskClipboardStructuredText({
      getData: (type) => (
        type === 'text/html'
          ? '<span hidden data-bathos-clipboard="tasks" data-bathos-clipboard-payload="%E0%A4%A"></span>'
          : ''
      ),
    }, 'tasks')).toBeNull();
  });
});

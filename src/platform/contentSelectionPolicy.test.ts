import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('BathOS content selection policy', () => {
  it('makes ordinary application content nonselectable by default', () => {
    expect(stylesheet).toMatch(/body\s*\{[^}]*-webkit-user-select:\s*none;[^}]*user-select:\s*none;/s);
  });

  it('restores selection for active editors and intentional document surfaces', () => {
    expect(stylesheet).toContain('input:not([readonly]):not(:disabled)');
    expect(stylesheet).toContain('textarea:not([readonly]):not(:disabled)');
    expect(stylesheet).toContain("[contenteditable]:not([contenteditable='false'])");
    expect(stylesheet).toContain("[data-bathos-text-selection='allow']");
    expect(stylesheet).toMatch(/data-bathos-text-selection='allow'[^}]*-webkit-user-select:\s*text;[^}]*user-select:\s*text;/s);
  });

  it('suppresses native presentation dragging without targeting explicit application drag surfaces', () => {
    expect(stylesheet).toContain("a:not([data-bathos-native-drag='allow'])");
    expect(stylesheet).toContain("img:not([data-bathos-native-drag='allow'])");
    expect(stylesheet).toContain('-webkit-user-drag: none;');
    expect(stylesheet).not.toContain('[draggable]');
  });
});

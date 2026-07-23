import { describe, expect, it } from 'vitest';

import { getTaskKeyboardCommand } from './taskKeyboardCommands';

const gesture = (overrides: Partial<KeyboardEvent> = {}) => ({
  key: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
} as KeyboardEvent);

describe('getTaskKeyboardCommand', () => {
  it('maps Mac application commands and numbered views', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'n', metaKey: true }), true)).toBe('capture');
    expect(getTaskKeyboardCommand(gesture({ key: '/', metaKey: true }), true)).toBe('help');
    expect(getTaskKeyboardCommand(gesture({ key: 'f', metaKey: true }), true)).toBe('find');
    expect(getTaskKeyboardCommand(gesture({ key: '1', metaKey: true }), true)).toBe('view-today');
    expect(getTaskKeyboardCommand(gesture({ key: ',', metaKey: true }), true)).toBe('view-config');
    expect(getTaskKeyboardCommand(gesture({ key: 't', metaKey: true }), true)).toBe('plan-today');
    expect(getTaskKeyboardCommand(gesture({ key: 'r', metaKey: true }), true)).toBe('plan-anytime');
    expect(getTaskKeyboardCommand(gesture({ key: 'o', metaKey: true }), true)).toBe('plan-someday');
    expect(getTaskKeyboardCommand(gesture({ key: 'd', metaKey: true }), true)).toBe('open-deadline');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'd', metaKey: true, shiftKey: true }),
      true,
    )).toBe('duplicate');
    expect(getTaskKeyboardCommand(gesture({ key: 's', metaKey: true }), true)).toBe('open-start-date');
    expect(getTaskKeyboardCommand(gesture({ key: 'm', metaKey: true }), true)).toBe('open-organization');
    expect(getTaskKeyboardCommand(gesture({ key: 'h', metaKey: true }), true)).toBe('cycle-horizon');
    expect(getTaskKeyboardCommand(gesture({ key: 'e', metaKey: true }), true)).toBe('focus-reminder');
    expect(getTaskKeyboardCommand(gesture({ key: 'z', metaKey: true }), true)).toBe('undo');
    expect(getTaskKeyboardCommand(gesture({ key: 'a', metaKey: true }), true)).toBe('select-all');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'z', metaKey: true, shiftKey: true }),
      true,
    )).toBe('redo');
  });

  it('maps Windows application commands and numbered views', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'n', ctrlKey: true }), false)).toBe('capture');
    expect(getTaskKeyboardCommand(gesture({ key: '/', ctrlKey: true }), false)).toBe('help');
    expect(getTaskKeyboardCommand(gesture({ key: 'f', ctrlKey: true }), false)).toBe('find');
    expect(getTaskKeyboardCommand(gesture({ key: '5', ctrlKey: true }), false)).toBe('view-projects');
    expect(getTaskKeyboardCommand(gesture({ key: '7', ctrlKey: true }), false)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: ',', ctrlKey: true }), false)).toBe('view-config');
    expect(getTaskKeyboardCommand(gesture({ key: 't', ctrlKey: true }), false)).toBe('plan-today');
    expect(getTaskKeyboardCommand(gesture({ key: 'd', ctrlKey: true }), false)).toBe('open-deadline');
    expect(getTaskKeyboardCommand(gesture({ key: 'z', ctrlKey: true }), false)).toBe('undo');
    expect(getTaskKeyboardCommand(gesture({ key: 'a', ctrlKey: true }), false)).toBe('select-all');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'z', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('redo');
  });

  it('maps the platform-specific task traversal and lifecycle chords', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'd', ctrlKey: true }), true))
      .toBe('complete-open');
    expect(getTaskKeyboardCommand(gesture({ key: 's', ctrlKey: true }), true))
      .toBe('open-next');
    expect(getTaskKeyboardCommand(gesture({ key: 'w', ctrlKey: true }), true))
      .toBe('open-previous');
    expect(getTaskKeyboardCommand(gesture({ key: 'x', ctrlKey: true }), true))
      .toBe('close-editor');

    expect(getTaskKeyboardCommand(
      gesture({ key: 'd', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('complete-open');
    expect(getTaskKeyboardCommand(
      gesture({ key: 's', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('open-next');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'w', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('open-previous');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'x', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('close-editor');
  });

  it('rejects single characters and incomplete or extra modifiers', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'n' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: '?' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'g' }), false)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'c' }), false)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'ArrowDown' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 's', ctrlKey: true, shiftKey: true }), true))
      .toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 's', ctrlKey: true }), false))
      .toBe('open-start-date');
    expect(getTaskKeyboardCommand(
      gesture({ key: '1', ctrlKey: true, altKey: true }),
      false,
    )).toBeNull();
  });
});

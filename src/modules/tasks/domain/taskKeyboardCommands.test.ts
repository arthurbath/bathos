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
  it('maps the approved Mac Command actions', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'n', metaKey: true }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'Enter', metaKey: true }), true))
      .toBe('close-task');
    expect(getTaskKeyboardCommand(gesture({ key: 'Escape', metaKey: true }), true))
      .toBe('close-task');
    expect(getTaskKeyboardCommand(gesture({ key: '/', metaKey: true }), true))
      .toBe('keyboard-help');
    expect(getTaskKeyboardCommand(gesture({ key: 'd', metaKey: true }), true)).toBe('duplicate');
    expect(getTaskKeyboardCommand(gesture({ key: 'x', metaKey: true }), true)).toBe('cut');
    expect(getTaskKeyboardCommand(gesture({ key: 'c', metaKey: true }), true)).toBe('copy');
    expect(getTaskKeyboardCommand(gesture({ key: 'v', metaKey: true }), true)).toBe('paste');
    expect(getTaskKeyboardCommand(gesture({ key: 'z', metaKey: true }), true)).toBe('undo');
    expect(getTaskKeyboardCommand(gesture({ key: 'a', metaKey: true }), true)).toBe('select-all');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'z', metaKey: true, shiftKey: true }),
      true,
    )).toBe('redo');
    expect(getTaskKeyboardCommand(gesture({ key: 'y', metaKey: true }), true)).toBe('redo');
    expect(getTaskKeyboardCommand(gesture({ key: 'f', metaKey: true }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: '1', metaKey: true }), true)).toBe('view-today');
    expect(getTaskKeyboardCommand(gesture({ key: '2', metaKey: true }), true))
      .toBe('view-upcoming');
    expect(getTaskKeyboardCommand(gesture({ key: '3', metaKey: true }), true))
      .toBe('view-anytime');
    expect(getTaskKeyboardCommand(gesture({ key: '4', metaKey: true }), true))
      .toBe('view-someday');
    expect(getTaskKeyboardCommand(gesture({ key: '5', metaKey: true }), true)).toBe('view-done');
    expect(getTaskKeyboardCommand(gesture({ key: '6', metaKey: true }), true))
      .toBe('view-config');
  });

  it('maps Mac Control-number view navigation as the reliable web shortcut', () => {
    expect(getTaskKeyboardCommand(gesture({ key: '1', ctrlKey: true }), true))
      .toBe('view-today');
    expect(getTaskKeyboardCommand(gesture({ key: '2', ctrlKey: true }), true))
      .toBe('view-upcoming');
    expect(getTaskKeyboardCommand(gesture({ key: '3', ctrlKey: true }), true))
      .toBe('view-anytime');
    expect(getTaskKeyboardCommand(gesture({ key: '4', ctrlKey: true }), true))
      .toBe('view-someday');
    expect(getTaskKeyboardCommand(gesture({ key: '5', ctrlKey: true }), true))
      .toBe('view-done');
    expect(getTaskKeyboardCommand(gesture({ key: '6', ctrlKey: true }), true))
      .toBe('view-config');
  });

  it('maps Windows application commands without colliding redo and close', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'n', ctrlKey: true }), false)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'Enter', ctrlKey: true }), false))
      .toBe('close-task');
    expect(getTaskKeyboardCommand(gesture({ key: 'Escape', ctrlKey: true }), false))
      .toBe('close-task');
    expect(getTaskKeyboardCommand(gesture({ key: '/', ctrlKey: true }), false))
      .toBe('keyboard-help');
    expect(getTaskKeyboardCommand(gesture({ key: 'd', ctrlKey: true }), false)).toBe('duplicate');
    expect(getTaskKeyboardCommand(gesture({ key: 'x', ctrlKey: true }), false)).toBe('cut');
    expect(getTaskKeyboardCommand(gesture({ key: 'c', ctrlKey: true }), false)).toBe('copy');
    expect(getTaskKeyboardCommand(gesture({ key: 'v', ctrlKey: true }), false)).toBe('paste');
    expect(getTaskKeyboardCommand(gesture({ key: 'z', ctrlKey: true }), false)).toBe('undo');
    expect(getTaskKeyboardCommand(gesture({ key: 'a', ctrlKey: true }), false)).toBe('select-all');
    expect(getTaskKeyboardCommand(gesture({ key: 'y', ctrlKey: true }), false)).toBe('redo');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'z', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('redo');
    expect(getTaskKeyboardCommand(gesture({ key: '1', ctrlKey: true }), false))
      .toBe('view-today');
    expect(getTaskKeyboardCommand(gesture({ key: '2', ctrlKey: true }), false))
      .toBe('view-upcoming');
    expect(getTaskKeyboardCommand(gesture({ key: '3', ctrlKey: true }), false))
      .toBe('view-anytime');
    expect(getTaskKeyboardCommand(gesture({ key: '4', ctrlKey: true }), false))
      .toBe('view-someday');
    expect(getTaskKeyboardCommand(gesture({ key: '5', ctrlKey: true }), false))
      .toBe('view-done');
    expect(getTaskKeyboardCommand(gesture({ key: '6', ctrlKey: true }), false))
      .toBe('view-config');
  });

  it('maps every Tasks-specific chord from Mac Control to Windows Alt+Shift', () => {
    const bindings: Record<string, string> = {
      q: 'close-task',
      w: 'open-previous',
      e: 'open-start-date',
      r: 'cycle-horizon',
      t: 'clear-start',
      a: 'capture',
      s: 'open-next',
      d: 'open-deadline',
      f: 'cycle-actionability',
      g: 'set-someday',
      x: 'toggle-completion',
      c: 'open-checklist',
      v: 'cycle-area',
      b: 'focus-reminder',
    };
    for (const [key, command] of Object.entries(bindings)) {
      expect(getTaskKeyboardCommand(gesture({ key, ctrlKey: true }), true)).toBe(command);
      expect(getTaskKeyboardCommand(
        gesture({ key, altKey: true, shiftKey: true }),
        false,
      )).toBe(command);
    }
  });

  it('maps the Tasks Undo alias without shadowing Windows Redo', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'z', ctrlKey: true }), true)).toBe('undo');
    expect(getTaskKeyboardCommand(gesture({ key: 'z', ctrlKey: true }), false)).toBe('undo');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'z', altKey: true, shiftKey: true }),
      false,
    )).toBe('undo');
    expect(getTaskKeyboardCommand(
      gesture({ key: 'z', ctrlKey: true, shiftKey: true }),
      false,
    )).toBe('redo');
  });

  it('leaves former Windows Control+Shift task chords unbound', () => {
    for (const key of ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'x', 'c', 'v', 'b']) {
      expect(getTaskKeyboardCommand(
        gesture({ key, ctrlKey: true, shiftKey: true }),
        false,
      )).toBeNull();
    }
  });

  it('rejects single characters and incomplete or extra modifiers', () => {
    expect(getTaskKeyboardCommand(gesture({ key: 'n' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: '/' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: '?' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(
      gesture({ key: '/', metaKey: true, shiftKey: true }),
      true,
    )).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'g' }), false)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'c' }), false)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'ArrowDown' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'Escape' }), true)).toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'w', ctrlKey: true, shiftKey: true }), true))
      .toBeNull();
    expect(getTaskKeyboardCommand(gesture({ key: 'w', ctrlKey: true }), false))
      .toBeNull();
    expect(getTaskKeyboardCommand(
      gesture({ key: 'n', altKey: true, shiftKey: true }),
      false,
    )).toBeNull();
    expect(getTaskKeyboardCommand(
      gesture({ key: '1', ctrlKey: true, altKey: true }),
      false,
    )).toBeNull();
  });
});

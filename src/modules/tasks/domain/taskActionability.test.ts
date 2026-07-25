import { describe, expect, it } from 'vitest';

import { getNextTaskActionability } from './taskActionability';

describe('task actionability cycling', () => {
  it('preserves the ordinary cycle for one task', () => {
    expect(getNextTaskActionability(['actionable'])).toBe('waiting');
    expect(getNextTaskActionability(['waiting'])).toBe('rechecking');
    expect(getNextTaskActionability(['rechecking'])).toBe('actionable');
  });

  it('converges every mixed multi-task selection to waiting', () => {
    expect(getNextTaskActionability(['actionable', 'waiting'])).toBe('waiting');
    expect(getNextTaskActionability(['waiting', 'rechecking'])).toBe('waiting');
    expect(getNextTaskActionability(['actionable', 'rechecking'])).toBe('waiting');
    expect(getNextTaskActionability(['actionable', 'waiting', 'rechecking'])).toBe('waiting');
  });

  it('cycles uniform multi-task selections together', () => {
    expect(getNextTaskActionability(['actionable', 'actionable'])).toBe('waiting');
    expect(getNextTaskActionability(['waiting', 'waiting'])).toBe('rechecking');
    expect(getNextTaskActionability(['rechecking', 'rechecking'])).toBe('actionable');
  });

  it('does not invent a destination without a target', () => {
    expect(getNextTaskActionability([])).toBeNull();
  });
});

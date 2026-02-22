import { describe, expect, it } from 'vitest';
import { sanitizeColumnWidths, snapColumnWidth } from '@/lib/gridColumnWidths';

describe('gridColumnWidths', () => {
  it('snaps widths to 20px increments with a 60px minimum', () => {
    expect(snapColumnWidth(59)).toBe(60);
    expect(snapColumnWidth(60)).toBe(60);
    expect(snapColumnWidth(61)).toBe(60);
    expect(snapColumnWidth(79)).toBe(80);
    expect(snapColumnWidth(111)).toBe(120);
  });

  it('applies defaults, ignores unknown columns, and keeps fixed columns exact', () => {
    const defaults = {
      name: 240,
      amount: 120,
      actions: 60,
    };

    const sanitized = sanitizeColumnWidths(
      {
        name: 257,
        amount: 11,
        actions: 180,
        unknown_column: 999,
      },
      defaults,
      ['actions'],
    );

    expect(sanitized).toEqual({
      name: 260,
      amount: 60,
      actions: 60,
    });
  });
});

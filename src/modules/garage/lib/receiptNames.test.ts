import { describe, expect, it } from 'vitest';
import { getDefaultReceiptName } from '@/modules/garage/lib/receiptNames';

describe('getDefaultReceiptName', () => {
  it('removes only the final filename extension', () => {
    expect(getDefaultReceiptName('invoice.final.pdf')).toBe('invoice.final');
  });

  it('preserves filenames without a removable extension', () => {
    expect(getDefaultReceiptName('invoice')).toBe('invoice');
    expect(getDefaultReceiptName('.receipt')).toBe('.receipt');
    expect(getDefaultReceiptName('invoice.')).toBe('invoice.');
  });
});

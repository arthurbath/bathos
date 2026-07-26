import { describe, expect, it } from 'vitest';
import {
  hasBathosSentenceCaseStarts,
  isBathosSentenceCase,
  isBathosTitleCase,
  toBathosSentenceCase,
  toBathosTitleCase,
} from './uiTextCase';

describe('BathOS UI phrase casing', () => {
  it('normalizes governed title-case phrases', () => {
    expect(toBathosTitleCase('failed to validate CSV')).toBe('Failed to Validate CSV');
    expect(toBathosTitleCase('per-expense breakdown')).toBe('Per-Expense Breakdown');
    expect(toBathosTitleCase('connect to BathOS')).toBe('Connect to BathOS');
    expect(toBathosTitleCase('type to find a service')).toBe('Type to Find a Service');
    expect(toBathosTitleCase('eg: Housing, Food, Transport')).toBe(
      'eg: Housing, Food, Transport',
    );
    expect(toBathosTitleCase('weight (g)')).toBe('Weight (g)');
  });

  it('normalizes governed sentence-case phrases', () => {
    expect(toBathosSentenceCase('No Matching Tasks')).toBe('No matching tasks');
    expect(
      toBathosSentenceCase('No Records Yet. Add One or More Records to Compute the Average.'),
    ).toBe('No records yet. Add one or more records to compute the average.');
    expect(toBathosSentenceCase('No PowerSync Conflict Receipts.')).toBe(
      'No PowerSync conflict receipts.',
    );
    expect(toBathosSentenceCase('Synchronized Views Will Update Shortly.')).toBe(
      'Synchronized views will update shortly.',
    );
  });

  it('recognizes compliant phrases', () => {
    expect(isBathosTitleCase('Task Backup and Restore')).toBe(true);
    expect(isBathosTitleCase('CSV File Required')).toBe(true);
    expect(isBathosTitleCase('Failed to Validate CSV')).toBe(true);
    expect(isBathosTitleCase('Invalid reset link')).toBe(false);
    expect(isBathosSentenceCase('No matching tasks')).toBe(true);
    expect(isBathosSentenceCase('No Matching Tasks')).toBe(false);
    expect(
      hasBathosSentenceCaseStarts(
        'Tasks in Done can be copied. In-app reminders remain available.',
      ),
    ).toBe(true);
  });
});

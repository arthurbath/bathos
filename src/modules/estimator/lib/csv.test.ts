import { describe, expect, it } from 'vitest';
import { extractEstimatorTicketTitlesFromCsv } from '@/modules/estimator/lib/csv';

describe('extractEstimatorTicketTitlesFromCsv', () => {
  it('extracts ticket titles in source order and skips blank cells', () => {
    const csvText = [
      'Ticket Name,Owner',
      'Alpha,Art',
      ',Taylor',
      '  ,Jordan',
      'Beta,Pat',
      'Gamma,Lee',
    ].join('\n');

    expect(extractEstimatorTicketTitlesFromCsv(csvText, 'Ticket Name')).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('supports quoted commas, escaped quotes, and embedded newlines', () => {
    const csvText = [
      'Summary,Status',
      '"Estimate login, signup, and reset",Ready',
      '"Quoted ""story"" title",Ready',
      `"Multi-line
ticket title",Ready`,
    ].join('\n');

    expect(extractEstimatorTicketTitlesFromCsv(csvText, 'Summary')).toEqual([
      'Estimate login, signup, and reset',
      'Quoted "story" title',
      'Multi-line\nticket title',
    ]);
  });

  it('throws when the requested column is missing', () => {
    expect(() => extractEstimatorTicketTitlesFromCsv('Title\nAlpha', 'Summary')).toThrow(
      'Column "Summary" was not found in the CSV file.',
    );
  });
});

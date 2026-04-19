import { describe, expect, it } from 'vitest';
import { buildGarageServiceImportPreview, buildGarageServiceTemplateCsv } from '@/modules/garage/lib/serviceImport';
import type { GarageService } from '@/modules/garage/types/garage';

function makeService(overrides: Partial<GarageService> = {}): GarageService {
  return {
    id: 'service-1',
    user_id: 'user-1',
    vehicle_id: 'vehicle-1',
    name: 'Oil Change',
    type: 'replacement',
    monitoring: true,
    cadence_type: 'recurring',
    every_miles: 5000,
    every_months: 6,
    sort_order: 0,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('serviceImport', () => {
  it('builds the header-only template CSV', () => {
    expect(buildGarageServiceTemplateCsv()).toBe('Name,Type,Every (Miles),Every (Months),Monitoring,Notes\r\n');
  });

  it('classifies additions, updates, invalid rows, duplicates, and ignored headers', () => {
    const preview = buildGarageServiceImportPreview(
      [
        'Name,Type,Every (Miles),Every (Months),Monitoring,Notes,Ignored',
        'Oil Change,Replacement,6000,,TRUE,Updated note,foo',
        'Tire Pressure,Check,,,FALSE,,bar',
        'Tire Pressure,Replacement,,,TRUE,,baz',
        'Wiper Blades,BadType,,,maybe,,qux',
      ].join('\n'),
      [makeService()],
    );

    expect(preview.additions).toHaveLength(1);
    expect(preview.updates).toHaveLength(1);
    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.ignoredDuplicateRows).toEqual([
      {
        rowNumber: 3,
        name: 'Tire Pressure',
        replacedByRowNumber: 4,
      },
    ]);
    expect(preview.ignoredHeaders).toEqual(['Ignored']);
    expect(preview.rowsToImport).toEqual([
      {
        name: 'Tire Pressure',
        type: 'replacement',
        monitoring: true,
      },
      {
        name: 'Oil Change',
        type: 'replacement',
        every_miles: 6000,
        monitoring: true,
        notes: 'Updated note',
      },
    ]);
    expect(preview.invalidRows[0]?.reasons).toEqual([
      'Type must be blank or exactly Replacement, Clean/Lube, Adjustment, or Check.',
      'Monitoring must be exactly TRUE, FALSE, or blank.',
    ]);
  });

  it('treats blank cells as unchanged for updates and blank defaults for adds', () => {
    const preview = buildGarageServiceImportPreview(
      [
        'Name,Type,Every (Miles),Every (Months),Monitoring,Notes',
        ' Oil Change ,,,,,' ,
        'Chain Check,,,,,',
      ].join('\n'),
      [makeService({ notes: 'Keep', monitoring: true })],
    );

    expect(preview.updates[0]?.rpcRow).toEqual({ name: 'Oil Change' });
    expect(preview.updates[0]?.fieldSummaries).toEqual(['No visible field changes']);
    expect(preview.additions[0]?.rpcRow).toEqual({ name: 'Chain Check' });
    expect(preview.additions[0]?.fieldSummaries).toContain('Type: —');
    expect(preview.additions[0]?.fieldSummaries).toContain('Monitoring: FALSE');
  });

  it('marks rows invalid when the required Name header is missing', () => {
    const preview = buildGarageServiceImportPreview(
      [
        'Type,Monitoring',
        'Replacement,TRUE',
      ].join('\n'),
      [],
    );

    expect(preview.invalidRows).toEqual([
      {
        rowNumber: 2,
        name: '',
        reasons: ['The required Name header is missing.'],
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculateAgeMonths,
  deriveSnakeWeightRecords,
  findGrowthExpectationRange,
  formatGrowthStatus,
} from '@/modules/snake/lib/growthMath';
import type { Snake, SnakeGrowthExpectationRange, SnakeWeightRecord } from '@/modules/snake/types/snake';

const ranges: SnakeGrowthExpectationRange[] = [
  makeRange('0-3', 0, 3, 30, 50, 1),
  makeRange('3-6', 3, 6, 40, 80, 2),
  makeRange('6-12', 6, 12, 50, 100, 3),
  makeRange('12-24', 12, 24, 30, 80, 4),
  makeRange('24-36', 24, 36, 20, 50, 5),
  makeRange('36+', 36, null, 0, 20, 6),
];

const babylon: Snake = {
  id: 'snake-1',
  household_id: 'household-1',
  name: 'Babylon',
  birthday: '2024-11-27',
  species: 'Ball Python',
  growth_profile: 'ball_python',
  morph: null,
  sex: 'unknown',
  notes: null,
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function makeRange(
  label: string,
  lowerAge: number,
  upperAge: number | null,
  lowerGrowth: number,
  upperGrowth: number,
  sortOrder: number,
): SnakeGrowthExpectationRange {
  return {
    id: `range-${label}`,
    profile: 'ball_python',
    range_label: label,
    age_lower_months: lowerAge,
    age_upper_months: upperAge,
    growth_lower_grams_per_month: lowerGrowth,
    growth_upper_grams_per_month: upperGrowth,
    sort_order: sortOrder,
    created_at: '2026-01-01T00:00:00Z',
  };
}

function makeRecord(recordedOn: string, weightGrams: number): SnakeWeightRecord {
  return {
    id: `record-${recordedOn}`,
    household_id: 'household-1',
    snake_id: 'snake-1',
    recorded_on: recordedOn,
    weight_grams: weightGrams,
    created_at: `${recordedOn}T00:00:00Z`,
    updated_at: `${recordedOn}T00:00:00Z`,
  };
}

describe('snake growth math', () => {
  it('calculates age in 30-day months like the Airtable base', () => {
    expect(calculateAgeMonths('2024-11-27', '2026-06-05')).toBe(18.5);
    expect(calculateAgeMonths('2024-11-27', '2025-01-31')).toBe(2.17);
  });

  it('finds the active ball-python expectation range for an age', () => {
    expect(findGrowthExpectationRange(ranges, 'ball_python', 2.17)?.range_label).toBe('0-3');
    expect(findGrowthExpectationRange(ranges, 'ball_python', 5.17)?.range_label).toBe('3-6');
    expect(findGrowthExpectationRange(ranges, 'ball_python', 18.5)?.range_label).toBe('12-24');
  });

  it('formats growth status with rounded whole-gram monthly gaps', () => {
    expect(formatGrowthStatus({ changeGramsPerMonth: -8.18, lower: 30, upper: 80 })).toBe('38 g/mo Below Expectations');
    expect(formatGrowthStatus({ changeGramsPerMonth: -40.71, lower: 30, upper: 80 })).toBe('71 g/mo Below Expectations');
    expect(formatGrowthStatus({ changeGramsPerMonth: 68.71, lower: 30, upper: 80 })).toBe('Within Expectations');
    expect(formatGrowthStatus({ changeGramsPerMonth: 108.2, lower: 50, upper: 100 })).toBe('8 g/mo Above Expectations');
  });

  it('derives previous record and Airtable-equivalent growth statuses for Babylon records', () => {
    const records = [
      makeRecord('2026-06-05', 528),
      makeRecord('2026-05-03', 537),
      makeRecord('2026-04-05', 575),
      makeRecord('2026-03-05', 504),
      makeRecord('2026-02-08', 505),
      makeRecord('2026-01-03', 457),
      makeRecord('2025-12-04', 436),
      makeRecord('2025-11-01', 415),
      makeRecord('2025-10-01', 407),
      makeRecord('2025-09-01', 365),
      makeRecord('2025-08-03', 299),
      makeRecord('2025-07-01', 294),
      makeRecord('2025-06-01', 269),
      makeRecord('2025-05-01', 266),
      makeRecord('2025-04-01', 229),
      makeRecord('2025-03-02', 188),
      makeRecord('2025-01-31', 143),
    ];

    const derived = deriveSnakeWeightRecords({ snake: babylon, records, expectationRanges: ranges });

    expect(derived.map((record) => record.recorded_on)).toEqual(records.map((record) => record.recorded_on));
    expect(derived[0]).toMatchObject({
      recorded_on: '2026-06-05',
      previousRecordDate: '2026-05-03',
      previousWeightGrams: 537,
      changeGrams: -9,
      changeGramsPerMonth: -8.18,
      ageMonths: 18.5,
      growthExpectationLowerGramsPerMonth: 30,
      growthExpectationUpperGramsPerMonth: 80,
      growthStatus: '38 g/mo Below Expectations',
    });
    expect(derived[1].growthStatus).toBe('71 g/mo Below Expectations');
    expect(derived[2].growthStatus).toBe('Within Expectations');
    expect(derived[derived.length - 1]).toMatchObject({
      recorded_on: '2025-01-31',
      previousRecordDate: null,
      changeGramsPerMonth: null,
      growthStatus: null,
    });
  });
});

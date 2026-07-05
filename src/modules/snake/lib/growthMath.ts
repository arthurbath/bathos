import type {
  DerivedSnakeWeightRecord,
  Snake,
  SnakeGrowthExpectationRange,
  SnakeWeightRecord,
} from '@/modules/snake/types/snake';

const MS_PER_DAY = 86_400_000;

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = parseDateOnly(startDate).getTime();
  const end = parseDateOnly(endDate).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateAgeMonths(birthday: string, recordedOn: string): number | null {
  const days = daysBetween(birthday, recordedOn);
  if (!Number.isFinite(days) || days < 0) return null;
  return roundToTwoDecimals(days / 30);
}

export function findGrowthExpectationRange(
  ranges: SnakeGrowthExpectationRange[],
  profile: string,
  ageMonths: number | null,
): SnakeGrowthExpectationRange | null {
  if (ageMonths === null) return null;

  return ranges.find((range) => (
    range.profile === profile
    && ageMonths >= range.age_lower_months
    && (range.age_upper_months === null || ageMonths < range.age_upper_months)
  )) ?? null;
}

export function formatGrowthStatus(args: {
  changeGramsPerMonth: number | null;
  lower: number | null;
  upper: number | null;
}): string | null {
  const { changeGramsPerMonth, lower, upper } = args;
  if (changeGramsPerMonth === null || lower === null || upper === null) return null;

  if (changeGramsPerMonth < lower) {
    return `${Math.round(lower - changeGramsPerMonth)} g/mo Below Expectations`;
  }

  if (changeGramsPerMonth > upper) {
    return `${Math.round(changeGramsPerMonth - upper)} g/mo Above Expectations`;
  }

  return 'Within Expectations';
}

export function deriveSnakeWeightRecords(args: {
  snake: Snake;
  records: SnakeWeightRecord[];
  expectationRanges: SnakeGrowthExpectationRange[];
}): DerivedSnakeWeightRecord[] {
  const { snake, records, expectationRanges } = args;
  const ascending = [...records].sort((a, b) => (
    a.recorded_on.localeCompare(b.recorded_on)
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id)
  ));

  const derivedAscending = ascending.map((record, index): DerivedSnakeWeightRecord => {
    const previous = index > 0 ? ascending[index - 1] : null;
    const daysSincePrevious = previous ? daysBetween(previous.recorded_on, record.recorded_on) : null;
    const changeGrams = previous ? record.weight_grams - previous.weight_grams : null;
    const changeGramsPerMonth = (
      previous
      && daysSincePrevious !== null
      && daysSincePrevious > 0
      && changeGrams !== null
    )
      ? roundToTwoDecimals((changeGrams * 30) / daysSincePrevious)
      : null;
    const ageMonths = calculateAgeMonths(snake.birthday, record.recorded_on);
    const expectation = findGrowthExpectationRange(expectationRanges, snake.growth_profile, ageMonths);
    const lower = expectation?.growth_lower_grams_per_month ?? null;
    const upper = expectation?.growth_upper_grams_per_month ?? null;

    return {
      ...record,
      previousRecordDate: previous?.recorded_on ?? null,
      previousWeightGrams: previous?.weight_grams ?? null,
      daysSincePrevious,
      changeGrams,
      changeGramsPerMonth,
      ageMonths,
      growthExpectationLowerGramsPerMonth: lower,
      growthExpectationUpperGramsPerMonth: upper,
      growthStatus: formatGrowthStatus({ changeGramsPerMonth, lower, upper }),
    };
  });

  return derivedAscending.sort((a, b) => (
    b.recorded_on.localeCompare(a.recorded_on)
    || b.created_at.localeCompare(a.created_at)
    || b.id.localeCompare(a.id)
  ));
}

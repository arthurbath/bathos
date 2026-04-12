import { describe, expect, it } from 'vitest';
import {
  ESTIMATOR_BALLPARK_OPTIONS,
  ESTIMATOR_FIBONACCI_OPTIONS,
  ESTIMATOR_SHARED_VOTE_MASKS,
} from '@/modules/estimator/lib/constants';

describe('estimator vote masks', () => {
  it('keeps fibonacci and ballpark labels aligned by shared rank', () => {
    expect(ESTIMATOR_SHARED_VOTE_MASKS).toEqual([
      { rank: '1', fibonacci: '1', ballpark: 'XXS' },
      { rank: '2', fibonacci: '2', ballpark: 'XS' },
      { rank: '3', fibonacci: '3', ballpark: 'S' },
      { rank: '4', fibonacci: '5', ballpark: 'M' },
      { rank: '5', fibonacci: '8', ballpark: 'L' },
      { rank: '6', fibonacci: '13', ballpark: 'XL' },
      { rank: '7', fibonacci: '21+', ballpark: 'XXL+' },
    ]);
    expect(ESTIMATOR_BALLPARK_OPTIONS).toEqual(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL+']);
    expect(ESTIMATOR_FIBONACCI_OPTIONS).toEqual(['1', '2', '3', '5', '8', '13', '21+']);
  });
});

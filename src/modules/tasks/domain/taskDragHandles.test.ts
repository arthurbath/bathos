import { describe, expect, it } from 'vitest';

import {
  sanitizeTaskDragHandleVisibility,
  shouldShowTaskDragHandles,
} from './taskDragHandles';

describe('task drag handle visibility', () => {
  it('defaults missing or invalid preferences to hidden', () => {
    expect(sanitizeTaskDragHandleVisibility(undefined)).toBe('hidden');
    expect(sanitizeTaskDragHandleVisibility('sometimes')).toBe('hidden');
  });

  it('shows handles according to the configured surface policy', () => {
    expect(shouldShowTaskDragHandles('hidden', true)).toBe(false);
    expect(shouldShowTaskDragHandles('hidden', false)).toBe(false);
    expect(shouldShowTaskDragHandles('always', true)).toBe(true);
    expect(shouldShowTaskDragHandles('always', false)).toBe(true);
    expect(shouldShowTaskDragHandles('touch_only', true)).toBe(true);
    expect(shouldShowTaskDragHandles('touch_only', false)).toBe(false);
  });
});

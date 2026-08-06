import { afterEach, describe, expect, it, vi } from 'vitest';

import { alignOpenedTaskToVisibleContent } from './taskEditorMotion';

function rect(top: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    right: 100,
    bottom,
    left: 0,
    width: 100,
    height: bottom - top,
    toJSON: () => ({}),
  };
}

describe('task editor motion', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('aligns the summary row below sticky chrome with the shared offset', () => {
    const stickyHeader = document.createElement('header');
    stickyHeader.dataset.toplineHeader = '';
    vi.spyOn(stickyHeader, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
    const taskRow = document.createElement('article');
    const summaryRow = document.createElement('div');
    summaryRow.dataset.taskRowHeader = '';
    vi.spyOn(summaryRow, 'getBoundingClientRect').mockReturnValue(rect(200, 240));
    taskRow.append(summaryRow);
    document.body.append(stickyHeader, taskRow);
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);

    alignOpenedTaskToVisibleContent(taskRow, 'smooth');

    expect(scrollBy).toHaveBeenCalledWith({
      top: 56,
      left: 0,
      behavior: 'smooth',
    });
  });
});

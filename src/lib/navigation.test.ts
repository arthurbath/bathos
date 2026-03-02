import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { handleClientSideLinkNavigation, shouldHandleWithBrowser } from '@/lib/navigation';

function createPlainLeftClickEvent() {
  const preventDefault = vi.fn();
  const event = {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault,
  } as unknown as MouseEvent<HTMLElement>;
  return { event, preventDefault };
}

describe('navigation', () => {
  it('treats modified clicks as browser-handled', () => {
    const event = {
      defaultPrevented: false,
      button: 0,
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    } as MouseEvent<HTMLElement>;
    expect(shouldHandleWithBrowser(event)).toBe(true);
  });

  it('uses SPA navigation for plain left click in non-Safari browsers', () => {
    const { event, preventDefault } = createPlainLeftClickEvent();
    const navigate = vi.fn();

    handleClientSideLinkNavigation(event, navigate, '/budget/summary');

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/budget/summary');
  });

  it('prefers browser navigation on Safari for internal routes', () => {
    const uaSpy = vi
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      );
    const { event, preventDefault } = createPlainLeftClickEvent();
    const navigate = vi.fn();

    handleClientSideLinkNavigation(event, navigate, '/budget/summary');

    expect(preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    uaSpy.mockRestore();
  });
});

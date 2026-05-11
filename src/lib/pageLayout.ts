// Mobile full-view grids should stop above the mobile nav with a small buffer so
// footerless grids do not clip the final body row on short viewports.
export const FULL_VIEW_PAGE_BOTTOM_PADDING_CLASS = 'pb-[calc(env(safe-area-inset-bottom)+3.75rem+4px)] md:pb-0';
export const CARD_PAGE_BOTTOM_PADDING_CLASS = 'pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-6';

export function getFullViewPageTopPaddingClass(hasDesktopNavigation: boolean) {
  return hasDesktopNavigation ? 'pt-0 md:pt-6' : 'pt-0';
}

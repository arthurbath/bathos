import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function readLayer(source: string, marker: string): number {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const nearbySource = source.slice(markerIndex, markerIndex + 700);
  const match = nearbySource.match(/\bz-(?:\[(\d+)\]|(\d+))/u);
  expect(match).not.toBeNull();
  return Number(match?.[1] ?? match?.[2]);
}

describe('task selection stacking', () => {
  it('keeps modal backdrops and toasts above selection controls without covering modal content or mobile navigation', () => {
    const tasksSource = readSource('src/modules/tasks/components/TasksShell.tsx');
    const toastSource = readSource('src/components/ui/toast.tsx');
    const dialogSource = readSource('src/components/ui/dialog.tsx');
    const alertDialogSource = readSource('src/components/ui/alert-dialog.tsx');
    const navigationSource = readSource('src/platform/components/MobileBottomNav.tsx');
    const globalStyles = readSource('src/index.css');

    const selectionLayer = readLayer(tasksSource, 'aria-label="Task Selection"');
    const dialogBackdropLayer = readLayer(dialogSource, 'DialogOverlay');
    const alertDialogBackdropLayer = readLayer(alertDialogSource, 'AlertDialogOverlay');
    const toastLayer = readLayer(toastSource, 'bathos-toast-viewport');
    const navigationLayer = readLayer(
      navigationSource,
      'bottom-[var(--mobile-bottom-nav-bottom-offset)]',
    );

    expect(selectionLayer).toBeLessThan(dialogBackdropLayer);
    expect(alertDialogBackdropLayer).toBe(dialogBackdropLayer);
    expect(dialogBackdropLayer).toBeLessThan(toastLayer);
    expect(toastLayer).toBeLessThan(navigationLayer);
    expect(globalStyles).toContain(
      'body:has([data-task-start-picker-backdrop], [data-date-picker-backdrop])',
    );
    expect(globalStyles).toMatch(
      /\.bathos-mobile-bottom-nav\s*\{\s*z-index:\s*32;/u,
    );
  });
});

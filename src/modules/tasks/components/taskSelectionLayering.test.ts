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
  it('keeps toasts above selection controls and below mobile navigation', () => {
    const tasksSource = readSource('src/modules/tasks/components/TasksShell.tsx');
    const toastSource = readSource('src/components/ui/toast.tsx');
    const navigationSource = readSource('src/platform/components/MobileBottomNav.tsx');

    const selectionLayer = readLayer(tasksSource, 'aria-label="Task Selection"');
    const toastLayer = readLayer(toastSource, 'bathos-toast-viewport');
    const navigationLayer = readLayer(
      navigationSource,
      'bottom-[var(--mobile-bottom-nav-bottom-offset)]',
    );

    expect(selectionLayer).toBeLessThan(toastLayer);
    expect(toastLayer).toBeLessThan(navigationLayer);
  });
});

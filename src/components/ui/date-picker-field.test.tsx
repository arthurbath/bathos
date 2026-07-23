import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DatePickerField } from '@/components/ui/date-picker-field';

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function unmount(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

async function flushUi() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe('DatePickerField', () => {
  it('renders a picker-only date field and emits yyyy-mm-dd values from the calendar', async () => {
    const onValueChange = vi.fn();
    const { container, root } = mount(
      <DatePickerField
        id="shared-date"
        value="2026-03-02"
        onValueChange={onValueChange}
      />,
    );

    try {
      expect(container.querySelector('input')).toBeNull();
      const trigger = container.querySelector('#shared-date') as HTMLButtonElement | null;
      expect(trigger?.tagName).toBe('BUTTON');
      expect(trigger?.textContent).toContain('Mar 2, 2026');

      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const dayFifteen = Array.from(document.body.querySelectorAll('button[name="day"]'))
        .find((button) => button.textContent?.trim() === '15' && !button.className.includes('day-outside')) as HTMLButtonElement | undefined;
      expect(dayFifteen).toBeTruthy();

      act(() => {
        dayFifteen?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(onValueChange).toHaveBeenCalledWith('2026-03-15');
    } finally {
      unmount(root, container);
    }
  });

  it('disables calendar dates before an explicit minimum', async () => {
    const { container, root } = mount(
      <DatePickerField
        id="future-date"
        value="2026-07-23"
        minDate="2026-07-23"
        onValueChange={vi.fn()}
      />,
    );

    try {
      act(() => {
        container.querySelector<HTMLButtonElement>('#future-date')?.click();
      });
      await flushUi();
      const dayTwentyTwo = Array.from(document.body.querySelectorAll<HTMLButtonElement>(
        'button[name="day"]',
      )).find((button) => button.textContent?.trim() === '22'
        && !button.className.includes('day-outside'));
      expect(dayTwentyTwo).toBeDisabled();
    } finally {
      unmount(root, container);
    }
  });

  it('clears inside the popover and restores focus to the trigger', async () => {
    const onValueChange = vi.fn();
    const { container, root } = mount(
      <DatePickerField
        id="clearable-date"
        value="2026-07-23"
        todayDate="2026-07-20"
        clearable
        onValueChange={onValueChange}
      />,
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>('#clearable-date');
      act(() => {
        trigger?.click();
      });
      await flushUi();
      const clear = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Clear');
      expect(clear).toBeTruthy();

      act(() => {
        clear?.click();
      });
      await flushUi();
      await flushUi();

      expect(onValueChange).toHaveBeenCalledWith('');
      expect(document.activeElement).toBe(trigger);
      expect(document.body.querySelector('[data-radix-popper-content-wrapper]')).toBeNull();
    } finally {
      unmount(root, container);
    }
  });
});

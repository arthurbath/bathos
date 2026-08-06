import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { Flag } from 'lucide-react';
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
  it('renders a pinned leading decoration while retaining its accessible name', () => {
    const { container, root } = mount(
      <DatePickerField
        id="decorated-date"
        aria-label="Deadline"
        value=""
        placeholder="Deadline"
        decoration={<Flag />}
        onValueChange={vi.fn()}
      />,
    );

    try {
      const trigger = container.querySelector('#decorated-date');
      const decoration = trigger?.querySelector('[data-control-decoration]');
      expect(trigger).toHaveAttribute('aria-label', 'Deadline');
      expect(trigger).toHaveTextContent('Deadline');
      expect(decoration).toHaveAttribute('aria-hidden', 'true');
      expect(decoration).toHaveClass('pointer-events-none', 'shrink-0');
      expect(decoration?.querySelector('svg')).toHaveClass('lucide-flag');
      const content = trigger?.querySelector('.min-w-0.flex-1.truncate');
      expect(trigger).toHaveClass('gap-2');
      expect(content).toBeTruthy();
      expect(content).not.toHaveClass('ml-2');
    } finally {
      unmount(root, container);
    }
  });

  it('closes on Tab and moves to the adjacent form control', async () => {
    const { container, root } = mount(
      <form>
        <button type="button" id="before-date">Before</button>
        <DatePickerField
          id="tab-exit-date"
          value="2026-03-02"
          onValueChange={vi.fn()}
        />
        <input id="after-date" />
      </form>,
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>('#tab-exit-date')!;
      act(() => {
        trigger.click();
      });
      await flushUi();

      const active = document.activeElement as HTMLElement;
      expect(active.getAttribute('name')).toBe('day');
      act(() => {
        active.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();
      await flushUi();

      expect(document.body.querySelector('[data-radix-popper-content-wrapper]')).toBeNull();
      expect(document.activeElement).toBe(container.querySelector('#after-date'));
    } finally {
      unmount(root, container);
    }
  });

  it('closes on Shift+Tab and moves to the preceding form control', async () => {
    const { container, root } = mount(
      <form>
        <button type="button" id="before-date">Before</button>
        <DatePickerField
          id="reverse-tab-exit-date"
          value="2026-03-02"
          onValueChange={vi.fn()}
        />
        <input id="after-date" />
      </form>,
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>('#reverse-tab-exit-date')!;
      act(() => {
        trigger.click();
      });
      await flushUi();

      const active = document.activeElement as HTMLElement;
      act(() => {
        active.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();
      await flushUi();

      expect(document.activeElement).toBe(container.querySelector('#before-date'));
    } finally {
      unmount(root, container);
    }
  });

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
      expect(trigger?.textContent).toContain('2026 Mar 2');
      expect(trigger).toHaveClass('text-sm');
      expect(trigger).not.toHaveClass('text-base');

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

  it('renders an optional controlled display value without changing the selected date', () => {
    const { container, root } = mount(
      <DatePickerField
        id="display-date"
        value="2026-03-02"
        displayValue="Tomorrow"
        onValueChange={vi.fn()}
      />,
    );

    try {
      expect(container.querySelector('#display-date')).toHaveTextContent('Tomorrow');
      expect(container.querySelector('#display-date')).not.toHaveTextContent('2026 Mar 2');
    } finally {
      unmount(root, container);
    }
  });

  it('keeps empty placeholder styling stable on hover without changing populated values', () => {
    const { container, root } = mount(
      <div>
        <DatePickerField
          id="empty-date"
          value=""
          placeholder="No Date"
          onValueChange={vi.fn()}
        />
        <DatePickerField
          id="populated-date"
          value="2026-03-02"
          onValueChange={vi.fn()}
        />
      </div>,
    );

    try {
      const empty = container.querySelector('#empty-date');
      const populated = container.querySelector('#populated-date');

      expect(empty).toHaveTextContent('No Date');
      expect(empty).toHaveClass('text-muted-foreground');
      expect(empty?.className).not.toContain('hover:');
      expect(populated).toHaveTextContent('2026 Mar 2');
      expect(populated).toHaveClass('text-foreground');
      expect(populated?.className).not.toContain('hover:');
    } finally {
      unmount(root, container);
    }
  });

  it.each([
    ['Space', ' '],
    ['Return', 'Enter'],
  ])('commits once, closes, and restores trigger focus when %s confirms a date', async (_label, key) => {
    const onValueChange = vi.fn();
    const { container, root } = mount(
      <DatePickerField
        id={`keyboard-confirm-date-${key === ' ' ? 'space' : 'return'}`}
        value="2026-03-02"
        onValueChange={onValueChange}
      />,
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>('button')!;
      act(() => {
        trigger.click();
      });
      await flushUi();

      const dayFifteen = Array.from(document.body.querySelectorAll<HTMLButtonElement>(
        'button[name="day"]',
      )).find((button) => (
        button.textContent?.trim() === '15'
        && !button.className.includes('day-outside')
      ));
      expect(dayFifteen).toBeTruthy();

      act(() => {
        dayFifteen?.focus();
        dayFifteen?.dispatchEvent(new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();
      await flushUi();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('2026-03-15');
      expect(document.body.querySelector('[data-radix-popper-content-wrapper]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it.each([
    ['pointer activation', null],
    ['Return', 'Enter'],
  ])('accepts the already-selected date with %s and closes the popover', async (_label, key) => {
    const onValueChange = vi.fn();
    const { container, root } = mount(
      <DatePickerField
        id={`reconfirm-date-${key ?? 'pointer'}`}
        value="2026-03-02"
        onValueChange={onValueChange}
      />,
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>('button')!;
      act(() => {
        trigger.click();
      });
      await flushUi();

      const selectedDay = document.body.querySelector<HTMLButtonElement>(
        'button[name="day"][aria-selected="true"]',
      );
      expect(selectedDay).toBeTruthy();

      act(() => {
        selectedDay?.focus();
        if (key) {
          selectedDay?.dispatchEvent(new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
          }));
        } else {
          selectedDay?.click();
        }
      });
      await flushUi();
      await flushUi();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('2026-03-02');
      expect(document.body.querySelector('[data-radix-popper-content-wrapper]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it('keeps the popover open when Return activates calendar navigation', async () => {
    const { container, root } = mount(
      <DatePickerField
        id="navigation-date"
        value="2026-03-02"
        onValueChange={vi.fn()}
      />,
    );

    try {
      act(() => {
        container.querySelector<HTMLButtonElement>('#navigation-date')?.click();
      });
      await flushUi();

      const caption = document.body.querySelector<HTMLButtonElement>(
        'button[name="caption-month-year"]',
      );
      act(() => {
        caption?.focus();
        caption?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }));
        caption?.click();
      });
      await flushUi();

      expect(document.body.querySelector('[data-radix-popper-content-wrapper]')).toBeTruthy();
      expect(document.body.querySelector('[data-calendar-month-picker="true"]')).toBeTruthy();
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

  it('disables dates rejected by a field-specific rule', async () => {
    const { container, root } = mount(
      <DatePickerField
        id="restricted-date"
        value="2026-07-23"
        isDateDisabled={(date) => date.getDate() !== 23}
        onValueChange={vi.fn()}
      />,
    );

    try {
      act(() => {
        container.querySelector<HTMLButtonElement>('#restricted-date')?.click();
      });
      await flushUi();
      const dayTwentyTwo = document.body.querySelector<HTMLButtonElement>(
        'button[name="day"][data-calendar-date="2026-07-22"]',
      );
      const dayTwentyThree = document.body.querySelector<HTMLButtonElement>(
        'button[name="day"][data-calendar-date="2026-07-23"]',
      );
      expect(dayTwentyTwo).toBeDisabled();
      expect(dayTwentyThree).toBeEnabled();
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
      expect(clear).toHaveAttribute('data-date-picker-clear');
      expect(clear).toHaveClass('h-9');

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

  it('clears an optional closed date with Delete', async () => {
    const onValueChange = vi.fn();
    const { container, root } = mount(
      <DatePickerField
        id="delete-clearable-date"
        value="2026-07-23"
        clearable
        onValueChange={onValueChange}
      />,
    );

    try {
      const trigger = container.querySelector<HTMLButtonElement>('#delete-clearable-date')!;
      act(() => {
        trigger.focus();
        trigger.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Delete',
          bubbles: true,
          cancelable: true,
        }));
      });
      expect(onValueChange).toHaveBeenCalledWith('');
      expect(document.activeElement).toBe(trigger);
    } finally {
      unmount(root, container);
    }
  });

  it('moves from the final date row to Clear without paging the visible month', async () => {
    const { container, root } = mount(
      <DatePickerField
        id="deadline-boundary"
        value="2026-07-31"
        minDate="2026-07-01"
        clearable
        onValueChange={vi.fn()}
      />,
    );

    try {
      act(() => {
        container.querySelector<HTMLButtonElement>('#deadline-boundary')?.click();
      });
      await flushUi();
      const finalVisibleDay = Array.from(document.body.querySelectorAll<HTMLButtonElement>(
        'button[name="day"]',
      )).find((button) => (
        button.textContent?.trim() === '7'
        && button.className.includes('day-outside')
      ));
      const clear = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent?.trim() === 'Clear');

      act(() => {
        finalVisibleDay?.focus();
        finalVisibleDay?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(document.activeElement).toBe(clear);
      expect(document.body.textContent).toContain('July 2026');
      expect(document.body.textContent).not.toContain('August 2026');
    } finally {
      unmount(root, container);
    }
  });
});

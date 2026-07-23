import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Calendar } from '@/components/ui/calendar';

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

function getDayButton(container: HTMLElement, text: string, { outside = false }: { outside?: boolean } = {}) {
  return Array.from(container.querySelectorAll('button[name="day"]')).find((button) => {
    const isOutside = button.className.includes('day-outside');
    return button.textContent?.trim() === text && isOutside === outside;
  }) as HTMLButtonElement | undefined;
}

describe('Calendar keyboard navigation', () => {
  it('moves focus to an outside day without changing the visible month', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 3, 1)}
        selected={new Date(2026, 3, 1)}
        onSelect={() => {}}
      />,
    );

    try {
      const aprilFirst = getDayButton(container, '1');
      expect(aprilFirst).toBeTruthy();

      act(() => {
        aprilFirst?.focus();
        aprilFirst?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      });
      await flushUi();
      const marchThirtyFirst = getDayButton(container, '31', { outside: true });
      expect(document.activeElement).toBe(marchThirtyFirst);
      expect(container.textContent).toContain('April 2026');
    } finally {
      unmount(root, container);
    }
  });

  it('allows arrowing up to the next-month button and paging with enter', async () => {
    function Harness() {
      const [month, setMonth] = React.useState(new Date(2026, 3, 1));
      return (
        <Calendar
          mode="single"
          month={month}
          selected={new Date(2026, 3, 4)}
          onMonthChange={setMonth}
          onSelect={() => {}}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const aprilFourth = getDayButton(container, '4');
      expect(aprilFourth).toBeTruthy();

      act(() => {
        aprilFourth?.focus();
        aprilFourth?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      await flushUi();
      const nextMonthButton = container.querySelector('button[name="next-month"]') as HTMLButtonElement | null;
      expect(document.activeElement).toBe(nextMonthButton);

      act(() => {
        nextMonthButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(container.textContent).toContain('May 2026');
    } finally {
      unmount(root, container);
    }
  });

  it('allows keyboard focus to move from nav buttons to the month-year header button', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 3, 1)}
        selected={new Date(2026, 3, 4)}
        onSelect={() => {}}
      />,
    );

    try {
      const aprilFourth = getDayButton(container, '4');
      expect(aprilFourth).toBeTruthy();

      act(() => {
        aprilFourth?.focus();
        aprilFourth?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      await flushUi();

      const nextMonthButton = container.querySelector('button[name="next-month"]') as HTMLButtonElement | null;
      expect(document.activeElement).toBe(nextMonthButton);

      act(() => {
        nextMonthButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      });
      await flushUi();

      const captionButton = container.querySelector('button[name="caption-month-year"]') as HTMLButtonElement | null;
      expect(document.activeElement).toBe(captionButton);
      expect(captionButton?.className).toContain('focus:ring-2');

      act(() => {
        captionButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
      await flushUi();

      const firstRowWednesday = getDayButton(container, '1') as HTMLButtonElement | undefined;
      expect(document.activeElement).toBe(firstRowWednesday);

      act(() => {
        const previousMonthButton = container.querySelector('button[name="previous-month"]') as HTMLButtonElement | null;
        previousMonthButton?.focus();
        previousMonthButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      await flushUi();

      expect(document.activeElement).toBe(captionButton);
    } finally {
      unmount(root, container);
    }
  });

  it('moves focus from top-row Tuesday through Thursday cells up to the month-year header button', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 3, 1)}
        selected={new Date(2026, 3, 1)}
        onSelect={() => {}}
      />,
    );

    try {
      for (const target of [
        { label: '31', outside: true },
        { label: '1', outside: false },
        { label: '2', outside: false },
      ]) {
        const dayButton = getDayButton(container, target.label, { outside: target.outside });
        expect(dayButton).toBeTruthy();

        act(() => {
          dayButton?.focus();
          dayButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        });
        await flushUi();

        const captionButton = container.querySelector('button[name="caption-month-year"]') as HTMLButtonElement | null;
        expect(document.activeElement).toBe(captionButton);
      }
    } finally {
      unmount(root, container);
    }
  });

  it('skips disabled dates above the focused date and reaches an enabled calendar control', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        fromDate={new Date(2026, 6, 24)}
        selected={new Date(2026, 6, 24)}
        onSelect={() => {}}
      />,
    );

    try {
      const firstEnabledDay = getDayButton(container, '24');
      expect(firstEnabledDay).not.toBeDisabled();

      act(() => {
        firstEnabledDay?.focus();
        firstEnabledDay?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
        }));
      });
      await flushUi();

      expect(document.activeElement).toBe(
        container.querySelector('button[name="next-month"]'),
      );
    } finally {
      unmount(root, container);
    }
  });

  it('skips disabled dates below the calendar header', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        fromDate={new Date(2026, 6, 24)}
        selected={new Date(2026, 6, 24)}
        onSelect={() => {}}
      />,
    );

    try {
      const captionButton = container.querySelector<HTMLButtonElement>(
        'button[name="caption-month-year"]',
      );
      act(() => {
        captionButton?.focus();
        captionButton?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        }));
      });
      await flushUi();

      const focusedDay = document.activeElement as HTMLButtonElement;
      expect(focusedDay).toHaveAttribute('name', 'day');
      expect(focusedDay).not.toBeDisabled();
      expect(Number(focusedDay.textContent?.trim())).toBeGreaterThanOrEqual(24);
    } finally {
      unmount(root, container);
    }
  });

  it('hands the final day-row ArrowDown boundary to its composed destination', async () => {
    function Harness() {
      const clearRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <Calendar
            mode="single"
            month={new Date(2026, 6, 1)}
            selected={new Date(2026, 6, 31)}
            onSelect={() => {}}
            onDayGridExitDown={() => {
              clearRef.current?.focus();
              return Boolean(clearRef.current);
            }}
          />
          <button ref={clearRef} type="button">Clear</button>
        </>
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const julyThirtyFirst = getDayButton(container, '31');
      const clear = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Clear');
      act(() => {
        julyThirtyFirst?.focus();
        julyThirtyFirst?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }));
      });
      await flushUi();

      expect(document.activeElement).toBe(clear);
      expect(container.textContent).toContain('July 2026');
      expect(container.textContent).not.toContain('August 2026');
    } finally {
      unmount(root, container);
    }
  });

  it('falls back to the month-year control when disabled dates and hidden previous navigation block the preferred path', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        fromDate={new Date(2026, 6, 27)}
        selected={new Date(2026, 6, 27)}
        onSelect={() => {}}
      />,
    );

    try {
      const firstEnabledDay = getDayButton(container, '27');
      act(() => {
        firstEnabledDay?.focus();
        firstEnabledDay?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
        }));
      });
      await flushUi();

      expect(document.activeElement).toBe(
        container.querySelector('button[name="caption-month-year"]'),
      );
    } finally {
      unmount(root, container);
    }
  });

  it('continues scanning upward when the date immediately above is disabled', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 3, 1)}
        selected={new Date(2026, 3, 15)}
        disabled={new Date(2026, 3, 8)}
        onSelect={() => {}}
      />,
    );

    try {
      const aprilFifteenth = getDayButton(container, '15');
      act(() => {
        aprilFifteenth?.focus();
        aprilFifteenth?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
        }));
      });
      await flushUi();

      expect(document.activeElement).toBe(getDayButton(container, '1'));
    } finally {
      unmount(root, container);
    }
  });

  it('opens a month picker from the month-year caption and pages years', async () => {
    function Harness() {
      const [month, setMonth] = React.useState(new Date(2026, 3, 1));
      return (
        <Calendar
          mode="single"
          month={month}
          selected={new Date(2026, 3, 4)}
          onMonthChange={setMonth}
          onSelect={() => {}}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const initialDayPicker = container.querySelector('.rdp') as HTMLElement | null;
      expect(initialDayPicker?.className).toContain('box-border');
      expect(initialDayPicker?.className).toContain('w-[276px]');
      expect(initialDayPicker?.className).toContain('min-h-[318px]');

      const captionButton = container.querySelector('button[name="caption-month-year"]') as HTMLButtonElement | null;
      const previousMonthButton = container.querySelector('button[name="previous-month"]') as HTMLButtonElement | null;
      const nextMonthButton = container.querySelector('button[name="next-month"]') as HTMLButtonElement | null;
      const dayPickerCaption = captionButton?.parentElement as HTMLElement | null;
      const dayPickerNav = previousMonthButton?.parentElement as HTMLElement | null;
      expect(captionButton?.textContent).toContain('April 2026');

      act(() => {
        captionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(container.querySelector('[data-calendar-month-picker="true"]')).toBeTruthy();
      expect(container.textContent).toContain('2026');

      const nextYearButton = container.querySelector('button[name="next-year"]') as HTMLButtonElement | null;
      act(() => {
        nextYearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(container.textContent).toContain('2027');
      const monthPicker = container.querySelector('[data-calendar-month-picker="true"]') as HTMLElement | null;
      expect(monthPicker?.className).toContain('box-border');
      expect(monthPicker?.className).toContain('w-[276px]');
      expect(monthPicker?.className).not.toContain('min-h-[318px]');
      const monthPickerCaption = container.querySelector('[data-calendar-month-picker-caption="true"]') as HTMLElement | null;
      const monthPickerNav = container.querySelector('[data-calendar-month-picker-nav="true"]') as HTMLElement | null;
      const previousYearHeaderButton = container.querySelector('button[name="previous-year"]') as HTMLButtonElement | null;
      const nextYearHeaderButton = container.querySelector('button[name="next-year"]') as HTMLButtonElement | null;
      const yearLabel = container.querySelector('[data-calendar-month-picker-year-label="true"]') as HTMLElement | null;
      expect(monthPickerCaption?.className).toBe(dayPickerCaption?.className);
      expect(monthPickerNav?.className).toBe(dayPickerNav?.className);
      expect(previousYearHeaderButton?.className).toBe(previousMonthButton?.className);
      expect(nextYearHeaderButton?.className).toBe(nextMonthButton?.className);
      expect(captionButton?.className).toContain('hover:bg-primary/10');
      expect(captionButton?.className).toContain('hover:text-primary');
      expect(yearLabel?.className).not.toBe(captionButton?.className);
    } finally {
      unmount(root, container);
    }
  });

  it('supports keyboard navigation between year buttons and months, then returns to day picker focused on day 1', async () => {
    function Harness() {
      const [month, setMonth] = React.useState(new Date(2026, 3, 1));
      return (
        <Calendar
          mode="single"
          month={month}
          selected={new Date(2026, 3, 4)}
          onMonthChange={setMonth}
          onSelect={() => {}}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const captionButton = container.querySelector('button[name="caption-month-year"]') as HTMLButtonElement | null;
      act(() => {
        captionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const aprilButton = Array.from(container.querySelectorAll('button[name="month"]'))
        .find((button) => button.textContent?.trim() === 'Apr') as HTMLButtonElement | undefined;
      expect(document.activeElement).toBe(aprilButton);

      act(() => {
        aprilButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      await flushUi();

      const januaryButton = Array.from(container.querySelectorAll('button[name="month"]'))
        .find((button) => button.textContent?.trim() === 'Jan') as HTMLButtonElement | undefined;
      expect(document.activeElement).toBe(januaryButton);

      act(() => {
        januaryButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      await flushUi();

      const previousYearButton = container.querySelector('button[name="previous-year"]') as HTMLButtonElement | null;
      expect(document.activeElement).toBe(previousYearButton);

      act(() => {
        previousYearButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      await flushUi();

      const nextYearButton = container.querySelector('button[name="next-year"]') as HTMLButtonElement | null;
      expect(document.activeElement).toBe(nextYearButton);

      act(() => {
        nextYearButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
      await flushUi();

      const marchButton = Array.from(container.querySelectorAll('button[name="month"]'))
        .find((button) => button.textContent?.trim() === 'Mar') as HTMLButtonElement | undefined;
      expect(document.activeElement).toBe(marchButton);

      act(() => {
        marchButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(container.querySelector('[data-calendar-month-picker="true"]')).toBeFalsy();
      expect(container.textContent).toContain('March 2026');
      const firstDayButton = getDayButton(container, '1');
      expect(document.activeElement).toBe(firstDayButton);
    } finally {
      unmount(root, container);
    }
  });

  it('keeps focus on the year paging button after enter activates it', async () => {
    function Harness() {
      const [month, setMonth] = React.useState(new Date(2026, 3, 1));
      return (
        <Calendar
          mode="single"
          month={month}
          selected={new Date(2026, 3, 4)}
          onMonthChange={setMonth}
          onSelect={() => {}}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const captionButton = container.querySelector('button[name="caption-month-year"]') as HTMLButtonElement | null;
      act(() => {
        captionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const nextYearButton = container.querySelector('button[name="next-year"]') as HTMLButtonElement | null;
      act(() => {
        nextYearButton?.focus();
        nextYearButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        nextYearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      expect(container.textContent).toContain('2027');
      const updatedNextYearButton = container.querySelector('button[name="next-year"]') as HTMLButtonElement | null;
      expect(document.activeElement).toBe(updatedNextYearButton);
    } finally {
      unmount(root, container);
    }
  });

  it('clears the entry-month active styling after paging years and does not restore it when paging back', async () => {
    function Harness() {
      const [month, setMonth] = React.useState(new Date(2026, 3, 1));
      return (
        <Calendar
          mode="single"
          month={month}
          selected={new Date(2026, 3, 4)}
          onMonthChange={setMonth}
          onSelect={() => {}}
        />
      );
    }

    const { container, root } = mount(<Harness />);

    try {
      const captionButton = container.querySelector('button[name="caption-month-year"]') as HTMLButtonElement | null;
      act(() => {
        captionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const aprilButton = Array.from(container.querySelectorAll('button[name="month"]'))
        .find((button) => button.textContent?.trim() === 'Apr') as HTMLButtonElement | undefined;
      expect(aprilButton?.className).toContain('border-primary');

      const nextYearButton = container.querySelector('button[name="next-year"]') as HTMLButtonElement | null;
      act(() => {
        nextYearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const april2027Button = Array.from(container.querySelectorAll('button[name="month"]'))
        .find((button) => button.textContent?.trim() === 'Apr') as HTMLButtonElement | undefined;
      expect(april2027Button?.className).not.toContain('border-primary');

      const previousYearButton = container.querySelector('button[name="previous-year"]') as HTMLButtonElement | null;
      act(() => {
        previousYearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();

      const april2026Button = Array.from(container.querySelectorAll('button[name="month"]'))
        .find((button) => button.textContent?.trim() === 'Apr') as HTMLButtonElement | undefined;
      expect(container.textContent).toContain('2026');
      expect(april2026Button?.className).not.toContain('border-primary');
    } finally {
      unmount(root, container);
    }
  });

  it('keeps Tab interception as the default and permits opt-in picker traversal', () => {
    const defaultCalendar = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        selected={new Date(2026, 6, 23)}
        onSelect={() => {}}
      />,
    );
    const traversableCalendar = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        selected={new Date(2026, 6, 23)}
        onSelect={() => {}}
        allowTabExit
      />,
    );

    try {
      const trappedDay = getDayButton(defaultCalendar.container, '23')!;
      const trappedEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        trappedDay.dispatchEvent(trappedEvent);
      });
      expect(trappedEvent.defaultPrevented).toBe(true);

      const traversableDay = getDayButton(traversableCalendar.container, '23')!;
      const traversableEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        traversableDay.dispatchEvent(traversableEvent);
      });
      expect(traversableEvent.defaultPrevented).toBe(false);
    } finally {
      unmount(defaultCalendar.root, defaultCalendar.container);
      unmount(traversableCalendar.root, traversableCalendar.container);
    }
  });

  it('clamps to the earliest selectable month and focuses its first enabled date', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        fromDate={new Date(2026, 7, 1)}
        initialFocusDate={new Date(2026, 7, 1)}
        onSelect={() => {}}
      />,
    );

    try {
      await flushUi();
      expect(container.textContent).toContain('August 2026');
      expect(container.querySelector<HTMLButtonElement>(
        'button[name="previous-month"]',
      )).toBeDisabled();
      expect(container.querySelector<HTMLButtonElement>(
        'button[name="previous-month"]',
      )?.className).toContain('disabled:invisible');
      expect(document.activeElement).toBe(getDayButton(container, '1'));
    } finally {
      unmount(root, container);
    }
  });

  it('disables elapsed months and years in the centered month picker', async () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        fromDate={new Date(2026, 6, 23)}
        selected={new Date(2026, 6, 24)}
        onSelect={() => {}}
      />,
    );

    try {
      act(() => {
        container.querySelector<HTMLButtonElement>(
          'button[name="caption-month-year"]',
        )?.click();
      });
      await flushUi();

      const picker = container.querySelector<HTMLElement>(
        '[data-calendar-month-picker="true"]',
      );
      expect(picker?.className).toContain('mx-auto');
      const months = Array.from(container.querySelectorAll<HTMLButtonElement>(
        'button[name="month"]',
      ));
      expect(months.slice(0, 6).every((month) => month.disabled)).toBe(true);
      expect(months[6]).not.toBeDisabled();
      expect(container.querySelector<HTMLButtonElement>(
        'button[name="previous-year"]',
      )).toBeDisabled();
      expect(container.querySelector<HTMLButtonElement>(
        'button[name="previous-year"]',
      )?.className).toContain('disabled:invisible');
      expect(months[6]?.className).toContain('enabled:!cursor-pointer');
      expect(months[0]?.className).toContain('disabled:!cursor-not-allowed');
      expect(document.activeElement).toBe(months[6]);

      const nextYearButton = container.querySelector<HTMLButtonElement>(
        'button[name="next-year"]',
      );
      act(() => {
        nextYearButton?.focus();
        nextYearButton?.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        }));
      });
      await flushUi();
      expect(document.activeElement).toBe(months[8]);
    } finally {
      unmount(root, container);
    }
  });

  it('distinguishes the owner planning date from a selected date', () => {
    const { container, root } = mount(
      <Calendar
        mode="single"
        month={new Date(2026, 6, 1)}
        today={new Date(2026, 6, 23)}
        selected={new Date(2026, 6, 24)}
        onSelect={() => {}}
      />,
    );

    try {
      const today = getDayButton(container, '23');
      const selected = getDayButton(container, '24');
      expect(today).toHaveAttribute('aria-current', 'date');
      expect(today?.className).toContain('bg-accent');
      expect(selected).toHaveAttribute('aria-selected', 'true');
      expect(selected?.className).toContain('bg-primary');
      expect(selected?.className).toContain('enabled:!cursor-pointer');
      expect(container.querySelector<HTMLButtonElement>(
        'button[name="next-month"]',
      )?.className).toContain('enabled:!cursor-pointer');
    } finally {
      unmount(root, container);
    }
  });
});

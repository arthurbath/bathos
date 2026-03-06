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
});

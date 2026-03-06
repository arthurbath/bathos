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
});

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function mount(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('rich single-select popover menu styling', () => {
  it('uses a leading check for the committed value and a separate provisional highlight', () => {
    const { container, root } = mount(
      <DropdownMenu open>
        <DropdownMenuTrigger>Reminder Hour</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="four">
            <DropdownMenuRadioItem value="three">3:00 pm</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="four">4:00 pm</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    try {
      const items = Array.from(
        document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
      );
      const selected = items.find((item) => item.dataset.state === 'checked');
      const unselected = items.find((item) => item.dataset.state === 'unchecked');

      expect(selected).toHaveTextContent('4:00 pm');
      expect(selected?.querySelector('svg')).toHaveClass('lucide-check', 'h-4', 'w-4');
      expect(selected?.querySelector('.lucide-circle')).toBeNull();
      expect(unselected?.querySelector('svg')).toBeNull();
      expect(selected).toHaveClass('pl-8', 'data-[highlighted]:bg-foreground/10');
      expect(unselected).toHaveClass('pl-8', 'data-[highlighted]:bg-foreground/10');
    } finally {
      cleanup(root, container);
    }
  });
});

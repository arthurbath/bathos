import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Link2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/input';

describe('Input decoration contract', () => {
  it('reserves leading content space without changing the input accessible name', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <Input
            aria-label="Primary Link"
            placeholder="Primary Link"
            decoration={<Link2 />}
          />,
        );
      });

      const input = container.querySelector('input');
      const decoration = container.querySelector('[data-control-decoration]');
      expect(input).toHaveAttribute('aria-label', 'Primary Link');
      expect(input).toHaveAttribute('placeholder', 'Primary Link');
      expect(input).toHaveClass('pl-9');
      expect(decoration).toHaveAttribute('aria-hidden', 'true');
      expect(decoration).toHaveClass('pointer-events-none', 'absolute');
      expect(decoration?.querySelector('svg')).toHaveClass('lucide-link-2');
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('preserves the existing input structure when no decoration is supplied', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(<Input aria-label="Summary" />);
      });

      expect(container.firstElementChild?.tagName).toBe('INPUT');
      expect(container.querySelector('[data-decorated-control]')).toBeNull();
      expect(container.querySelector('input')).not.toHaveClass('pl-9');
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Switch } from './switch';

describe('Switch', () => {
  it('balances the thumb inset in unchecked and checked states', () => {
    const { rerender } = render(<Switch aria-label="Feature" checked={false} />);
    const thumb = screen.getByRole('switch', { name: 'Feature' }).firstElementChild;

    expect(thumb).toHaveClass('data-[state=unchecked]:translate-x-px');
    expect(thumb).toHaveClass('data-[state=checked]:translate-x-[21px]');

    rerender(<Switch aria-label="Feature" checked />);
    expect(screen.getByRole('switch', { name: 'Feature' }).firstElementChild)
      .toBe(thumb);
  });
});

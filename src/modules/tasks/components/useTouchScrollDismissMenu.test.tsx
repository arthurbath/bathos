import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useTouchScrollDismissMenu } from './useTouchScrollDismissMenu';

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const [open, setOpen] = useState(true);
  const handlePointerDown = useTouchScrollDismissMenu(() => {
    onDismiss();
    setOpen(false);
  });
  return (
    <>
      <button type="button" onPointerDown={handlePointerDown}>Actions</button>
      {open ? <div>Menu</div> : null}
    </>
  );
}

describe('useTouchScrollDismissMenu', () => {
  function dispatchPointer(
    target: Element | Document,
    type: string,
    properties: Record<string, unknown>,
  ) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, { value }]),
    ));
    fireEvent(target, event);
    return event;
  }

  it('dismisses after predominantly vertical touch movement without preventing scrolling', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const actions = screen.getByRole('button', { name: 'Actions' });

    dispatchPointer(actions, 'pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40,
    });
    const moveEvent = dispatchPointer(document, 'pointermove', {
      pointerId: 7,
      clientX: 42,
      clientY: 58,
    });

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    expect(moveEvent.defaultPrevented).toBe(false);
  });

  it('does not dismiss an unmoved touch tap', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const actions = screen.getByRole('button', { name: 'Actions' });

    dispatchPointer(actions, 'pointerdown', {
      pointerId: 8,
      pointerType: 'touch',
      clientX: 40,
      clientY: 40,
    });
    dispatchPointer(document, 'pointerup', { pointerId: 8 });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('Menu')).toBeInTheDocument();
  });
});

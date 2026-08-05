import React, { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TaskImmediateDragHandle,
} from './TaskImmediateDragHandle';
import { useTaskImmediateDragTarget } from './TaskImmediateDragTarget';

function Harness({
  onStart,
  onTarget,
  onDrop,
  onCancel,
}: {
  onStart: () => void;
  onTarget: () => void;
  onDrop: () => void;
  onCancel: () => void;
}) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  useTaskImmediateDragTarget('test-scope', targetRef, onTarget);
  return (
    <>
      <div ref={sourceRef}>Task</div>
      <div ref={targetRef} data-testid="target">Target</div>
      <TaskImmediateDragHandle
        label="Reorder Task"
        scope="test-scope"
        previewRef={sourceRef}
        onStart={onStart}
        onDrop={onDrop}
        onCancel={onCancel}
      />
    </>
  );
}

function dispatchPointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  values: { pointerId: number; clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: values.clientX,
    clientY: values.clientY,
  });
  Object.defineProperties(event, {
    pointerId: { value: values.pointerId },
    pointerType: { value: 'touch' },
    isPrimary: { value: true },
  });
  fireEvent(target, event);
}

describe('TaskImmediateDragHandle', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => []),
    });
  });

  it('starts immediately and keeps scroll suppression scoped to the handle', () => {
    const onStart = vi.fn();
    const result = render(
      <Harness
        onStart={onStart}
        onTarget={vi.fn()}
        onDrop={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const handle = result.getByRole('button', { name: 'Reorder Task' });
    expect(handle).toHaveClass('touch-none');
    dispatchPointer(handle, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(result.getByTestId('target')).not.toHaveClass('touch-none');
  });

  it('targets and commits after movement without a hold delay', () => {
    const onTarget = vi.fn();
    const onDrop = vi.fn();
    const result = render(
      <Harness
        onStart={vi.fn()}
        onTarget={onTarget}
        onDrop={onDrop}
        onCancel={vi.fn()}
      />,
    );
    const handle = result.getByRole('button', { name: 'Reorder Task' });
    const target = result.getByTestId('target');
    vi.mocked(document.elementsFromPoint).mockReturnValue([target]);
    dispatchPointer(handle, 'pointerdown', { pointerId: 2, clientX: 10, clientY: 10 });
    dispatchPointer(handle, 'pointermove', { pointerId: 2, clientX: 10, clientY: 20 });
    dispatchPointer(handle, 'pointerup', { pointerId: 2, clientX: 10, clientY: 20 });
    expect(onTarget).toHaveBeenCalled();
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});

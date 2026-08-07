import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import {
  isMobileTouchViewport,
  useIsMobileTouchViewport,
  useModalViewportStyle,
} from '@/components/ui/modal-viewport';

function Probe() {
  const mobileTouch = useIsMobileTouchViewport();
  const viewportStyle = useModalViewportStyle();
  return (
    <div
      data-mobile-touch={mobileTouch ? 'true' : 'false'}
      data-height={viewportStyle['--bathos-modal-vv-height']}
      data-top={viewportStyle['--bathos-modal-vv-top']}
      data-center={viewportStyle['--bathos-modal-vv-center']}
    />
  );
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Probe />));
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('modal viewport helpers', () => {
  it('requires both touch capability and a mobile-width viewport', () => {
    const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const maxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'maxTouchPoints',
    );

    try {
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        configurable: true,
        value: 5,
      });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      expect(isMobileTouchViewport()).toBe(true);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      expect(isMobileTouchViewport()).toBe(false);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        configurable: true,
        value: 0,
      });
      expect(isMobileTouchViewport()).toBe(false);
    } finally {
      if (innerWidthDescriptor) Object.defineProperty(window, 'innerWidth', innerWidthDescriptor);
      else Reflect.deleteProperty(window, 'innerWidth');
      if (maxTouchPointsDescriptor) {
        Object.defineProperty(window.navigator, 'maxTouchPoints', maxTouchPointsDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
      }
    }
  });

  it('reacts to width changes and tracks the current visual viewport center', () => {
    const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const maxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
      window.navigator,
      'maxTouchPoints',
    );
    const visualViewportDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 500 },
      offsetTop: { configurable: true, value: 20 },
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    });
    const { container, root } = mount();

    try {
      const probe = container.firstElementChild;
      expect(probe).toHaveAttribute('data-mobile-touch', 'true');
      expect(probe).toHaveAttribute('data-height', '500px');
      expect(probe).toHaveAttribute('data-top', '20px');
      expect(probe).toHaveAttribute('data-center', '270px');

      act(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });
        window.dispatchEvent(new Event('resize'));
      });
      expect(probe).toHaveAttribute('data-mobile-touch', 'false');
    } finally {
      cleanup(root, container);
      if (innerWidthDescriptor) Object.defineProperty(window, 'innerWidth', innerWidthDescriptor);
      else Reflect.deleteProperty(window, 'innerWidth');
      if (maxTouchPointsDescriptor) {
        Object.defineProperty(window.navigator, 'maxTouchPoints', maxTouchPointsDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
      }
      if (visualViewportDescriptor) {
        Object.defineProperty(window, 'visualViewport', visualViewportDescriptor);
      } else {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    }
  });
});

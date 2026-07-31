import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { PersistentTooltipText, TooltipProvider } from '@/components/ui/tooltip';

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

function tooltipText() {
  return document.body.querySelector('[role="tooltip"]')?.textContent ?? '';
}

function tooltipContentElement() {
  return document.body.querySelector('[data-side][data-align]') as HTMLElement | null;
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('PersistentTooltipText', () => {
  it('does not disclose content on hover', async () => {
    const { container, root } = mount(
      <TooltipProvider>
        <PersistentTooltipText content="Help text">Monthly Settlement</PersistentTooltipText>
        <button type="button">Outside</button>
      </TooltipProvider>,
    );
    const trigger = container.querySelector('span[role="button"]');
    expect(trigger).toBeTruthy();

    try {
      act(() => {
        trigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
      await flushUi();
      expect(tooltipText()).toBe('');

    } finally {
      unmount(root, container);
    }
  });

  it('remains open on repeated clicks and closes on outside click', async () => {
    const { container, root } = mount(
      <TooltipProvider>
        <PersistentTooltipText content="Help text">Monthly Settlement</PersistentTooltipText>
        <button type="button">Outside</button>
      </TooltipProvider>,
    );
    const trigger = container.querySelector('span[role="button"]');
    const outsideButton = container.querySelector('button');
    expect(trigger).toBeTruthy();
    expect(outsideButton).toBeTruthy();

    try {
      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();
      expect(tooltipText()).toContain('Help text');

      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();
      expect(tooltipText()).toContain('Help text');

      act(() => {
        outsideButton?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      await flushUi();
      expect(tooltipText()).toBe('');
    } finally {
      unmount(root, container);
    }
  });

  it('applies viewport-aware width clamping to tooltip content', async () => {
    const { container, root } = mount(
      <TooltipProvider>
        <PersistentTooltipText content="A somewhat longer help message">Monthly Settlement</PersistentTooltipText>
      </TooltipProvider>,
    );
    const trigger = container.querySelector('span[role="button"]');
    expect(trigger).toBeTruthy();

    try {
      act(() => {
        trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushUi();
      const tooltipContent = tooltipContentElement();
      expect(tooltipContent).toBeTruthy();
      expect(tooltipContent?.style.maxWidth).toContain('100vw');
      expect(tooltipContent?.style.maxWidth).toContain('1rem');
    } finally {
      unmount(root, container);
    }
  });
});

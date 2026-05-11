import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WardrobeItemsGrid } from '@/modules/wardrobe/components/WardrobeItemsGrid';
import type { WardrobeItem, WardrobeItemInput } from '@/modules/wardrobe/types/wardrobe';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const sampleItem: WardrobeItem = {
  id: 'item-1',
  user_id: 'user-1',
  name: 'T-shirt',
  category: 'tops',
  brand: 'Express',
  model: 'V-neck Perfect Pima Cotton T-Shirt',
  color: 'Black',
  size: 'S',
  link_url: 'https://example.com/shirt',
  status: 'active',
  notes: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

interface RenderGridOptions {
  items?: WardrobeItem[];
  onAddItem?: (input: WardrobeItemInput, id?: string) => Promise<WardrobeItem>;
}

function renderGrid(options: RenderGridOptions = {}) {
  const { items = [sampleItem], onAddItem = vi.fn() } = options;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <WardrobeItemsGrid
        userId="user-1"
        items={items}
        loading={false}
        onAddItem={onAddItem}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        fullView={false}
      />,
    );
  });

  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('WardrobeItemsGrid', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders unfiltered and ungrouped desktop controls by default', () => {
    const { container, root } = renderGrid();

    try {
      expect(container.textContent).toContain('Items');
      expect(container.querySelector<HTMLInputElement>('input[placeholder="Item Name"]')).toBeTruthy();
      expect(container.textContent).toContain('All Statuses');
      expect(container.textContent).toContain('No Grouping');
      const inputValues = Array.from(container.querySelectorAll<HTMLInputElement>('input')).map((input) => input.value);
      expect(inputValues).toContain('T-shirt');
      expect(inputValues).toContain('Express');
    } finally {
      cleanup(root, container);
    }
  });

  it('can suppress the full-view top border for single-view module shells', () => {
    const { container, root } = renderGrid();

    try {
      act(() => {
        root.render(
          <WardrobeItemsGrid
            userId="user-1"
            items={[sampleItem]}
            loading={false}
            onAddItem={vi.fn()}
            onUpdateItem={vi.fn()}
            onDeleteItem={vi.fn()}
            fullView
            fullViewTopBorder={false}
          />,
        );
      });

      const card = container.firstElementChild as HTMLElement | null;
      expect(card).toHaveClass('md:border-t-0');
      expect(card).not.toHaveClass('md:border-t');
    } finally {
      cleanup(root, container);
    }
  });

  it('duplicates a row from the row actions menu', async () => {
    const onAddItem = vi.fn().mockResolvedValue({ ...sampleItem, id: 'item-copy' });
    const { container, root } = renderGrid({ onAddItem });

    try {
      const actionsButton = container.querySelector<HTMLButtonElement>('button[aria-label="Actions for T-shirt"]');
      expect(actionsButton).toBeTruthy();

      await act(async () => {
        actionsButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        actionsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const duplicateMenuItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((element) => element.textContent?.includes('Duplicate'));
      expect(duplicateMenuItem).toBeTruthy();

      await act(async () => {
        duplicateMenuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onAddItem).toHaveBeenCalledWith({
        name: sampleItem.name,
        category: sampleItem.category,
        brand: sampleItem.brand,
        model: sampleItem.model,
        color: sampleItem.color,
        size: sampleItem.size,
        link_url: sampleItem.link_url,
        status: sampleItem.status,
        notes: sampleItem.notes,
      }, expect.any(String));
    } finally {
      cleanup(root, container);
    }
  });
});

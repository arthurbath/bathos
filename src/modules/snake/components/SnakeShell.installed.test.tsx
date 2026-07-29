import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnakeShell } from '@/modules/snake/components/SnakeShell';

vi.mock('@/platform/components/ToplineHeader', () => ({
  ToplineHeader: () => <header data-testid="topline-header" />,
}));
vi.mock('@/platform/components/MobileBottomNav', () => ({
  MobileBottomNav: () => <nav data-testid="mobile-nav" />,
}));
vi.mock('@/platform/components/InstalledAppAccountCard', () => ({
  InstalledAppAccountCard: () => null,
}));
vi.mock('@/platform/hooks/useHostModule', () => ({
  useModuleBasePath: () => '/snake',
}));
vi.mock('@/modules/snake/hooks/useSnakeData', () => ({
  useSnakeData: () => ({
    snakes: [
      { id: 'snake-1', name: 'Babs', is_active: true },
      { id: 'snake-2', name: 'Friend', is_active: false },
    ],
    activeSnake: { id: 'snake-1', name: 'Babs', is_active: true },
    expectationRanges: [],
    loading: false,
    addSnake: vi.fn(),
    updateSnake: vi.fn(async () => ({})),
    removeSnake: vi.fn(),
  }),
  useSnakeWeightRecords: () => ({
    records: [],
    loading: false,
    addWeightRecord: vi.fn(),
    updateWeightRecord: vi.fn(),
    removeWeightRecord: vi.fn(),
  }),
}));
vi.mock('@/modules/snake/components/SnakeWeightRecordsGrid', () => ({
  SnakeWeightRecordsGrid: () => <div data-testid="weights-view" />,
}));
vi.mock('@/modules/snake/components/SnakeConfigView', () => ({
  SnakeConfigView: () => null,
}));

function setStandaloneMode(enabled: boolean) {
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: enabled,
  });
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/snake/weights']}>
        <SnakeShell
          household={{ householdId: 'household-1' } as never}
          userId="user-1"
          userEmail="art@example.test"
          displayName="Art"
          onSignOut={vi.fn()}
          householdMembers={[]}
          householdMembersLoading={false}
          householdMembersError={null}
          pendingHouseholdMemberId={null}
          rotatingHouseholdInviteCode={false}
          leavingHousehold={false}
          deletingHousehold={false}
          onRotateHouseholdInviteCode={vi.fn()}
          onRemoveHouseholdMember={vi.fn()}
          onLeaveHousehold={vi.fn()}
          onDeleteHousehold={vi.fn()}
        />
      </MemoryRouter>,
    );
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('SnakeShell installed selector', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setStandaloneMode(false);
  });

  it('moves the snake selector into the page body only while installed', () => {
    setStandaloneMode(true);
    const installed = mount();
    try {
      expect(installed.container.querySelector('[role="combobox"][aria-label="Active Snake"]')).toBeTruthy();
    } finally {
      cleanup(installed.root, installed.container);
    }

    setStandaloneMode(false);
    const browser = mount();
    try {
      expect(browser.container.querySelector('[role="combobox"][aria-label="Active Snake"]')).toBeNull();
    } finally {
      cleanup(browser.root, browser.container);
    }
  });
});

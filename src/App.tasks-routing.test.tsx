import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_ROUTER_FUTURE } from '@/platform/routingCompatibility';
import { AppRoutes } from './App';

const mockTasksLifecycle = vi.hoisted(() => ({ mounts: 0, cleanups: 0 }));

vi.mock('@/modules/tasks/TasksIndex', async () => {
  const ReactModule = await import('react');
  const Router = await import('react-router-dom');

  return {
    default: function MockTasksIndex() {
      const location = Router.useLocation();

      ReactModule.useEffect(() => {
        mockTasksLifecycle.mounts += 1;
        return () => {
          mockTasksLifecycle.cleanups += 1;
        };
      }, []);

      return ReactModule.createElement(
        'main',
        { 'data-testid': 'tasks-index', 'data-pathname': location.pathname },
        ReactModule.createElement(Router.Link, { to: '/tasks/inbox' }, 'Inbox'),
        ReactModule.createElement(Router.Link, { to: '/tasks/projects/project-a' }, 'Project'),
        ReactModule.createElement(Router.Link, { to: '/tasks/areas/area-a' }, 'Area'),
        ReactModule.createElement(Router.Link, { to: '/tasks/unknown' }, 'Unknown'),
      );
    },
  };
});

async function renderRoutes(initialPath: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]} future={BROWSER_ROUTER_FUTURE}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await Promise.resolve();
  });

  await vi.waitFor(() => {
    expect(container.querySelector('[data-testid="tasks-index"]')).toBeTruthy();
  });

  return { container, root };
}

async function followLink(container: HTMLElement, label: string) {
  const link = Array.from(container.querySelectorAll('a'))
    .find((candidate) => candidate.textContent === label);
  expect(link).toBeTruthy();
  await act(async () => {
    link?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    }));
    await Promise.resolve();
  });
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => root.unmount());
  container.remove();
}

describe('Tasks route runtime boundary', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it('keeps one Tasks subtree mounted across planning and hierarchy routes', async () => {
    mockTasksLifecycle.mounts = 0;
    mockTasksLifecycle.cleanups = 0;
    const { container, root } = await renderRoutes('/tasks/today');

    try {
      expect(mockTasksLifecycle).toEqual({ mounts: 1, cleanups: 0 });

      await followLink(container, 'Inbox');
      expect(container.querySelector('[data-testid="tasks-index"]'))
        .toHaveAttribute('data-pathname', '/tasks/inbox');
      expect(mockTasksLifecycle).toEqual({ mounts: 1, cleanups: 0 });

      await followLink(container, 'Project');
      expect(container.querySelector('[data-testid="tasks-index"]'))
        .toHaveAttribute('data-pathname', '/tasks/projects/project-a');
      expect(mockTasksLifecycle).toEqual({ mounts: 1, cleanups: 0 });

      await followLink(container, 'Area');
      expect(container.querySelector('[data-testid="tasks-index"]'))
        .toHaveAttribute('data-pathname', '/tasks/areas/area-a');
      expect(mockTasksLifecycle).toEqual({ mounts: 1, cleanups: 0 });
    } finally {
      cleanup(root, container);
    }
  });

  it('redirects the Tasks root into the stable runtime', async () => {
    mockTasksLifecycle.mounts = 0;
    mockTasksLifecycle.cleanups = 0;
    const { container, root } = await renderRoutes('/tasks');

    try {
      expect(container.querySelector('[data-testid="tasks-index"]'))
        .toHaveAttribute('data-pathname', '/tasks/today');
      expect(mockTasksLifecycle).toEqual({ mounts: 1, cleanups: 0 });
    } finally {
      cleanup(root, container);
    }
  });

  it('leaves the Tasks subtree for an unknown Tasks path', async () => {
    mockTasksLifecycle.mounts = 0;
    mockTasksLifecycle.cleanups = 0;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, root } = await renderRoutes('/tasks/today');

    try {
      await followLink(container, 'Unknown');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      expect(container).toHaveTextContent('404');
      expect(container.querySelector('[data-testid="tasks-index"]')).toBeNull();
      expect(mockTasksLifecycle).toEqual({ mounts: 1, cleanups: 1 });
    } finally {
      cleanup(root, container);
      consoleError.mockRestore();
    }
  });
});

// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

type InstallListener = (event: {
  waitUntil: (operation: Promise<unknown>) => void;
}) => void;

type NotificationClickListener = (event: {
  notification: {
    close: () => void;
    data?: { navigateUrl?: unknown };
  };
  waitUntil: (operation: Promise<unknown>) => void;
}) => void;

interface WindowClientStub {
  url: string;
  navigate: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

function createWindowClient(url: string): WindowClientStub {
  return {
    url,
    navigate: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
  };
}

function loadServiceWorker(windows: WindowClientStub[]) {
  const listeners = new Map<string, unknown>();
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const serviceWorker = {
    location: { origin: 'https://os.bath.garden' },
    registration: { showNotification: vi.fn() },
    skipWaiting,
    clients: {
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow,
    },
    addEventListener: vi.fn((type: string, listener: unknown) => {
      listeners.set(type, listener);
    }),
  };
  const source = readFileSync(resolve(process.cwd(), 'public/tasks-service-worker.js'), 'utf8');
  new Function('self', source)(serviceWorker);

  return { listeners, openWindow, skipWaiting };
}

function loadNotificationClickListener(windows: WindowClientStub[]) {
  const { listeners, openWindow } = loadServiceWorker(windows);

  const listener = listeners.get('notificationclick') as NotificationClickListener | undefined;
  if (!listener) throw new Error('The Tasks service worker did not register notificationclick');
  return { listener, openWindow };
}

async function clickNotification(
  listener: NotificationClickListener,
  navigateUrl: unknown,
) {
  let operation: Promise<unknown> | undefined;
  const close = vi.fn();
  listener({
    notification: { close, data: { navigateUrl } },
    waitUntil: (pending) => {
      operation = pending;
    },
  });
  await operation;
  return { close };
}

describe('Tasks service worker lifecycle', () => {
  it('requests immediate activation when an updated worker installs', async () => {
    const { listeners, skipWaiting } = loadServiceWorker([]);
    const listener = listeners.get('install') as InstallListener | undefined;
    if (!listener) throw new Error('The Tasks service worker did not register install');

    let operation: Promise<unknown> | undefined;
    listener({
      waitUntil: (pending) => {
        operation = pending;
      },
    });
    await operation;

    expect(skipWaiting).toHaveBeenCalledOnce();
  });
});

describe('Tasks service worker notification routing', () => {
  it('reuses an existing Tasks client without replacing another BathOS module', async () => {
    const budget = createWindowClient('https://os.bath.garden/budget/expenses');
    const tasks = createWindowClient('https://os.bath.garden/tasks/inbox');
    const { listener, openWindow } = loadNotificationClickListener([budget, tasks]);

    await clickNotification(listener, '/tasks/today?reminder_delivery=delivery-a');

    expect(budget.navigate).not.toHaveBeenCalled();
    expect(budget.focus).not.toHaveBeenCalled();
    expect(tasks.navigate).toHaveBeenCalledWith(
      'https://os.bath.garden/tasks/today?reminder_delivery=delivery-a',
    );
    expect(tasks.focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a new Tasks window when only unrelated BathOS clients exist', async () => {
    const garage = createWindowClient('https://os.bath.garden/garage/vehicles');
    const { listener, openWindow } = loadNotificationClickListener([garage]);

    await clickNotification(listener, '/tasks/projects/project-a?reminder_delivery=delivery-b');

    expect(garage.navigate).not.toHaveBeenCalled();
    expect(garage.focus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(
      'https://os.bath.garden/tasks/projects/project-a?reminder_delivery=delivery-b',
    );
  });

  it.each([
    'https://example.com/tasks/today',
    '/budget/expenses',
    'not a valid Tasks URL',
    undefined,
  ])('falls back to Today for an unsafe destination: %s', async (navigateUrl) => {
    const tasks = createWindowClient('https://os.bath.garden/tasks/inbox');
    const { listener, openWindow } = loadNotificationClickListener([tasks]);

    await clickNotification(listener, navigateUrl);

    expect(tasks.navigate).toHaveBeenCalledWith('https://os.bath.garden/tasks/today');
    expect(tasks.focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a fresh Tasks window if the matching client cannot be navigated', async () => {
    const tasks = createWindowClient('https://os.bath.garden/tasks/today');
    tasks.navigate.mockRejectedValueOnce(new Error('client is unavailable'));
    const { listener, openWindow } = loadNotificationClickListener([tasks]);

    await clickNotification(listener, '/tasks/today?reminder_delivery=delivery-c');

    expect(tasks.focus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(
      'https://os.bath.garden/tasks/today?reminder_delivery=delivery-c',
    );
  });
});

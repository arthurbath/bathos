self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === 'string' && payload.title
    ? payload.title
    : 'Task Reminder';
  const body = typeof payload.body === 'string' && payload.body
    ? payload.body
    : 'A task reminder is due.';
  const occurrenceId = typeof payload.occurrence_id === 'string'
    ? payload.occurrence_id
    : 'unknown';
  const navigateUrl = typeof payload.navigate_url === 'string'
    ? payload.navigate_url
    : '/tasks/today';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: `tasks-reminder-${occurrenceId}`,
    renotify: false,
    data: { navigateUrl },
  }));
});

const TASKS_FALLBACK_PATH = '/tasks/today';

function isTasksPath(pathname) {
  return pathname === '/tasks' || pathname.startsWith('/tasks/');
}

function resolveTasksDestination(value) {
  try {
    const destination = new URL(
      typeof value === 'string' ? value : TASKS_FALLBACK_PATH,
      self.location.origin,
    );
    if (destination.origin !== self.location.origin || !isTasksPath(destination.pathname)) {
      return new URL(TASKS_FALLBACK_PATH, self.location.origin).href;
    }
    return destination.href;
  } catch {
    return new URL(TASKS_FALLBACK_PATH, self.location.origin).href;
  }
}

function isTasksWindow(client) {
  try {
    const clientUrl = new URL(client.url);
    return clientUrl.origin === self.location.origin && isTasksPath(clientUrl.pathname);
  } catch {
    return false;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const navigateUrl = typeof event.notification.data?.navigateUrl === 'string'
    ? event.notification.data.navigateUrl
    : TASKS_FALLBACK_PATH;
  const destination = resolveTasksDestination(navigateUrl);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const existing = windows.find(isTasksWindow);
    if (existing) {
      try {
        await existing.navigate(destination);
        await existing.focus();
        return;
      } catch {
        // Open a fresh Tasks window if an existing client cannot be reused.
      }
    }
    await self.clients.openWindow(destination);
  })());
});

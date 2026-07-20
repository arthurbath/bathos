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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const navigateUrl = typeof event.notification.data?.navigateUrl === 'string'
    ? event.notification.data.navigateUrl
    : '/tasks/today';
  const destination = new URL(navigateUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(destination);
      await existing.focus();
      return;
    }
    await self.clients.openWindow(destination);
  })());
});

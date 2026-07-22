self.__BATHOS_TASKS_WORKER_VERSION__ = 8;

const TASKS_SHELL_CACHE_PREFIX = 'bathos-tasks-shell-';
const TASKS_SHELL_META_CACHE = 'bathos-tasks-meta-v1';
const TASKS_SHELL_FORMAT_VERSION = '5';
const TASKS_SHELL_ASSET_LIMIT = 256;
const TASKS_SHELL_POINTER_KEY = new URL('/tasks-offline-shell-active', self.location.origin).href;
const TASKS_SHELL_DOCUMENT_KEY = new URL('/tasks-offline-shell', self.location.origin).href;
const TASKS_OFFLINE_ASSET_PREFIX = '/tasks-offline-assets/';
const TASKS_PRECACHE_PATH = '/tasks/today';

function hexadecimal(bytes) {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function shellCacheName(html) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${TASKS_SHELL_FORMAT_VERSION}\n${html}`),
  );
  return `${TASKS_SHELL_CACHE_PREFIX}${hexadecimal(digest).slice(0, 24)}`;
}

function offlineAssetUrl(sourceUrl) {
  const source = new URL(sourceUrl, self.location.origin);
  return new URL(
    `${TASKS_OFFLINE_ASSET_PREFIX}${source.pathname.slice(1)}${source.search}`,
    self.location.origin,
  ).href;
}

function rewriteShellAssets(html) {
  const assets = new Map();
  const rewrittenHtml = html.replace(
    /(\b(?:src|href)=["'])([^"']+)(["'])/gi,
    (match, opening, value, closing) => {
      try {
        const asset = new URL(value, self.location.origin);
        if (asset.origin !== self.location.origin || !asset.pathname.startsWith('/assets/')) {
          return match;
        }
        const offlineUrl = new URL(offlineAssetUrl(asset.href));
        assets.set(offlineUrl.href, asset.href);
        return `${opening}${offlineUrl.pathname}${offlineUrl.search}${closing}`;
      } catch {
        return match;
      }
    },
  );
  return { rewrittenHtml, assets };
}

function normalizedShellResponse(response, body = response.body) {
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('vary');
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function discoverShellAssetDependencies(text, sourceUrl) {
  const dependencies = new Map();
  for (const match of text.matchAll(/["'`]([^"'`\s]+)["'`]/g)) {
    try {
      const reference = match[1];
      if (!/^(?:\.{1,2}\/|\/assets\/|assets\/)[^?#]+\.(?:css|js|wasm)(?:\?[^#]*)?$/i.test(reference)) {
        continue;
      }
      const source = new URL(
        reference.startsWith('assets/') ? `/${reference}` : reference,
        sourceUrl,
      );
      if (source.origin !== self.location.origin || !source.pathname.startsWith('/assets/')) {
        continue;
      }
      dependencies.set(offlineAssetUrl(source.href), source.href);
    } catch {
      // Ignore strings that are not asset URLs.
    }
  }
  return dependencies;
}

function rewriteAbsoluteShellAssetReferences(text) {
  return text.replace(
    /(["'`])\/assets\/([^"'`\s?#]+\.(?:css|js|wasm)(?:\?[^"'`\s#]*)?)\1/gi,
    (match, quote, path) => `${quote}${TASKS_OFFLINE_ASSET_PREFIX}assets/${path}${quote}`,
  );
}

async function fetchShellAssetGraph(initialAssets) {
  const queue = Array.from(initialAssets, ([offlineUrl, sourceUrl]) => ({ offlineUrl, sourceUrl }));
  const queuedSources = new Set(queue.map((asset) => asset.sourceUrl));
  const fetchedAssets = [];

  while (queue.length > 0) {
    if (queuedSources.size > TASKS_SHELL_ASSET_LIMIT) {
      throw new Error('Tasks shell asset graph exceeded its safety limit');
    }
    const asset = queue.shift();
    const assetResponse = await fetch(asset.sourceUrl, {
      cache: 'reload',
      credentials: 'same-origin',
    });
    if (!assetResponse.ok) {
      throw new Error('A Tasks shell asset could not be staged');
    }

    let responseBody = assetResponse.body;
    if (/\.(?:css|js)$/i.test(new URL(asset.sourceUrl).pathname)) {
      const sourceText = await assetResponse.clone().text();
      const dependencies = discoverShellAssetDependencies(sourceText, asset.sourceUrl);
      for (const [offlineUrl, sourceUrl] of dependencies) {
        if (queuedSources.has(sourceUrl)) continue;
        queuedSources.add(sourceUrl);
        queue.push({ offlineUrl, sourceUrl });
      }
      responseBody = rewriteAbsoluteShellAssetReferences(sourceText);
    }
    fetchedAssets.push({
      offlineUrl: asset.offlineUrl,
      response: normalizedShellResponse(assetResponse, responseBody),
    });
  }
  return fetchedAssets;
}

async function activeShellCacheName() {
  const metadata = await caches.open(TASKS_SHELL_META_CACHE);
  const pointer = await metadata.match(TASKS_SHELL_POINTER_KEY);
  if (!pointer) return null;
  const name = await pointer.text();
  return name.startsWith(TASKS_SHELL_CACHE_PREFIX) ? name : null;
}

async function setActiveShellCacheName(name) {
  const metadata = await caches.open(TASKS_SHELL_META_CACHE);
  await metadata.put(TASKS_SHELL_POINTER_KEY, new Response(name, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  }));
}

async function deleteInactiveShellCaches(activeName) {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(TASKS_SHELL_CACHE_PREFIX) && name !== activeName)
    .map((name) => caches.delete(name)));
}

async function stageTasksShell(response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Tasks shell response was not successful HTML');
  }

  const html = await response.clone().text();
  const { rewrittenHtml, assets } = rewriteShellAssets(html);
  if (assets.size === 0) {
    throw new Error('Tasks shell did not declare versioned application assets');
  }

  const cacheName = await shellCacheName(html);
  const currentName = await activeShellCacheName();
  if (currentName === cacheName) {
    await deleteInactiveShellCaches(currentName);
    return currentName;
  }

  const fetchedAssets = await fetchShellAssetGraph(assets);

  await caches.delete(cacheName);
  const shellCache = await caches.open(cacheName);
  try {
    await shellCache.put(
      TASKS_SHELL_DOCUMENT_KEY,
      normalizedShellResponse(new Response(rewrittenHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })),
    );
    for (const asset of fetchedAssets) {
      await shellCache.put(asset.offlineUrl, asset.response.clone());
    }
    await setActiveShellCacheName(cacheName);
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }

  await deleteInactiveShellCaches(cacheName);
  return cacheName;
}

async function cachedTasksShell() {
  const cacheName = await activeShellCacheName();
  if (!cacheName) return null;
  const shellCache = await caches.open(cacheName);
  return shellCache.match(TASKS_SHELL_DOCUMENT_KEY);
}

async function handleTasksNavigation(request, event) {
  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error('Tasks navigation failed');
    if (response.headers.get('content-type')?.includes('text/html')) {
      event.waitUntil(stageTasksShell(response.clone()).catch(() => undefined));
    }
    return response;
  } catch (error) {
    const shell = await cachedTasksShell();
    if (shell) return shell;
    throw error;
  }
}

async function handleOfflineAsset(request) {
  const cacheName = await activeShellCacheName();
  if (cacheName) {
    const shellCache = await caches.open(cacheName);
    const cached = await shellCache.match(request);
    if (cached) return cached;
  }
  return fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(TASKS_PRECACHE_PATH, {
      cache: 'reload',
      credentials: 'same-origin',
    });
    await stageTasksShell(response);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const activeName = await activeShellCacheName();
    await deleteInactiveShellCaches(activeName);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && isTasksPath(url.pathname)) {
    event.respondWith(handleTasksNavigation(request, event));
    return;
  }
  if (url.pathname.startsWith(TASKS_OFFLINE_ASSET_PREFIX)) {
    event.respondWith(handleOfflineAsset(request));
  }
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

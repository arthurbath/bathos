// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://os.bath.garden';
const SHELL_HTML = `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="/assets/app-v1.css">
    <link rel="icon" href="/favicon.svg">
  </head>
  <body><div id="root"></div><script type="module" src="/assets/app-v1.js"></script></body>
</html>`;

type WorkerListener = (event: Record<string, unknown>) => void;

interface WindowClientStub {
  url: string;
  navigate: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
}

interface CacheStub {
  match: (request: RequestInfo | URL) => Promise<Response | undefined>;
  put: (request: RequestInfo | URL, response: Response) => Promise<void>;
}

function requestUrl(request: RequestInfo | URL) {
  const value = typeof request === 'string'
    ? request
    : request instanceof URL
      ? request.href
      : request.url;
  return new URL(value, ORIGIN).href;
}

function createCacheStorage() {
  const stores = new Map<string, Map<string, Response>>();
  const cachesStub = {
    open: vi.fn(async (name: string): Promise<CacheStub> => {
      let store = stores.get(name);
      if (!store) {
        store = new Map();
        stores.set(name, store);
      }
      return {
        match: async (request) => store?.get(requestUrl(request))?.clone(),
        put: async (request, response) => {
          store?.set(requestUrl(request), response.clone());
        },
      };
    }),
    keys: vi.fn(async () => Array.from(stores.keys())),
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };
  return { cachesStub, stores };
}

function createWindowClient(url: string): WindowClientStub {
  return {
    url,
    navigate: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
  };
}

function htmlResponse(html = SHELL_HTML) {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function assetResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-encoding': 'gzip',
      'content-length': String(body.length),
      'content-type': 'application/octet-stream',
      vary: 'Origin',
    },
  });
}

function navigationRequest(path: string) {
  return {
    method: 'GET',
    mode: 'navigate',
    url: new URL(path, ORIGIN).href,
  } as Request;
}

function loadServiceWorker(
  windows: WindowClientStub[] = [],
  network?: (request: RequestInfo | URL) => Promise<Response>,
) {
  const listeners = new Map<string, WorkerListener>();
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const claim = vi.fn().mockResolvedValue(undefined);
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const { cachesStub, stores } = createCacheStorage();
  const fetchStub = vi.fn(network ?? (async (request: RequestInfo | URL) => {
    const url = requestUrl(request);
    if (url.endsWith('/tasks/today')) return htmlResponse();
    if (url.endsWith('/assets/app-v1.js')) return assetResponse('console.log("v1")');
    if (url.endsWith('/assets/app-v1.css')) return assetResponse('body { color: white; }');
    throw new TypeError(`No network fixture for ${url}`);
  }));
  const serviceWorker = {
    location: { origin: ORIGIN },
    registration: { showNotification },
    skipWaiting,
    clients: {
      claim,
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow,
    },
    addEventListener: vi.fn((type: string, listener: WorkerListener) => {
      listeners.set(type, listener);
    }),
  };
  const source = readFileSync(resolve(process.cwd(), 'public/tasks-service-worker.js'), 'utf8');
  new Function(
    'self',
    'caches',
    'fetch',
    'crypto',
    'TextEncoder',
    'Headers',
    'Response',
    'URL',
    source,
  )(
    serviceWorker,
    cachesStub,
    fetchStub,
    globalThis.crypto,
    TextEncoder,
    Headers,
    Response,
    URL,
  );

  return {
    cachesStub,
    claim,
    fetchStub,
    listeners,
    openWindow,
    serviceWorker,
    showNotification,
    skipWaiting,
    stores,
  };
}

async function runExtendableEvent(listener: WorkerListener) {
  let operation: Promise<unknown> | undefined;
  listener({
    waitUntil: (pending: Promise<unknown>) => {
      operation = pending;
    },
  });
  await operation;
}

async function runFetch(
  listener: WorkerListener,
  request: Request,
) {
  let response: Promise<Response> | undefined;
  const background: Promise<unknown>[] = [];
  listener({
    request,
    respondWith: (pending: Promise<Response>) => {
      response = pending;
    },
    waitUntil: (pending: Promise<unknown>) => {
      background.push(pending);
    },
  });
  const resolved = response ? await response : undefined;
  await Promise.all(background);
  return resolved;
}

async function installWorker(environment: ReturnType<typeof loadServiceWorker>) {
  const listener = environment.listeners.get('install');
  if (!listener) throw new Error('The Tasks service worker did not register install');
  await runExtendableEvent(listener);
}

async function clickNotification(
  listener: WorkerListener,
  navigateUrl: unknown,
) {
  let operation: Promise<unknown> | undefined;
  const close = vi.fn();
  listener({
    notification: { close, data: { navigateUrl } },
    waitUntil: (pending: Promise<unknown>) => {
      operation = pending;
    },
  });
  await operation;
  return { close };
}

describe('Tasks service worker offline shell', () => {
  it('atomically stages a rewritten shell before requesting activation', async () => {
    const environment = loadServiceWorker();

    await installWorker(environment);

    expect(environment.skipWaiting).toHaveBeenCalledOnce();
    const cacheNames = Array.from(environment.stores.keys());
    const shellName = cacheNames.find((name) => name.startsWith('bathos-tasks-shell-'));
    expect(shellName).toBeDefined();
    const shellStore = environment.stores.get(shellName ?? '');
    const shell = await shellStore?.get(`${ORIGIN}/tasks-offline-shell`)?.text();
    expect(shell).toContain('/tasks-offline-assets/assets/app-v1.js');
    expect(shell).toContain('/tasks-offline-assets/assets/app-v1.css');
    expect(shell).toContain('/favicon.svg');
    expect(shellStore?.has(`${ORIGIN}/tasks-offline-assets/assets/app-v1.js`)).toBe(true);
    expect(shellStore?.has(`${ORIGIN}/tasks-offline-assets/assets/app-v1.css`)).toBe(true);
    const cachedAsset = shellStore?.get(`${ORIGIN}/tasks-offline-assets/assets/app-v1.js`);
    expect(cachedAsset?.headers.get('vary')).toBeNull();
    expect(cachedAsset?.headers.get('content-encoding')).toBeNull();
    expect(cachedAsset?.headers.get('content-length')).toBeNull();
  });

  it('stages recursive same-origin module, worker, and WASM dependencies', async () => {
    const environment = loadServiceWorker([], async (request) => {
      const url = requestUrl(request);
      if (url.endsWith('/tasks/today')) return htmlResponse();
      if (url.endsWith('/assets/app-v1.js')) {
        return assetResponse('import("./tasks-chunk.js");');
      }
      if (url.endsWith('/assets/app-v1.css')) return assetResponse('body { color: white; }');
      if (url.endsWith('/assets/tasks-chunk.js')) {
        return assetResponse('new URL("/assets/tasks.worker.js", import.meta.url);');
      }
      if (url.endsWith('/assets/tasks.worker.js')) {
        return assetResponse('new URL("assets/tasks.wasm", import.meta.url);');
      }
      if (url.endsWith('/assets/tasks.wasm')) return assetResponse('wasm');
      throw new TypeError(`No network fixture for ${url}`);
    });

    await installWorker(environment);

    const shellName = Array.from(environment.stores.keys())
      .find((name) => name.startsWith('bathos-tasks-shell-'));
    const shellStore = environment.stores.get(shellName ?? '');
    expect(shellStore?.has(`${ORIGIN}/tasks-offline-assets/assets/tasks-chunk.js`)).toBe(true);
    expect(shellStore?.has(`${ORIGIN}/tasks-offline-assets/assets/tasks.worker.js`)).toBe(true);
    expect(shellStore?.has(`${ORIGIN}/tasks-offline-assets/assets/tasks.wasm`)).toBe(true);
    const cachedChunk = await shellStore
      ?.get(`${ORIGIN}/tasks-offline-assets/assets/tasks-chunk.js`)
      ?.text();
    expect(cachedChunk).toContain('/tasks-offline-assets/assets/tasks.worker.js');
    expect(cachedChunk).not.toContain('"/assets/tasks.worker.js"');
  });

  it('claims clients and removes inactive shell caches on activation', async () => {
    const environment = loadServiceWorker();
    await installWorker(environment);
    environment.stores.set('bathos-tasks-shell-abandoned', new Map());
    const listener = environment.listeners.get('activate');
    if (!listener) throw new Error('The Tasks service worker did not register activate');

    await runExtendableEvent(listener);

    expect(environment.claim).toHaveBeenCalledOnce();
    expect(environment.stores.has('bathos-tasks-shell-abandoned')).toBe(false);
  });

  it('replaces a prior shell-format cache even when deployment HTML is unchanged', async () => {
    const environment = loadServiceWorker();
    const legacyName = 'bathos-tasks-shell-legacy-format';
    environment.stores.set(legacyName, new Map([
      [`${ORIGIN}/tasks-offline-shell`, htmlResponse(SHELL_HTML)],
    ]));
    const metadata = await environment.cachesStub.open('bathos-tasks-meta-v1');
    await metadata.put(`${ORIGIN}/tasks-offline-shell-active`, new Response(legacyName));

    await installWorker(environment);

    const activePointer = environment.stores
      .get('bathos-tasks-meta-v1')
      ?.get(`${ORIGIN}/tasks-offline-shell-active`);
    const activeName = await activePointer?.clone().text();
    expect(activeName).toMatch(/^bathos-tasks-shell-/);
    expect(activeName).not.toBe(legacyName);
    expect(environment.stores.has(legacyName)).toBe(false);
  });

  it('returns the network Tasks page online and the cached shell offline', async () => {
    let offline = false;
    const environment = loadServiceWorker([], async (request) => {
      const url = requestUrl(request);
      if (offline) throw new TypeError('offline');
      if (url.endsWith('/tasks/today') || url.endsWith('/tasks/inbox')) return htmlResponse();
      if (url.endsWith('/assets/app-v1.js')) return assetResponse('console.log("v1")');
      if (url.endsWith('/assets/app-v1.css')) return assetResponse('body { color: white; }');
      throw new TypeError(`No network fixture for ${url}`);
    });
    await installWorker(environment);
    const listener = environment.listeners.get('fetch');
    if (!listener) throw new Error('The Tasks service worker did not register fetch');

    const online = await runFetch(listener, navigationRequest('/tasks/inbox'));
    expect(await online?.text()).toBe(SHELL_HTML);

    const activePointer = environment.stores
      .get('bathos-tasks-meta-v1')
      ?.get(`${ORIGIN}/tasks-offline-shell-active`);
    expect(activePointer).toBeDefined();
    const activeName = await activePointer?.clone().text();
    expect(activeName).toMatch(/^bathos-tasks-shell-/);
    expect(environment.stores.get(activeName ?? '')?.has(`${ORIGIN}/tasks-offline-shell`)).toBe(true);

    offline = true;
    const cached = await runFetch(listener, navigationRequest('/tasks/projects/a'));
    const cachedHtml = await cached?.text();
    expect(cachedHtml).toContain('/tasks-offline-assets/assets/app-v1.js');

    const asset = await runFetch(
      listener,
      new Request(`${ORIGIN}/tasks-offline-assets/assets/app-v1.js`),
    );
    expect(await asset?.text()).toBe('console.log("v1")');
  });

  it('preserves the previous complete shell when a replacement asset fails', async () => {
    let version = 1;
    let offline = false;
    const v2 = SHELL_HTML.replaceAll('app-v1', 'app-v2');
    const environment = loadServiceWorker([], async (request) => {
      const url = requestUrl(request);
      if (offline) throw new TypeError('offline');
      if (url.includes('/tasks/')) return htmlResponse(version === 1 ? SHELL_HTML : v2);
      if (url.endsWith('/assets/app-v1.js')) return assetResponse('console.log("v1")');
      if (url.endsWith('/assets/app-v1.css')) return assetResponse('body { color: white; }');
      if (url.endsWith('/assets/app-v2.js')) return assetResponse('console.log("v2")');
      if (url.endsWith('/assets/app-v2.css')) return new Response('missing', { status: 503 });
      throw new TypeError(`No network fixture for ${url}`);
    });
    await installWorker(environment);
    const firstShellName = Array.from(environment.stores.keys())
      .find((name) => name.startsWith('bathos-tasks-shell-'));
    version = 2;
    const listener = environment.listeners.get('fetch');
    if (!listener) throw new Error('The Tasks service worker did not register fetch');

    const network = await runFetch(
      listener,
      navigationRequest('/tasks/today'),
    );
    expect(await network?.text()).toBe(v2);

    const activePointer = environment.stores
      .get('bathos-tasks-meta-v1')
      ?.get(`${ORIGIN}/tasks-offline-shell-active`);
    expect(await activePointer?.clone().text()).toBe(firstShellName);

    offline = true;
    const fallback = await runFetch(
      listener,
      navigationRequest('/tasks/today'),
    );
    expect(await fallback?.text()).toContain('app-v1');
    expect(environment.stores.has(firstShellName ?? '')).toBe(true);
  });

  it.each([
    navigationRequest('/budget/expenses'),
    new Request(`${ORIGIN}/assets/shared.js`),
    new Request(`${ORIGIN}/rest/v1/tasks_items`),
    new Request(`${ORIGIN}/tasks/today`, { method: 'POST' }),
    navigationRequest('https://example.com/tasks/today'),
  ])('does not intercept unrelated or mutating traffic: $url', async (request) => {
    const environment = loadServiceWorker();
    const listener = environment.listeners.get('fetch');
    if (!listener) throw new Error('The Tasks service worker did not register fetch');

    expect(await runFetch(listener, request)).toBeUndefined();
    expect(environment.fetchStub).not.toHaveBeenCalled();
  });
});

describe('Tasks service worker reminder behavior', () => {
  it('shows a push reminder with a stable occurrence tag', async () => {
    const environment = loadServiceWorker();
    const listener = environment.listeners.get('push');
    if (!listener) throw new Error('The Tasks service worker did not register push');
    let operation: Promise<unknown> | undefined;

    listener({
      data: {
        json: () => ({
          title: 'Review draft',
          body: 'The reminder is due.',
          occurrence_id: 'occurrence-a',
          navigate_url: '/tasks/today?reminder_delivery=delivery-a',
        }),
      },
      waitUntil: (pending: Promise<unknown>) => {
        operation = pending;
      },
    });
    await operation;

    expect(environment.showNotification).toHaveBeenCalledWith('Review draft', {
      body: 'The reminder is due.',
      tag: 'tasks-reminder-occurrence-a',
      renotify: false,
      data: { navigateUrl: '/tasks/today?reminder_delivery=delivery-a' },
    });
  });

  it('reuses an existing Tasks client without replacing another BathOS module', async () => {
    const budget = createWindowClient(`${ORIGIN}/budget/expenses`);
    const tasks = createWindowClient(`${ORIGIN}/tasks/inbox`);
    const environment = loadServiceWorker([budget, tasks]);
    const listener = environment.listeners.get('notificationclick');
    if (!listener) throw new Error('The Tasks service worker did not register notificationclick');

    await clickNotification(listener, '/tasks/today?reminder_delivery=delivery-a');

    expect(budget.navigate).not.toHaveBeenCalled();
    expect(budget.focus).not.toHaveBeenCalled();
    expect(tasks.navigate).toHaveBeenCalledWith(
      `${ORIGIN}/tasks/today?reminder_delivery=delivery-a`,
    );
    expect(tasks.focus).toHaveBeenCalledOnce();
    expect(environment.openWindow).not.toHaveBeenCalled();
  });

  it('opens a new Tasks window when only unrelated BathOS clients exist', async () => {
    const garage = createWindowClient(`${ORIGIN}/garage/vehicles`);
    const environment = loadServiceWorker([garage]);
    const listener = environment.listeners.get('notificationclick');
    if (!listener) throw new Error('The Tasks service worker did not register notificationclick');

    await clickNotification(listener, '/tasks/projects/project-a?reminder_delivery=delivery-b');

    expect(garage.navigate).not.toHaveBeenCalled();
    expect(garage.focus).not.toHaveBeenCalled();
    expect(environment.openWindow).toHaveBeenCalledWith(
      `${ORIGIN}/tasks/projects/project-a?reminder_delivery=delivery-b`,
    );
  });

  it.each([
    'https://example.com/tasks/today',
    '/budget/expenses',
    'not a valid Tasks URL',
    undefined,
  ])('falls back to Today for an unsafe destination: %s', async (navigateUrl) => {
    const tasks = createWindowClient(`${ORIGIN}/tasks/inbox`);
    const environment = loadServiceWorker([tasks]);
    const listener = environment.listeners.get('notificationclick');
    if (!listener) throw new Error('The Tasks service worker did not register notificationclick');

    await clickNotification(listener, navigateUrl);

    expect(tasks.navigate).toHaveBeenCalledWith(`${ORIGIN}/tasks/today`);
    expect(tasks.focus).toHaveBeenCalledOnce();
    expect(environment.openWindow).not.toHaveBeenCalled();
  });

  it('opens a fresh Tasks window if the matching client cannot be navigated', async () => {
    const tasks = createWindowClient(`${ORIGIN}/tasks/today`);
    tasks.navigate.mockRejectedValueOnce(new Error('client is unavailable'));
    const environment = loadServiceWorker([tasks]);
    const listener = environment.listeners.get('notificationclick');
    if (!listener) throw new Error('The Tasks service worker did not register notificationclick');

    await clickNotification(listener, '/tasks/today?reminder_delivery=delivery-c');

    expect(tasks.focus).not.toHaveBeenCalled();
    expect(environment.openWindow).toHaveBeenCalledWith(
      `${ORIGIN}/tasks/today?reminder_delivery=delivery-c`,
    );
  });
});

export const TASKS_SERVICE_WORKER_PATH = '/tasks-service-worker.js?version=8';
export const TASKS_SERVICE_WORKER_SCOPE = '/';

const TASKS_SHELL_CACHE_PREFIX = 'bathos-tasks-shell-';
const TASKS_SHELL_META_CACHE = 'bathos-tasks-meta-v1';
const TASKS_SHELL_POINTER_PATH = '/tasks-offline-shell-active';
const TASKS_SHELL_DOCUMENT_PATH = '/tasks-offline-shell';
const TASKS_OFFLINE_PREPARATION_TIMEOUT_MS = 30_000;
const TASKS_OFFLINE_PREPARATION_POLL_MS = 250;

export type TasksOfflineLaunchState = 'preparing' | 'ready' | 'unsupported' | 'failed';

type TasksServiceWorkerEnvironment = {
  secureContext: boolean;
  serviceWorker: ServiceWorkerContainer | null;
  cacheStorage?: CacheStorage | null;
  origin?: string;
  preparationTimeoutMs?: number;
  preparationPollMs?: number;
};

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function currentEnvironment(): TasksServiceWorkerEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { secureContext: false, serviceWorker: null };
  }
  return {
    secureContext: window.isSecureContext,
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : null,
    cacheStorage: 'caches' in window ? window.caches : null,
    origin: window.location.origin,
  };
}

export function canRegisterTasksServiceWorker(
  environment: TasksServiceWorkerEnvironment = currentEnvironment(),
) {
  return environment.secureContext && environment.serviceWorker !== null;
}

export function registerTasksServiceWorker(
  environment: TasksServiceWorkerEnvironment = currentEnvironment(),
): Promise<ServiceWorkerRegistration | null> {
  if (!canRegisterTasksServiceWorker(environment)) {
    return Promise.resolve(null);
  }
  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise = environment.serviceWorker!.register(TASKS_SERVICE_WORKER_PATH, {
    scope: TASKS_SERVICE_WORKER_SCOPE,
    updateViaCache: 'none',
  }).catch((error) => {
    registrationPromise = null;
    throw error;
  });
  return registrationPromise;
}

async function hasCompleteTasksOfflineShell(
  cacheStorage: CacheStorage,
  origin: string,
): Promise<boolean> {
  const metadata = await cacheStorage.open(TASKS_SHELL_META_CACHE);
  const pointer = await metadata.match(new URL(TASKS_SHELL_POINTER_PATH, origin).href);
  if (!pointer) return false;

  const cacheName = await pointer.text();
  if (!cacheName.startsWith(TASKS_SHELL_CACHE_PREFIX)) return false;

  const shellCache = await cacheStorage.open(cacheName);
  const shell = await shellCache.match(new URL(TASKS_SHELL_DOCUMENT_PATH, origin).href);
  return shell !== undefined;
}

function withPreparationTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Tasks offline preparation timed out'));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function waitForCompleteTasksOfflineShell(
  cacheStorage: CacheStorage,
  origin: string,
  timeoutMs: number,
  pollMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await hasCompleteTasksOfflineShell(cacheStorage, origin)) return true;
    if (Date.now() >= deadline) return false;
    await new Promise<void>((resolve) => window.setTimeout(resolve, pollMs));
  } while (Date.now() <= deadline);
  return false;
}

export async function prepareTasksOfflineLaunch(
  environment: TasksServiceWorkerEnvironment = currentEnvironment(),
): Promise<TasksOfflineLaunchState> {
  const cacheStorage = environment.cacheStorage ?? null;
  const origin = environment.origin?.trim();
  if (!canRegisterTasksServiceWorker(environment) || cacheStorage === null || !origin) {
    return 'unsupported';
  }

  try {
    const registration = await registerTasksServiceWorker(environment);
    if (registration === null) return 'unsupported';

    const timeoutMs = environment.preparationTimeoutMs
      ?? TASKS_OFFLINE_PREPARATION_TIMEOUT_MS;
    const pollMs = environment.preparationPollMs ?? TASKS_OFFLINE_PREPARATION_POLL_MS;
    const [registrationReady, shellReady] = await Promise.all([
      withPreparationTimeout(environment.serviceWorker!.ready, timeoutMs),
      waitForCompleteTasksOfflineShell(cacheStorage, origin, timeoutMs, pollMs),
    ]);
    return registrationReady && shellReady ? 'ready' : 'failed';
  } catch {
    return 'failed';
  }
}

export function resetTasksServiceWorkerRegistrationForTests() {
  registrationPromise = null;
}

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canRegisterTasksServiceWorker,
  prepareTasksOfflineLaunch,
  registerTasksServiceWorker,
  resetTasksServiceWorkerRegistrationForTests,
} from './taskServiceWorker';

afterEach(() => {
  resetTasksServiceWorkerRegistrationForTests();
  vi.unstubAllGlobals();
});

function supportedEnvironment(register: ReturnType<typeof vi.fn>) {
  return {
    secureContext: true,
    serviceWorker: { register } as unknown as ServiceWorkerContainer,
  };
}

function cacheStorageWithShell(complete: boolean) {
  const cacheName = 'bathos-tasks-shell-device';
  const metadata = {
    match: vi.fn().mockResolvedValue(
      complete ? new Response(cacheName) : undefined,
    ),
  };
  const shell = {
    match: vi.fn().mockResolvedValue(
      complete ? new Response('<!doctype html>') : undefined,
    ),
  };
  return {
    open: vi.fn(async (name: string) => (name === 'bathos-tasks-meta-v1' ? metadata : shell)),
  } as unknown as CacheStorage;
}

describe('Tasks service-worker registration', () => {
  it('fails closed when the client is insecure or unsupported', async () => {
    const register = vi.fn();
    expect(canRegisterTasksServiceWorker({
      secureContext: false,
      serviceWorker: { register } as unknown as ServiceWorkerContainer,
    })).toBe(false);
    expect(canRegisterTasksServiceWorker({
      secureContext: true,
      serviceWorker: null,
    })).toBe(false);

    await expect(registerTasksServiceWorker({
      secureContext: false,
      serviceWorker: { register } as unknown as ServiceWorkerContainer,
    })).resolves.toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it('reuses one root-scoped registration without notification work', async () => {
    const registration = { scope: 'https://os.bath.garden/' } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { requestPermission });

    const environment = supportedEnvironment(register);
    const first = registerTasksServiceWorker(environment);
    const second = registerTasksServiceWorker(environment);

    expect(first).toBe(second);
    await expect(first).resolves.toBe(registration);
    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith('/tasks-service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('allows a later registration retry after one failure', async () => {
    const registration = { scope: 'https://os.bath.garden/' } as ServiceWorkerRegistration;
    const register = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(registration);
    const environment = supportedEnvironment(register);

    await expect(registerTasksServiceWorker(environment)).rejects.toThrow('offline');
    await expect(registerTasksServiceWorker(environment)).resolves.toBe(registration);
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('reports ready only after this client partition has an active complete shell', async () => {
    const registration = { scope: 'https://os.bath.garden/' } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    const environment = {
      secureContext: true,
      serviceWorker: {
        register,
        ready: Promise.resolve(registration),
      } as unknown as ServiceWorkerContainer,
      cacheStorage: cacheStorageWithShell(true),
      origin: 'https://os.bath.garden',
    };

    await expect(prepareTasksOfflineLaunch(environment)).resolves.toBe('ready');
  });

  it('does not treat another browsing partition as offline-ready', async () => {
    const registration = { scope: 'https://os.bath.garden/' } as ServiceWorkerRegistration;
    const environment = {
      secureContext: true,
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      } as unknown as ServiceWorkerContainer,
      cacheStorage: cacheStorageWithShell(false),
      origin: 'https://os.bath.garden',
      preparationTimeoutMs: 0,
    };

    await expect(prepareTasksOfflineLaunch(environment)).resolves.toBe('failed');
  });

  it('waits for an updating worker to finish staging this partition', async () => {
    const registration = { scope: 'https://os.bath.garden/' } as ServiceWorkerRegistration;
    const cacheName = 'bathos-tasks-shell-device';
    const metadata = {
      match: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(new Response(cacheName)),
    };
    const shell = { match: vi.fn().mockResolvedValue(new Response('<!doctype html>')) };
    const environment = {
      secureContext: true,
      serviceWorker: {
        register: vi.fn().mockResolvedValue(registration),
        ready: Promise.resolve(registration),
      } as unknown as ServiceWorkerContainer,
      cacheStorage: {
        open: vi.fn(async (name: string) => (
          name === 'bathos-tasks-meta-v1' ? metadata : shell
        )),
      } as unknown as CacheStorage,
      origin: 'https://os.bath.garden',
      preparationTimeoutMs: 50,
      preparationPollMs: 1,
    };

    await expect(prepareTasksOfflineLaunch(environment)).resolves.toBe('ready');
    expect(metadata.match).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canRegisterTasksServiceWorker,
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
});

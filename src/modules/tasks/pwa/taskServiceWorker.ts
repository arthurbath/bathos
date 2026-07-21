export const TASKS_SERVICE_WORKER_PATH = '/tasks-service-worker.js';
export const TASKS_SERVICE_WORKER_SCOPE = '/';

type TasksServiceWorkerEnvironment = {
  secureContext: boolean;
  serviceWorker: ServiceWorkerContainer | null;
};

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function currentEnvironment(): TasksServiceWorkerEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { secureContext: false, serviceWorker: null };
  }
  return {
    secureContext: window.isSecureContext,
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : null,
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

export function resetTasksServiceWorkerRegistrationForTests() {
  registrationPromise = null;
}

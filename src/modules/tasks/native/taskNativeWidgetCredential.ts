import {
  taskNativeQuickEntryContract,
  taskNativeQuickEntryContractFingerprint,
} from '@/modules/tasks/domain/taskNativeQuickEntryContract.generated';
import type {
  TaskNativeQuickEntryCredentialMessage,
  TaskNativeWidgetCredentialMessage,
} from '@/modules/tasks/native/taskNativeWidgetBridge';

export const TASK_NATIVE_WIDGET_CREDENTIAL_RETRY_DELAYS_MS = [
  1_000,
  5_000,
  30_000,
  300_000,
] as const;

type CredentialPayload = Omit<
  TaskNativeWidgetCredentialMessage,
  'type' | 'schemaVersion'
>;

type QuickEntryCredentialPayload = Omit<
  TaskNativeQuickEntryCredentialMessage,
  'type' | 'schemaVersion'
>;

type MaintainTaskNativeWidgetCredentialOptions = {
  ownerId: string;
  installationId: string;
  signal: AbortSignal;
  issue: () => Promise<unknown>;
  publish: (credential: CredentialPayload) => boolean;
  wait?: (delayMs: number, signal: AbortSignal) => Promise<void>;
};

type MaintainTaskNativeQuickEntryCredentialOptions = {
  ownerId: string;
  installationId: string;
  signal: AbortSignal;
  issue: () => Promise<unknown>;
  publish: (credential: QuickEntryCredentialPayload) => boolean;
  wait?: (delayMs: number, signal: AbortSignal) => Promise<void>;
};

export function parseTaskNativeWidgetCredential(
  value: unknown,
  ownerId: string,
  installationId: string,
): CredentialPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const result = value as Record<string, unknown>;
  if (
    result.outcome !== 'issued'
    || result.ownerId !== ownerId
    || result.installationId !== installationId
    || typeof result.credential !== 'string'
    || typeof result.expiresAt !== 'string'
  ) {
    return null;
  }
  return {
    ownerId,
    installationId,
    credential: result.credential,
    expiresAt: result.expiresAt,
  };
}

export async function maintainTaskNativeWidgetCredential({
  ownerId,
  installationId,
  signal,
  issue,
  publish,
  wait = waitForCredentialRetry,
}: MaintainTaskNativeWidgetCredentialOptions): Promise<boolean> {
  let failureCount = 0;
  while (!signal.aborted) {
    let issued: unknown = null;
    try {
      issued = await issue();
    } catch {
      issued = null;
    }
    if (signal.aborted) return false;

    const credential = parseTaskNativeWidgetCredential(
      issued,
      ownerId,
      installationId,
    );
    if (credential && publish(credential)) return true;

    const delay = TASK_NATIVE_WIDGET_CREDENTIAL_RETRY_DELAYS_MS[
      Math.min(
        failureCount,
        TASK_NATIVE_WIDGET_CREDENTIAL_RETRY_DELAYS_MS.length - 1,
      )
    ];
    failureCount += 1;
    await wait(delay, signal);
  }
  return false;
}

export function parseTaskNativeQuickEntryCredential(
  value: unknown,
  ownerId: string,
  installationId: string,
): QuickEntryCredentialPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const result = value as Record<string, unknown>;
  if (
    result.outcome !== 'issued'
    || result.type !== 'nativeQuickEntryCredential'
    || result.payloadSchemaVersion
      !== taskNativeQuickEntryContract.payloadSchemaVersion
    || result.contractFingerprint !== taskNativeQuickEntryContractFingerprint
    || result.capability !== taskNativeQuickEntryContract.capability
    || result.ownerId !== ownerId
    || result.installationId !== installationId
    || typeof result.credential !== 'string'
    || !/^tqe_[A-Za-z0-9_-]{43}$/.test(result.credential)
    || typeof result.expiresAt !== 'string'
    || Number.isNaN(Date.parse(result.expiresAt))
  ) {
    return null;
  }
  return {
    payloadSchemaVersion: taskNativeQuickEntryContract.payloadSchemaVersion,
    contractFingerprint: taskNativeQuickEntryContractFingerprint,
    capability: taskNativeQuickEntryContract.capability,
    ownerId,
    installationId,
    credential: result.credential,
    expiresAt: result.expiresAt,
  };
}

export async function maintainTaskNativeQuickEntryCredential({
  ownerId,
  installationId,
  signal,
  issue,
  publish,
  wait = waitForCredentialRetry,
}: MaintainTaskNativeQuickEntryCredentialOptions): Promise<boolean> {
  let failureCount = 0;
  while (!signal.aborted) {
    let issued: unknown = null;
    try {
      issued = await issue();
    } catch {
      issued = null;
    }
    if (signal.aborted) return false;

    const credential = parseTaskNativeQuickEntryCredential(
      issued,
      ownerId,
      installationId,
    );
    if (credential && publish(credential)) return true;

    const delay = TASK_NATIVE_WIDGET_CREDENTIAL_RETRY_DELAYS_MS[
      Math.min(
        failureCount,
        TASK_NATIVE_WIDGET_CREDENTIAL_RETRY_DELAYS_MS.length - 1,
      )
    ];
    failureCount += 1;
    await wait(delay, signal);
  }
  return false;
}

function waitForCredentialRetry(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const handle = window.setTimeout(finish, delayMs);
    signal.addEventListener('abort', finish, { once: true });

    function finish() {
      window.clearTimeout(handle);
      signal.removeEventListener('abort', finish);
      resolve();
    }
  });
}

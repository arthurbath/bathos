const PRODUCTION_SENTRY_HOSTS = ["os.bath.garden", "bath.garden"] as const;

interface SentryExceptionValue {
  type?: string;
  value?: string;
}

interface SentryEventLike {
  exception?: {
    values?: SentryExceptionValue[];
  };
  message?: string;
}

interface SentryEventHintLike {
  originalException?: unknown;
}

export function shouldEnableSentry(dsn: string | undefined, hostname: string): boolean {
  if (!dsn) return false;
  return PRODUCTION_SENTRY_HOSTS.includes(hostname as typeof PRODUCTION_SENTRY_HOSTS[number]);
}

function getErrorName(error: unknown): string {
  if (!error || typeof error !== "object" || !("name" in error)) return "";
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object" || !("message" in error)) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

function isAbortErrorText(value: string | undefined): boolean {
  const text = value?.toLowerCase() ?? "";
  return text.includes("aborterror") || text.includes("operation was aborted");
}

export function isIgnorableBrowserAbort(event: SentryEventLike, hint?: SentryEventHintLike): boolean {
  const originalException = hint?.originalException;
  if (getErrorName(originalException) === "AbortError" || isAbortErrorText(getErrorMessage(originalException))) {
    return true;
  }

  if (isAbortErrorText(event.message)) return true;

  return (
    event.exception?.values?.some((value) => value.type === "AbortError" || isAbortErrorText(value.value)) ?? false
  );
}

export { PRODUCTION_SENTRY_HOSTS };

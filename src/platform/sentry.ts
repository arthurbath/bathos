const PRODUCTION_SENTRY_HOSTS = ["os.bath.garden", "bath.garden"] as const;

export function shouldEnableSentry(dsn: string | undefined, hostname: string): boolean {
  if (!dsn) return false;
  return PRODUCTION_SENTRY_HOSTS.includes(hostname as typeof PRODUCTION_SENTRY_HOSTS[number]);
}

export { PRODUCTION_SENTRY_HOSTS };

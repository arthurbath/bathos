export type WidgetPushTarget = {
  registrationId: string;
  platform: 'ios' | 'macos' | 'watchos';
  environment: 'development' | 'production';
  topic: string;
  deviceToken: string;
};

export type WidgetPushClaim = {
  ownerId: string;
  claimId: string;
  generation: number;
  targets: WidgetPushTarget[];
};

export type WidgetPushDispatchClient = {
  claim: (limit: number) => Promise<{ data: unknown; error: unknown | null }>;
  finish: (claim: WidgetPushClaim, succeeded: boolean) => Promise<{ error: unknown | null }>;
  retire: (registrationId: string) => Promise<{ error: unknown | null }>;
};

export type APNsConfiguration = { teamId: string; keyId: string; privateKey: string };

type SendResult = { accepted: boolean; permanent: boolean; reason?: string };

type HandlerDependencies = {
  getEnvironment: (name: string) => string | null;
  createClient: (url: string, key: string) => WidgetPushDispatchClient;
  send: (target: WidgetPushTarget, configuration: APNsConfiguration) => Promise<SendResult>;
  logError?: (message: string) => void;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const token = /^[0-9a-f]{64,512}$/;
const topics = new Set([
  'garden.bath.tasks.push-type.widgets',
  'garden.bath.tasks.watchkitapp.push-type.widgets',
]);

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function parseKeyMap(serialized: string | null): string | null {
  if (!serialized) return null;
  try {
    const values = JSON.parse(serialized) as Record<string, unknown>;
    return [values.default, ...Object.values(values)].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ) ?? null;
  } catch { return null; }
}

export function resolveServiceKey(getEnvironment: HandlerDependencies['getEnvironment']) {
  return parseKeyMap(getEnvironment('SUPABASE_SECRET_KEYS'))
    ?? getEnvironment('SUPABASE_SECRET_KEY')
    ?? getEnvironment('SUPABASE_SERVICE_ROLE_KEY');
}

async function secretsMatch(actual: string | null, expected: string): Promise<boolean> {
  if (!actual) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  left.forEach((value, index) => { difference |= value ^ right[index]; });
  return difference === 0;
}

function parseClaims(value: unknown): WidgetPushClaim[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(parsed)) throw new Error('Invalid claims');
  return parsed.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error('Invalid claim');
    }
    const claim = item as WidgetPushClaim;
    if (!uuid.test(claim.ownerId) || !uuid.test(claim.claimId)
      || !Number.isSafeInteger(claim.generation) || claim.generation < 1
      || !Array.isArray(claim.targets)) throw new Error('Invalid claim');
    claim.targets.forEach((target) => {
      if (!uuid.test(target.registrationId)
        || !['ios', 'macos', 'watchos'].includes(target.platform)
        || !['development', 'production'].includes(target.environment)
        || !topics.has(target.topic)
        || !token.test(target.deviceToken)
        || target.deviceToken.length % 2 !== 0) throw new Error('Invalid target');
    });
    return claim;
  });
}

export function createWidgetPushDispatchHandler(dependencies: HandlerDependencies) {
  const logError = dependencies.logError ?? console.error;
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });
    const url = dependencies.getEnvironment('SUPABASE_URL');
    const key = resolveServiceKey(dependencies.getEnvironment);
    const secret = dependencies.getEnvironment('TASKS_WIDGET_PUSH_DISPATCH_SECRET');
    const teamId = dependencies.getEnvironment('TASKS_WIDGET_APNS_TEAM_ID');
    const keyId = dependencies.getEnvironment('TASKS_WIDGET_APNS_KEY_ID');
    const privateKey = dependencies.getEnvironment('TASKS_WIDGET_APNS_PRIVATE_KEY');
    if (!url || !key || !secret || new TextEncoder().encode(secret).byteLength < 32
      || !teamId || !keyId || !privateKey) {
      return response(503, { error: 'Widget push delivery is not configured' });
    }
    if (!await secretsMatch(request.headers.get('x-tasks-widget-push-secret'), secret)) {
      return response(401, { error: 'Unauthorized' });
    }

    const client = dependencies.createClient(url, key);
    const claimResult = await client.claim(50);
    if (claimResult.error) return response(500, { error: 'Widget push claim failed' });
    let claims: WidgetPushClaim[];
    try { claims = parseClaims(claimResult.data); }
    catch { return response(500, { error: 'Widget push claim was invalid' }); }

    let accepted = 0;
    let retired = 0;
    let retried = 0;
    for (const claim of claims) {
      let transientFailure = false;
      for (const target of claim.targets) {
        try {
          const result = await dependencies.send(target, { teamId, keyId, privateKey });
          if (result.accepted) accepted += 1;
          else if (result.permanent) {
            const retirement = await client.retire(target.registrationId);
            if (!retirement.error) retired += 1;
          } else transientFailure = true;
        } catch {
          transientFailure = true;
        }
      }
      // A transient failure for any active registration keeps the owner
      // generation queued. Re-delivering the content-free invalidation to a
      // target that already accepted it is harmless and avoids silently
      // abandoning another device.
      const succeeded = !transientFailure;
      const finish = await client.finish(claim, succeeded);
      if (finish.error) logError('Widget push claim completion failed');
      if (!succeeded) retried += 1;
    }
    return response(200, { outcome: 'processed', claims: claims.length, accepted, retired, retried });
  };
}

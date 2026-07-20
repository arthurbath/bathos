export type PushDelivery = {
  delivery_id: string;
  occurrence_id: string;
  title: string;
  preview: 'title' | 'generic';
  navigate_url: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
};

type DeliveryClaim = {
  outcome: 'accepted';
  through_at: string;
  items: PushDelivery[];
};

type DeliveryResult = {
  deliveryId: string;
  outcome: 'provider_accepted' | 'failed';
  errorCode: string | null;
  targetRevoked: boolean;
};

export type ReminderDispatchClient = {
  claim: (throughAt: string, limit: number) => Promise<{ data: unknown; error: unknown | null }>;
  record: (result: DeliveryResult) => Promise<{ error: unknown | null }>;
};

export type PushConfiguration = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type HandlerDependencies = {
  getEnvironment: (name: string) => string | null;
  createClient: (supabaseUrl: string, serviceKey: string) => ReminderDispatchClient;
  sendPush: (delivery: PushDelivery, configuration: PushConfiguration) => Promise<void>;
  now?: () => Date;
  logError?: (message: string) => void;
  logInfo?: (record: Record<string, unknown>) => void;
};

const jsonHeaders = { 'Content-Type': 'application/json' };

function parseKeyMap(serialized: string | null): string | null {
  if (!serialized) return null;
  try {
    const values = JSON.parse(serialized) as Record<string, unknown>;
    const candidates = [values.default, ...Object.values(values)];
    return candidates.find((value): value is string => (
      typeof value === 'string' && value.trim().length > 0
    )) ?? null;
  } catch {
    return null;
  }
}

export function resolveSupabaseSecretKey(
  getEnvironment: (name: string) => string | null,
): string | null {
  return parseKeyMap(getEnvironment('SUPABASE_SECRET_KEYS'))
    ?? getEnvironment('SUPABASE_SECRET_KEY')
    ?? getEnvironment('SUPABASE_SERVICE_ROLE_KEY');
}

export async function secretsMatch(actual: string | null, expected: string): Promise<boolean> {
  if (!actual) return false;
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function requireClaim(value: unknown): DeliveryClaim {
  const claim = typeof value === 'string' ? JSON.parse(value) as unknown : value;
  if (
    typeof claim !== 'object'
    || claim === null
    || !Array.isArray((claim as DeliveryClaim).items)
  ) {
    throw new Error('Invalid delivery claim');
  }
  return claim as DeliveryClaim;
}

export function providerFailure(error: unknown): { code: string; revoked: boolean } {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : null;
  if (statusCode && Number.isInteger(statusCode)) {
    return {
      code: `push_http_${statusCode}`,
      revoked: statusCode === 404 || statusCode === 410,
    };
  }
  return { code: 'push_transport_error', revoked: false };
}

async function runInBatches<T>(
  values: T[],
  size: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < values.length; index += size) {
    await Promise.all(values.slice(index, index + size).map(operation));
  }
}

function response(status: number, body: Record<string, unknown>, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...headers },
  });
}

export function createReminderDispatchHandler(dependencies: HandlerDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const logError = dependencies.logError ?? console.error;
  const logInfo = dependencies.logInfo ?? ((record) => console.log(JSON.stringify(record)));

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return response(405, { error: 'Method not allowed' }, { Allow: 'POST' });
    }

    const supabaseUrl = dependencies.getEnvironment('SUPABASE_URL');
    const serviceKey = resolveSupabaseSecretKey(dependencies.getEnvironment);
    const dispatchSecret = dependencies.getEnvironment('TASKS_REMINDER_DISPATCH_SECRET');
    const publicKey = dependencies.getEnvironment('TASKS_WEB_PUSH_VAPID_PUBLIC_KEY');
    const privateKey = dependencies.getEnvironment('TASKS_WEB_PUSH_VAPID_PRIVATE_KEY');
    const subject = dependencies.getEnvironment('TASKS_WEB_PUSH_SUBJECT');
    if (
      !supabaseUrl
      || !serviceKey
      || !dispatchSecret
      || new TextEncoder().encode(dispatchSecret).byteLength < 32
      || !publicKey
      || !privateKey
      || !subject
    ) {
      return response(503, { error: 'Reminder delivery is not configured' });
    }
    if (!await secretsMatch(request.headers.get('x-tasks-dispatch-secret'), dispatchSecret)) {
      return response(401, { error: 'Unauthorized' });
    }

    let client: ReminderDispatchClient;
    try {
      client = dependencies.createClient(supabaseUrl, serviceKey);
    } catch {
      logError('Task reminder service client could not be created');
      return response(500, { error: 'Reminder service is unavailable' });
    }
    const throughAt = now().toISOString();
    let claimResult: Awaited<ReturnType<ReminderDispatchClient['claim']>>;
    try {
      claimResult = await client.claim(throughAt, 50);
    } catch {
      logError('Task reminder claim failed');
      return response(500, { error: 'Reminder claim failed' });
    }
    if (claimResult.error) {
      logError('Task reminder claim failed');
      return response(500, { error: 'Reminder claim failed' });
    }

    let claim: DeliveryClaim;
    try {
      claim = requireClaim(claimResult.data);
    } catch {
      logError('Task reminder claim was invalid');
      return response(500, { error: 'Reminder claim was invalid' });
    }

    let accepted = 0;
    let failed = 0;
    let revoked = 0;
    let receiptErrors = 0;
    const pushConfiguration = { publicKey, privateKey, subject };
    await runInBatches(claim.items, 10, async (delivery) => {
      let failure: { code: string; revoked: boolean } | null = null;
      try {
        await dependencies.sendPush(delivery, pushConfiguration);
      } catch (deliveryError) {
        failure = providerFailure(deliveryError);
      }

      let receiptError = false;
      try {
        const result = await client.record({
          deliveryId: delivery.delivery_id,
          outcome: failure ? 'failed' : 'provider_accepted',
          errorCode: failure?.code ?? null,
          targetRevoked: failure?.revoked ?? false,
        });
        receiptError = Boolean(result.error);
      } catch {
        receiptError = true;
      }
      if (receiptError) {
        receiptErrors += 1;
        logError(failure
          ? 'Task reminder failure receipt could not be recorded'
          : 'Task reminder provider acceptance could not be recorded');
        return;
      }
      if (failure) {
        failed += 1;
        if (failure.revoked) revoked += 1;
      } else {
        accepted += 1;
      }
    });

    const summary = {
      event: 'tasks_reminder_dispatch',
      claimed: claim.items.length,
      accepted,
      failed,
      revoked,
      receipt_errors: receiptErrors,
    };
    logInfo(summary);
    return response(receiptErrors > 0 ? 500 : 200, {
      claimed: summary.claimed,
      accepted,
      failed,
      revoked,
      receipt_errors: receiptErrors,
    });
  };
}

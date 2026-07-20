import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

type PushDelivery = {
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

const jsonHeaders = { 'Content-Type': 'application/json' };

function getSecretKey(): string | null {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;
  const serialized = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!serialized) return null;
  try {
    const values = JSON.parse(serialized) as Record<string, string>;
    return values.default ?? Object.values(values)[0] ?? null;
  } catch {
    return null;
  }
}

async function secretsMatch(actual: string | null, expected: string): Promise<boolean> {
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

function providerFailure(error: unknown): { code: string; revoked: boolean } {
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

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...jsonHeaders, Allow: 'POST' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = getSecretKey();
  const dispatchSecret = Deno.env.get('TASKS_REMINDER_DISPATCH_SECRET');
  const vapidPublicKey = Deno.env.get('TASKS_WEB_PUSH_VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('TASKS_WEB_PUSH_VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('TASKS_WEB_PUSH_SUBJECT');
  if (
    !supabaseUrl
    || !serviceKey
    || !dispatchSecret
    || !vapidPublicKey
    || !vapidPrivateKey
    || !vapidSubject
  ) {
    return new Response(JSON.stringify({ error: 'Reminder delivery is not configured' }), {
      status: 503,
      headers: jsonHeaders,
    });
  }
  if (!await secretsMatch(request.headers.get('x-tasks-dispatch-secret'), dispatchSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.rpc('tasks_claim_web_push_deliveries', {
    _through_at: new Date().toISOString(),
    _limit: 50,
  });
  if (error) {
    console.error('Task reminder claim failed');
    return new Response(JSON.stringify({ error: 'Reminder claim failed' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let claim: DeliveryClaim;
  try {
    claim = requireClaim(data);
  } catch {
    console.error('Task reminder claim was invalid');
    return new Response(JSON.stringify({ error: 'Reminder claim was invalid' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let accepted = 0;
  let failed = 0;
  let revoked = 0;
  await runInBatches(claim.items, 10, async (delivery) => {
    let failure: { code: string; revoked: boolean } | null = null;
    try {
      const title = delivery.preview === 'title' ? delivery.title : 'Task Reminder';
      const payload = JSON.stringify({
        version: 1,
        kind: 'task_reminder',
        title,
        body: 'A task reminder is due.',
        occurrence_id: delivery.occurrence_id,
        delivery_id: delivery.delivery_id,
        navigate_url: delivery.navigate_url,
      });
      await webPush.sendNotification(delivery.subscription, payload, {
        vapidDetails: {
          subject: vapidSubject,
          publicKey: vapidPublicKey,
          privateKey: vapidPrivateKey,
        },
        TTL: 86_400,
        urgency: 'normal',
        topic: delivery.delivery_id.replaceAll('-', '').slice(0, 32),
        timeout: 10_000,
      });
    } catch (deliveryError) {
      failure = providerFailure(deliveryError);
    }

    if (failure) {
      const result = await client.rpc('tasks_record_web_push_delivery_result', {
        _delivery_id: delivery.delivery_id,
        _outcome: 'failed',
        _provider_message_id: null,
        _error_code: failure.code,
        _target_revoked: failure.revoked,
      });
      if (result.error) console.error('Task reminder failure receipt could not be recorded');
      failed += 1;
      if (failure.revoked) revoked += 1;
      return;
    }

    const result = await client.rpc('tasks_record_web_push_delivery_result', {
      _delivery_id: delivery.delivery_id,
      _outcome: 'provider_accepted',
      _provider_message_id: null,
      _error_code: null,
      _target_revoked: false,
    });
    if (result.error) {
      console.error('Task reminder provider acceptance could not be recorded');
    } else {
      accepted += 1;
    }
  });

  console.log(JSON.stringify({
    event: 'tasks_reminder_dispatch',
    claimed: claim.items.length,
    accepted,
    failed,
    revoked,
  }));
  return new Response(JSON.stringify({ claimed: claim.items.length, accepted, failed, revoked }), {
    status: 200,
    headers: jsonHeaders,
  });
});

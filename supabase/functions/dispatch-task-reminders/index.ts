import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';

import {
  createReminderDispatchHandler,
  type APNsConfiguration,
  type NativePushDelivery,
  type PushConfiguration,
  type PushDelivery,
} from './handler.ts';

function base64URL(data: Uint8Array): string {
  let binary = '';
  data.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodePEM(pem: string): Uint8Array {
  const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/gu, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function providerToken(configuration: APNsConfiguration): Promise<string> {
  const header = base64URL(new TextEncoder().encode(JSON.stringify({
    alg: 'ES256', kid: configuration.keyId,
  })));
  const payload = base64URL(new TextEncoder().encode(JSON.stringify({
    iss: configuration.teamId, iat: Math.floor(Date.now() / 1000),
  })));
  const key = await crypto.subtle.importKey(
    'pkcs8', decodePEM(configuration.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64URL(new Uint8Array(signature))}`;
}

const handler = createReminderDispatchHandler({
  getEnvironment: (name) => Deno.env.get(name) ?? null,
  createClient: (supabaseUrl, serviceKey) => {
    const client = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return {
      claim: async (throughAt, limit) => {
        const { data, error } = await client.rpc('tasks_claim_web_push_deliveries', {
          _through_at: throughAt,
          _limit: limit,
        });
        return { data, error };
      },
      record: async (result) => {
        const { error } = await client.rpc('tasks_record_web_push_delivery_result', {
          _delivery_id: result.deliveryId,
          _outcome: result.outcome,
          _provider_message_id: null,
          _error_code: result.errorCode,
          _target_revoked: result.targetRevoked,
        });
        return { error };
      },
      claimNative: async (throughAt, limit) => {
        const { data, error } = await client.rpc('tasks_claim_native_push_deliveries', {
          _through_at: throughAt,
          _limit: limit,
        });
        return { data, error };
      },
      recordNative: async (result) => {
        const { error } = await client.rpc('tasks_record_native_push_delivery_result', {
          _delivery_id: result.deliveryId,
          _outcome: result.outcome,
          _provider_message_id: result.providerMessageId,
          _error_code: result.errorCode,
          _target_revoked: result.targetRevoked,
        });
        return { error };
      },
    };
  },
  sendPush: async (delivery: PushDelivery, configuration: PushConfiguration) => {
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
      vapidDetails: configuration,
      TTL: 86_400,
      urgency: 'normal',
      topic: delivery.delivery_id.replaceAll('-', '').slice(0, 32),
      timeout: 10_000,
    });
  },
  sendNativePush: async (
    delivery: NativePushDelivery,
    configuration: APNsConfiguration,
  ) => {
    const host = delivery.environment === 'production'
      ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const response = await fetch(`https://${host}/3/device/${delivery.device_token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${await providerToken(configuration)}`,
        'apns-push-type': 'alert',
        'apns-topic': delivery.topic,
        'apns-priority': '10',
        'apns-collapse-id': delivery.occurrence_id.replaceAll('-', '').slice(0, 64),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {
          alert: { title: 'Reminder', body: delivery.title },
          sound: 'default',
        },
        taskId: delivery.task_id,
        ownerId: delivery.owner_id,
        deliveryId: delivery.delivery_id,
      }),
    });
    const providerMessageId = response.headers.get('apns-id');
    if (response.ok) {
      return { accepted: true, permanent: false, reason: null, providerMessageId };
    }
    let reason = '';
    try { reason = String((await response.json() as { reason?: unknown }).reason ?? ''); }
    catch { reason = `http_${response.status}`; }
    return {
      accepted: false,
      permanent: response.status === 410
        || ['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered'].includes(reason),
      reason: reason || `http_${response.status}`,
      providerMessageId,
    };
  },
});

Deno.serve(handler);

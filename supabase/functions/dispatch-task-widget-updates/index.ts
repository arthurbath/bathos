import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  createWidgetPushDispatchHandler,
  type APNsConfiguration,
  type WidgetPushTarget,
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

const handler = createWidgetPushDispatchHandler({
  getEnvironment: (name) => Deno.env.get(name) ?? null,
  createClient: (url, key) => {
    const client = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return {
      claim: async (limit) => client.rpc('tasks_claim_widget_push_updates', { _limit: limit }),
      finish: async (claim, succeeded) => client.rpc('tasks_finish_widget_push_update', {
        _owner_id: claim.ownerId,
        _claim_id: claim.claimId,
        _generation: claim.generation,
        _succeeded: succeeded,
      }),
      retire: async (registrationId) => client.rpc(
        'tasks_retire_widget_push_registration',
        { _registration_id: registrationId },
      ),
    };
  },
  send: async (target: WidgetPushTarget, configuration: APNsConfiguration) => {
    const host = target.environment === 'production'
      ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const response = await fetch(`https://${host}/3/device/${target.deviceToken}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${await providerToken(configuration)}`,
        'apns-push-type': 'widgets',
        'apns-topic': target.topic,
        'apns-priority': '5',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ aps: { 'content-changed': true } }),
    });
    if (response.ok) return { accepted: true, permanent: false };
    let reason = '';
    try { reason = String((await response.json() as { reason?: unknown }).reason ?? ''); }
    catch { reason = `http_${response.status}`; }
    const permanent = response.status === 410
      || ['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered'].includes(reason);
    return { accepted: false, permanent, reason };
  },
});

Deno.serve(handler);

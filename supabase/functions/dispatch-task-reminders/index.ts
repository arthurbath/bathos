import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import webPush from 'web-push';

import {
  createReminderDispatchHandler,
  type PushConfiguration,
  type PushDelivery,
} from './handler.ts';

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
});

Deno.serve(handler);

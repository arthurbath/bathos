import { createClient } from '@supabase/supabase-js';

import {
  createTasksWidgetActionsHandler,
  type WidgetActionRpcClient,
} from './handler.ts';

const handler = createTasksWidgetActionsHandler({
  getEnvironment: (name) => Deno.env.get(name) ?? null,
  authenticateUser: async (supabaseUrl, publishableKey, accessToken) => {
    const client = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data, error } = await client.auth.getUser(accessToken);
    return error ? null : data.user?.id ?? null;
  },
  createRpcClient: (supabaseUrl, serviceKey): WidgetActionRpcClient => {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return {
      issue: async (input) => client.rpc('tasks_issue_widget_completion_credential', {
        _owner_id: input.ownerId,
        _installation_id: input.installationId,
        _raw_token: input.rawToken,
        _expires_at: input.expiresAt,
      }),
      complete: async (input) => client.rpc('tasks_complete_from_widget', {
        _raw_token: input.rawToken,
        _task_id: input.taskId,
        _client_mutation_id: input.clientMutationId,
        _operation_id: input.operationId,
      }),
      snapshot: async (rawToken) => client.rpc(
        'tasks_read_widget_snapshot',
        { _raw_token: rawToken },
      ),
      createInboxTask: async (input) => client.rpc('tasks_create_inbox_from_watch', {
        _raw_token: input.rawToken,
        _summary: input.summary,
        _client_mutation_id: input.clientMutationId,
        _operation_id: input.operationId,
      }),
      todayProgress: async (rawToken) => client.rpc(
        'tasks_read_today_progress_for_watch',
        { _raw_token: rawToken },
      ),
      revoke: async (rawToken) => client.rpc(
        'tasks_revoke_widget_completion_credential',
        { _raw_token: rawToken },
      ),
      registerPushToken: async (input) => client.rpc(
        'tasks_register_widget_push_token',
        {
          _raw_token: input.rawToken,
          _platform: input.platform,
          _apns_environment: input.environment,
          _apns_topic: input.topic,
          _device_token: input.deviceToken,
          _enabled: input.enabled,
        },
      ),
      issueQuickEntry: async (input) => client.rpc(
        'tasks_issue_native_quick_entry_credential',
        {
          _owner_id: input.ownerId,
          _installation_id: input.installationId,
          _raw_token: input.rawToken,
          _expires_at: input.expiresAt,
        },
      ),
      quickEntryBootstrap: async (rawToken) => client.rpc(
        'tasks_read_native_quick_entry_bootstrap',
        { _raw_token: rawToken },
      ),
      createQuickEntry: async (input) => client.rpc(
        'tasks_create_from_native_quick_entry',
        { _raw_token: input.rawToken, _payload: input.payload },
      ),
      revokeQuickEntry: async (rawToken) => client.rpc(
        'tasks_revoke_native_quick_entry_credential',
        { _raw_token: rawToken },
      ),
    };
  },
});

Deno.serve(handler);

import { describe, expect, it, vi } from 'vitest';

import {
  InvalidTaskReminderError,
  TaskReminderService,
  isSecurePushEndpoint,
  isTaskReminderTime,
} from './taskReminderService';

const reminder = {
  id: 'reminder-a',
  owner_id: 'owner-a',
  root_type: 'todo',
  task_id: 'task-a',
  local_date: '2026-07-20',
  local_time: '09:00:00',
  time_zone: 'America/Los_Angeles',
  ambiguity_choice: 'earlier',
  resolved_at: '2026-07-20T16:00:00Z',
  resolution_kind: 'exact',
  status: 'active',
  record_revision: 1,
  last_mutation_channel: 'web',
  last_actor_type: 'user',
  client_mutation_id: 'mutation-a',
  created_at: '2026-07-20T15:00:00Z',
  updated_at: '2026-07-20T15:00:00Z',
} as const;

const occurrence = {
  id: 'occurrence-a',
  owner_id: 'owner-a',
  reminder_id: reminder.id,
  reminder_revision: 1,
  resolved_at: reminder.resolved_at,
  status: 'scheduled',
  client_mutation_id: 'mutation-a',
  created_at: '2026-07-20T15:00:00Z',
} as const;

describe('TaskReminderService', () => {
  it('saves validated local intent through the guarded RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { outcome: 'accepted', reminder, occurrence },
      error: null,
    });
    const service = new TaskReminderService({ rpc } as never);

    await expect(service.save({
      rootType: 'todo',
      rootId: 'task-a',
      localTime: '09:00',
      timeZone: 'America/Los_Angeles',
      mutationId: 'mutation-a',
    })).resolves.toMatchObject({ outcome: 'accepted', reminder, occurrence });
    expect(rpc).toHaveBeenCalledWith('tasks_save_start_reminder', expect.objectContaining({
      _root_type: 'todo',
      _root_id: 'task-a',
      _local_time: '09:00',
      _ambiguity_choice: 'earlier',
      _mutation_id: 'mutation-a',
    }));
  });

  it('retries the exact temporary root-planning lag with one mutation id', async () => {
    vi.useFakeTimers();
    try {
      const rpc = vi.fn()
        .mockResolvedValueOnce({
          data: null,
          error: {
            code: '22023',
            message: 'A reminder requires a Start date or Today horizon',
          },
        })
        .mockResolvedValueOnce({
          data: { outcome: 'accepted', reminder, occurrence },
          error: null,
        });
      const service = new TaskReminderService({ rpc } as never);

      const saved = service.save({
        rootType: 'todo',
        rootId: 'task-a',
        localTime: '09:00',
        timeZone: 'America/Los_Angeles',
        mutationId: 'mutation-a',
      });
      await vi.runAllTimersAsync();

      await expect(saved).resolves.toMatchObject({ outcome: 'accepted', reminder });
      expect(rpc).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls[0]?.[1]).toMatchObject({ _mutation_id: 'mutation-a' });
      expect(rpc.mock.calls[1]?.[1]).toMatchObject({ _mutation_id: 'mutation-a' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry or obscure an unrelated reminder failure', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'Authentication is required to save reminders',
      },
    });
    const service = new TaskReminderService({ rpc } as never);

    await expect(service.save({
      rootType: 'todo',
      rootId: 'task-a',
      localTime: '09:00',
      timeZone: 'America/Los_Angeles',
    })).rejects.toThrow('Authentication is required to save reminders');
    expect(rpc).toHaveBeenCalledOnce();
  });

  it('rejects malformed local intent before calling the server', async () => {
    const rpc = vi.fn();
    const service = new TaskReminderService({ rpc } as never);

    await expect(service.save({
      rootType: 'todo',
      rootId: 'task-a',
      localTime: '25:00',
      timeZone: 'UTC',
    })).rejects.toBeInstanceOf(InvalidTaskReminderError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims and acknowledges due in-app reminders', async () => {
    const delivery = {
      id: 'delivery-a', owner_id: 'owner-a', occurrence_id: occurrence.id,
      target_id: 'target-a', status: 'acknowledged', attempt_count: 1,
      last_attempted_at: '2026-07-20T16:00:00Z', provider_accepted_at: null,
      acknowledged_at: '2026-07-20T16:01:00Z', provider_message_id: null,
      last_error_code: null, created_at: '2026-07-20T16:00:00Z',
      updated_at: '2026-07-20T16:01:00Z',
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          outcome: 'accepted', through_at: '2026-07-20T16:00:00Z',
          items: [{
            delivery_id: delivery.id, occurrence_id: occurrence.id,
            reminder_id: reminder.id, root_type: 'todo', root_id: 'task-a',
            title: 'Call home', resolved_at: occurrence.resolved_at, attempt_count: 1,
          }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { outcome: 'accepted', delivery }, error: null,
      });
    const service = new TaskReminderService({ rpc } as never);

    const claim = await service.claimDue(
      '2026-07-20T16:00:00Z',
      '10000000-0000-4000-8000-000000000001',
    );
    expect(claim.items).toHaveLength(1);
    expect(rpc).toHaveBeenNthCalledWith(1, 'tasks_claim_due_reminders', {
      _through_at: '2026-07-20T16:00:00Z',
      _request_id: '10000000-0000-4000-8000-000000000001',
    });
    await expect(service.acknowledge(delivery.id)).resolves.toMatchObject({
      outcome: 'accepted', delivery: { status: 'acknowledged' },
    });
  });

  it('claims through a surface-scoped delivery target', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'accepted',
        through_at: '2026-07-20T16:00:00Z',
        items: [],
      },
      error: null,
    });
    const service = new TaskReminderService({ rpc } as never);

    await service.claimDue(
      '2026-07-20T16:00:00Z',
      '10000000-0000-4000-8000-000000000001',
      1_000,
      {
        endpointKey: 'browser:20000000-0000-4000-8000-000000000002',
        label: 'This Browser',
      },
      '2026-07-20T15:59:00Z',
    );

    expect(rpc).toHaveBeenCalledWith('tasks_claim_due_reminders_v3', {
      _not_before: '2026-07-20T15:59:00Z',
      _through_at: '2026-07-20T16:00:00Z',
      _request_id: '10000000-0000-4000-8000-000000000001',
      _surface_key: 'browser:20000000-0000-4000-8000-000000000002',
      _surface_label: 'This Browser',
    });
  });

  it('does not broaden a session-scoped claim through a legacy RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.tasks_claim_due_reminders_v3',
      },
    });
    const service = new TaskReminderService({ rpc } as never);

    await expect(service.claimDue(
      '2026-07-20T16:00:00Z',
      '10000000-0000-4000-8000-000000000001',
      1_000,
      {
        endpointKey: 'browser:20000000-0000-4000-8000-000000000002',
        label: 'This Browser',
      },
    )).rejects.toMatchObject({ code: 'PGRST202' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('bounds a stalled due-reminder claim and aborts the request', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const request = new Promise<never>(() => undefined) as Promise<never> & {
        abortSignal: (nextSignal: AbortSignal) => Promise<never>;
      };
      request.abortSignal = vi.fn((nextSignal: AbortSignal) => {
        signal = nextSignal;
        return request;
      });
      const rpc = vi.fn().mockReturnValue(request);
      const service = new TaskReminderService({ rpc } as never);

      const claim = service.claimDue(
        '2026-07-20T16:00:00Z',
        '10000000-0000-4000-8000-000000000001',
        25,
      );
      const rejection = expect(claim).rejects.toThrow('Reminder check timed out');

      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(request.abortSignal).toHaveBeenCalledOnce();
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('recognizes reminder times through synchronized fractional-second precision', () => {
    expect(isTaskReminderTime('09:30')).toBe(true);
    expect(isTaskReminderTime('09:30:00')).toBe(true);
    expect(isTaskReminderTime('09:30:00.000')).toBe(true);
    expect(isTaskReminderTime('09:30:00.123456789')).toBe(true);
    expect(isTaskReminderTime('24:00')).toBe(false);
    expect(isTaskReminderTime('09:30.000')).toBe(false);
    expect(isTaskReminderTime('09:30:00.')).toBe(false);
    expect(isTaskReminderTime('09:30:00.1234567890')).toBe(false);
  });

  it('registers and revokes an owner-scoped Web Push target', async () => {
    const target = {
      id: 'target-a', owner_id: 'owner-a', channel: 'web_push',
      endpoint_key: 'sha256:abc', label: 'This Browser', capability_status: 'active',
      configuration: { preview: 'title' }, last_error_code: null,
      last_seen_at: '2026-07-20T16:00:00Z', created_at: '2026-07-20T16:00:00Z',
      updated_at: '2026-07-20T16:00:00Z',
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { outcome: 'accepted', target }, error: null })
      .mockResolvedValueOnce({
        data: {
          outcome: 'accepted',
          target: { ...target, capability_status: 'revoked', last_error_code: 'user_disabled' },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { outcome: 'accepted' }, error: null });
    const service = new TaskReminderService({ rpc } as never);
    const subscription = {
      endpoint: 'https://push.example.test/subscription-a',
      keys: { p256dh: 'public-key', auth: 'auth-secret' },
    };

    await expect(service.registerWebPush(subscription)).resolves.toMatchObject({
      outcome: 'accepted', target: { id: 'target-a', capability_status: 'active' },
    });
    expect(rpc).toHaveBeenCalledWith('tasks_register_web_push_target', {
      _endpoint: subscription.endpoint,
      _p256dh: subscription.keys.p256dh,
      _auth_secret: subscription.keys.auth,
      _label: 'This Browser',
      _reactivate_revoked: false,
    });
    await expect(service.revokeWebPush('target-a')).resolves.toMatchObject({
      outcome: 'accepted', target: { capability_status: 'revoked' },
    });
    await expect(service.revokeWebPushByEndpoint(subscription.endpoint)).resolves.toEqual({
      outcome: 'accepted',
    });
    expect(rpc).toHaveBeenLastCalledWith('tasks_revoke_web_push_endpoint', {
      _endpoint: subscription.endpoint,
      _reason: 'account_signed_out',
    });
  });

  it('requires a secure Web Push endpoint before calling the server', async () => {
    const rpc = vi.fn();
    const service = new TaskReminderService({ rpc } as never);

    await expect(service.registerWebPush({
      endpoint: 'http://push.example.test/subscription-a',
      keys: { p256dh: 'public-key', auth: 'auth-secret' },
    })).rejects.toBeInstanceOf(InvalidTaskReminderError);
    expect(isSecurePushEndpoint('https://push.example.test/subscription-a')).toBe(true);
    expect(isSecurePushEndpoint('not a URL')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('registers and revokes the current native APNs installation', async () => {
    const target = {
      id: 'target-native', owner_id: 'owner-a', channel: 'native_push',
      endpoint_key: 'installation:30000000-0000-4000-8000-000000000001',
      label: 'This iPhone or iPad', capability_status: 'active',
      configuration: { platform: 'ios' }, last_error_code: null,
      last_seen_at: '2026-07-20T16:00:00Z', created_at: '2026-07-20T16:00:00Z',
      updated_at: '2026-07-20T16:00:00Z',
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { outcome: 'accepted', target }, error: null })
      .mockResolvedValueOnce({ data: { outcome: 'accepted', target }, error: null });
    const service = new TaskReminderService({ rpc } as never);
    const registration = {
      installationId: '30000000-0000-4000-8000-000000000001',
      platform: 'ios' as const,
      environment: 'development' as const,
      topic: 'garden.bath.tasks' as const,
      deviceToken: 'ab'.repeat(32),
      label: 'This iPhone or iPad',
    };

    await expect(service.registerNativePush(registration)).resolves.toMatchObject({
      outcome: 'accepted', target: { channel: 'native_push' },
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'tasks_register_native_push_target', {
      _installation_id: registration.installationId,
      _platform: 'ios',
      _environment: 'development',
      _topic: 'garden.bath.tasks',
      _device_token: registration.deviceToken,
      _label: registration.label,
    });
    await expect(service.revokeNativePush(registration.installationId)).resolves.toEqual({
      outcome: 'accepted',
    });
  });
});

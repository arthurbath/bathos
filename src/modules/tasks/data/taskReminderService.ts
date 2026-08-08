import type { SupabaseClient } from '@supabase/supabase-js';

import type { TaskInAppReminderSurface } from '@/modules/tasks/domain/taskReminderSurface';

import type { Database } from '@/integrations/supabase/types';
import { isTaskCalendarDate } from '@/modules/tasks/domain/taskDates';
import {
  taskActorTypes,
  taskDeliveryCapabilityStatuses,
  taskDeliveryChannels,
  taskEntryChannels,
  taskReminderAmbiguityChoices,
  taskReminderResolutionKinds,
  taskReminderStatuses,
  type TaskReminder,
  type TaskReminderAmbiguityChoice,
  type TaskReminderDelivery,
  type TaskReminderOccurrence,
  type TaskDeliveryTarget,
} from '@/modules/tasks/types/tasks';

type TaskReminderClient = Pick<SupabaseClient<Database>, 'rpc'>;

export const TASK_REMINDER_CLAIM_TIMEOUT_MS = 10_000;
const TASK_REMINDER_PLANNING_RETRY_DELAYS_MS = [150, 300, 600, 1_200, 2_400] as const;

export type TaskReminderSaveInput = {
  reminder?: TaskReminder | null;
  rootType: 'todo';
  rootId: string;
  localTime: string;
  timeZone: string;
  ambiguityChoice?: TaskReminderAmbiguityChoice;
  mutationId?: string;
  mutationChannel?: 'web' | 'mcp';
  actorType?: 'user' | 'automation';
};

export type TaskReminderSaveResult = {
  outcome: 'accepted' | 'already_applied' | 'conflict';
  reminder: TaskReminder;
  occurrence?: TaskReminderOccurrence;
};

export type TaskDueReminder = {
  delivery_id: string;
  occurrence_id: string;
  reminder_id: string;
  root_type: 'todo';
  root_id: string;
  title: string;
  resolved_at: string;
  attempt_count: number;
};

export type TaskReminderClaimResult = {
  outcome: 'accepted';
  through_at: string;
  items: TaskDueReminder[];
};

export type TaskWebPushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type TaskWebPushRegistrationResult = {
  outcome: 'accepted' | 'already_registered' | 'revoked';
  target: TaskDeliveryTarget;
};

export type TaskNativePushRegistrationInput = {
  installationId: string;
  platform: 'ios' | 'macos';
  environment: 'development' | 'production';
  topic: 'garden.bath.tasks';
  deviceToken: string;
  label: string;
};

export class InvalidTaskReminderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskReminderError';
  }
}

export class TaskReminderService {
  constructor(private readonly client: TaskReminderClient) {}

  async save(input: TaskReminderSaveInput): Promise<TaskReminderSaveResult> {
    if (
      !input.rootId
      || !isTaskReminderTime(input.localTime)
      || !input.timeZone.trim()
    ) {
      throw new InvalidTaskReminderError('A valid reminder time and time zone are required');
    }
    const mutationId = input.mutationId ?? crypto.randomUUID();
    const request = {
      _reminder_id: (input.reminder?.id ?? null) as unknown as string,
      _expected_record_revision: (input.reminder?.record_revision ?? null) as unknown as number,
      _root_type: input.rootType,
      _root_id: input.rootId,
      _local_time: input.localTime,
      _time_zone: input.timeZone,
      _ambiguity_choice: input.ambiguityChoice ?? 'earlier',
      _mutation_id: mutationId,
      _mutation_channel: input.mutationChannel ?? 'web',
      _actor_type: input.actorType ?? 'user',
    };

    for (let attempt = 0; ; attempt += 1) {
      const { data, error } = await this.client.rpc('tasks_save_start_reminder', request);
      if (error) {
        const retryDelay = TASK_REMINDER_PLANNING_RETRY_DELAYS_MS[attempt];
        if (!isPendingRootPlanningError(error) || retryDelay === undefined) {
          throw normalizeReminderServiceError(error, 'Unable to save reminder');
        }
        await waitForReminderPlanning(retryDelay);
        continue;
      }
      const result = requireRecord(data, 'Reminder save returned an invalid result');
      const outcome = requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'conflict'] as const,
        'reminder save outcome',
      );
      return {
        outcome,
        reminder: parseTaskReminder(result.reminder),
        ...(outcome === 'conflict'
          ? {}
          : { occurrence: parseTaskReminderOccurrence(result.occurrence) }),
      };
    }
  }

  async cancel(
    reminder: TaskReminder,
    mutationId = crypto.randomUUID(),
    mutationChannel: 'web' | 'mcp' = 'web',
    actorType: 'user' | 'automation' = 'user',
  ): Promise<{ outcome: 'accepted' | 'already_applied' | 'conflict'; reminder: TaskReminder }> {
    const { data, error } = await this.client.rpc('tasks_cancel_reminder', {
      _reminder_id: reminder.id,
      _expected_record_revision: reminder.record_revision,
      _mutation_id: mutationId,
      _mutation_channel: mutationChannel,
      _actor_type: actorType,
    });
    if (error) throw error;
    const result = requireRecord(data, 'Reminder cancellation returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'conflict'] as const,
        'reminder cancellation outcome',
      ),
      reminder: parseTaskReminder(result.reminder),
    };
  }

  async claimDue(
    throughAt = new Date().toISOString(),
    requestId = crypto.randomUUID(),
    timeoutMs = TASK_REMINDER_CLAIM_TIMEOUT_MS,
    surface?: TaskInAppReminderSurface,
    notBefore = throughAt,
  ): Promise<TaskReminderClaimResult> {
    if (
      Number.isNaN(new Date(throughAt).valueOf())
      || Number.isNaN(new Date(notBefore).valueOf())
      || new Date(notBefore) > new Date(throughAt)
    ) {
      throw new InvalidTaskReminderError('A valid reminder claim window is required');
    }
    const controller = new AbortController();
    if (surface && (!surface.endpointKey.trim() || !surface.label.trim())) {
      throw new InvalidTaskReminderError('A valid reminder surface is required');
    }
    const request = surface
      ? this.client.rpc('tasks_claim_due_reminders_v3', {
        _not_before: notBefore,
        _through_at: throughAt,
        _request_id: requestId,
        _surface_key: surface.endpointKey.trim(),
        _surface_label: surface.label.trim(),
      })
      : this.client.rpc('tasks_claim_due_reminders', {
        _through_at: throughAt,
        _request_id: requestId,
      });
    const abortableRequest = request as typeof request & {
      abortSignal?: (signal: AbortSignal) => typeof request;
    };
    const boundedRequest = typeof abortableRequest.abortSignal === 'function'
      ? abortableRequest.abortSignal(controller.signal)
      : request;
    const { data, error } = await settleReminderClaim(
      boundedRequest,
      controller,
      timeoutMs,
    );
    if (error) throw error;
    const result = requireRecord(data, 'Reminder claim returned an invalid result');
    const items = requireArray(result.items, 'Reminder claim items are invalid')
      .map(parseTaskDueReminder);
    return {
      outcome: requireEnum(result.outcome, ['accepted'] as const, 'reminder claim outcome'),
      through_at: requireTimestamp(result.through_at, 'reminder claim time'),
      items,
    };
  }

  async acknowledge(deliveryId: string): Promise<{
    outcome: 'accepted' | 'already_applied' | 'canceled';
    delivery: TaskReminderDelivery;
  }> {
    const { data, error } = await this.client.rpc('tasks_acknowledge_reminder_delivery', {
      _delivery_id: deliveryId,
    });
    if (error) throw error;
    const result = requireRecord(data, 'Reminder acknowledgement returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'canceled'] as const,
        'reminder acknowledgement outcome',
      ),
      delivery: result.delivery as TaskReminderDelivery,
    };
  }

  async registerWebPush(
    subscription: TaskWebPushSubscriptionInput,
    label = 'This Browser',
    reactivateRevoked = false,
  ): Promise<TaskWebPushRegistrationResult> {
    if (
      !isSecurePushEndpoint(subscription.endpoint)
      || !subscription.keys.p256dh
      || !subscription.keys.auth
      || !label.trim()
    ) {
      throw new InvalidTaskReminderError('A valid Web Push subscription is required');
    }
    const { data, error } = await this.client.rpc('tasks_register_web_push_target', {
      _endpoint: subscription.endpoint,
      _p256dh: subscription.keys.p256dh,
      _auth_secret: subscription.keys.auth,
      _label: label.trim(),
      _reactivate_revoked: reactivateRevoked,
    });
    if (error) throw error;
    const result = requireRecord(data, 'Web Push registration returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_registered', 'revoked'] as const,
        'Web Push registration outcome',
      ),
      target: parseTaskDeliveryTarget(result.target),
    };
  }

  async revokeWebPush(targetId: string): Promise<{
    outcome: 'accepted' | 'already_applied';
    target: TaskDeliveryTarget;
  }> {
    if (!targetId) throw new InvalidTaskReminderError('A Web Push target is required');
    const { data, error } = await this.client.rpc('tasks_revoke_web_push_target', {
      _target_id: targetId,
      _reason: 'user_disabled',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Web Push revocation returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied'] as const,
        'Web Push revocation outcome',
      ),
      target: parseTaskDeliveryTarget(result.target),
    };
  }

  async revokeWebPushByEndpoint(endpoint: string): Promise<{
    outcome: 'accepted' | 'already_applied' | 'not_registered';
  }> {
    if (!isSecurePushEndpoint(endpoint)) {
      throw new InvalidTaskReminderError('A valid Web Push endpoint is required');
    }
    const { data, error } = await this.client.rpc('tasks_revoke_web_push_endpoint', {
      _endpoint: endpoint,
      _reason: 'account_signed_out',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Web Push endpoint revocation returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'already_applied', 'not_registered'] as const,
        'Web Push endpoint revocation outcome',
      ),
    };
  }

  async registerNativePush(input: TaskNativePushRegistrationInput): Promise<{
    outcome: 'accepted';
    target: TaskDeliveryTarget;
  }> {
    if (
      !input.installationId
      || !/^[0-9a-f]{64,512}$/u.test(input.deviceToken)
      || input.deviceToken.length % 2 !== 0
      || !input.label.trim()
    ) {
      throw new InvalidTaskReminderError('A valid native push registration is required');
    }
    const { data, error } = await this.client.rpc('tasks_register_native_push_target', {
      _installation_id: input.installationId,
      _platform: input.platform,
      _environment: input.environment,
      _topic: input.topic,
      _device_token: input.deviceToken,
      _label: input.label.trim(),
    });
    if (error) throw error;
    const result = requireRecord(data, 'Native push registration returned an invalid result');
    return {
      outcome: requireEnum(result.outcome, ['accepted'] as const, 'native push outcome'),
      target: parseTaskDeliveryTarget(result.target),
    };
  }

  async revokeNativePush(installationId: string): Promise<{
    outcome: 'accepted' | 'not_registered';
  }> {
    if (!installationId) {
      throw new InvalidTaskReminderError('A native push installation is required');
    }
    const { data, error } = await this.client.rpc('tasks_revoke_native_push_target', {
      _installation_id: installationId,
      _reason: 'authorization_disabled',
    });
    if (error) throw error;
    const result = requireRecord(data, 'Native push revocation returned an invalid result');
    return {
      outcome: requireEnum(
        result.outcome,
        ['accepted', 'not_registered'] as const,
        'native push revocation outcome',
      ),
    };
  }
}

function isPendingRootPlanningError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as { code?: unknown; message?: unknown };
  return record.code === '22023'
    && typeof record.message === 'string'
    && record.message.startsWith('A reminder requires');
}

function normalizeReminderServiceError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return new Error(message);
  }
  return new Error(fallback);
}

function waitForReminderPlanning(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function settleReminderClaim<T>(
  request: PromiseLike<T>,
  controller: AbortController,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Reminder check timed out'));
      controller.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function parseTaskReminder(value: unknown): TaskReminder {
  const record = requireRecord(value, 'Reminder is invalid');
  requireText(record.id, 'reminder identifier');
  requireText(record.owner_id, 'reminder owner');
  requireCalendarDate(record.local_date, 'reminder date');
  if (!isTaskReminderTime(record.local_time)) {
    throw new InvalidTaskReminderError('Reminder time is invalid');
  }
  requireTimestamp(record.resolved_at, 'reminder resolved time');
  requirePositiveInteger(record.record_revision, 'reminder revision');
  return {
    ...record,
    root_type: requireEnum(record.root_type, ['todo'] as const, 'reminder root type'),
    status: requireEnum(record.status, taskReminderStatuses, 'reminder status'),
    ambiguity_choice: requireEnum(
      record.ambiguity_choice,
      taskReminderAmbiguityChoices,
      'reminder ambiguity choice',
    ),
    resolution_kind: requireEnum(
      record.resolution_kind,
      taskReminderResolutionKinds,
      'reminder resolution kind',
    ),
    last_mutation_channel: requireEnum(
      record.last_mutation_channel,
      taskEntryChannels,
      'reminder mutation channel',
    ),
    last_actor_type: requireEnum(record.last_actor_type, taskActorTypes, 'reminder actor'),
  } as TaskReminder;
}

export function parseTaskReminderOccurrence(value: unknown): TaskReminderOccurrence {
  const record = requireRecord(value, 'Reminder occurrence is invalid');
  requireText(record.id, 'reminder occurrence identifier');
  requireText(record.owner_id, 'reminder occurrence owner');
  requireText(record.reminder_id, 'reminder identifier');
  requirePositiveInteger(record.reminder_revision, 'reminder occurrence revision');
  requireTimestamp(record.resolved_at, 'reminder occurrence time');
  return {
    ...record,
    status: requireEnum(
      record.status,
      ['scheduled', 'canceled'] as const,
      'reminder occurrence status',
    ),
  } as TaskReminderOccurrence;
}

export function isTaskReminderTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(value);
}

export function isSecurePushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseTaskDueReminder(value: unknown): TaskDueReminder {
  const record = requireRecord(value, 'Due reminder is invalid');
  return {
    delivery_id: requireText(record.delivery_id, 'delivery identifier'),
    occurrence_id: requireText(record.occurrence_id, 'occurrence identifier'),
    reminder_id: requireText(record.reminder_id, 'reminder identifier'),
    root_type: requireEnum(record.root_type, ['todo'] as const, 'reminder root type'),
    root_id: requireText(record.root_id, 'reminder root identifier'),
    title: requireText(record.title, 'reminder title'),
    resolved_at: requireTimestamp(record.resolved_at, 'reminder due time'),
    attempt_count: requirePositiveInteger(record.attempt_count, 'reminder attempt count'),
  };
}

function parseTaskDeliveryTarget(value: unknown): TaskDeliveryTarget {
  const record = requireRecord(value, 'Web Push target is invalid');
  requireText(record.id, 'Web Push target identifier');
  requireText(record.owner_id, 'Web Push target owner');
  requireText(record.endpoint_key, 'Web Push endpoint identity');
  requireText(record.label, 'Web Push target label');
  requireTimestamp(record.last_seen_at, 'Web Push target last-seen time');
  requireTimestamp(record.created_at, 'Web Push target creation time');
  requireTimestamp(record.updated_at, 'Web Push target update time');
  return {
    ...record,
    channel: requireEnum(record.channel, taskDeliveryChannels, 'delivery channel'),
    capability_status: requireEnum(
      record.capability_status,
      taskDeliveryCapabilityStatuses,
      'delivery capability status',
    ),
  } as TaskDeliveryTarget;
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  const parsed = typeof value === 'string' ? parseJson(value, message) : value;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidTaskReminderError(message);
  }
  return parsed as Record<string, unknown>;
}

function requireArray(value: unknown, message: string): unknown[] {
  const parsed = typeof value === 'string' ? parseJson(value, message) : value;
  if (!Array.isArray(parsed)) throw new InvalidTaskReminderError(message);
  return parsed;
}

function parseJson(value: string, message: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidTaskReminderError(message);
  }
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value;
}

function requireCalendarDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isTaskCalendarDate(value)) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value;
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).valueOf())) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return Number(value);
}

function requireEnum<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new InvalidTaskReminderError(`${label} is invalid`);
  }
  return value as T[number];
}

import { describe, expect, it, vi } from 'vitest';

import {
  maintainTaskNativeWidgetCredential,
  parseTaskNativeWidgetCredential,
} from './taskNativeWidgetCredential';

const ownerId = '10000000-0000-4000-8000-000000000001';
const installationId = '20000000-0000-4000-8000-000000000002';
const issuedCredential = {
  outcome: 'issued',
  ownerId,
  installationId,
  credential: `twc_${'A'.repeat(43)}`,
  expiresAt: '2026-10-28T12:00:00.000Z',
};

describe('native widget credential provisioning', () => {
  it('accepts only a credential for the current owner and installation', () => {
    expect(parseTaskNativeWidgetCredential(
      issuedCredential,
      ownerId,
      installationId,
    )).toEqual({
      ownerId,
      installationId,
      credential: issuedCredential.credential,
      expiresAt: issuedCredential.expiresAt,
    });
    expect(parseTaskNativeWidgetCredential(
      { ...issuedCredential, ownerId: '30000000-0000-4000-8000-000000000003' },
      ownerId,
      installationId,
    )).toBeNull();
    expect(parseTaskNativeWidgetCredential(
      { ...issuedCredential, installationId: 'invalid' },
      ownerId,
      installationId,
    )).toBeNull();
  });

  it('retries transient issuance failures until the native host receives a credential', async () => {
    const controller = new AbortController();
    const issue = vi.fn()
      .mockRejectedValueOnce(new Error('Auth session not ready'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(issuedCredential);
    const publish = vi.fn().mockReturnValue(true);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(maintainTaskNativeWidgetCredential({
      ownerId,
      installationId,
      signal: controller.signal,
      issue,
      publish,
      wait,
    })).resolves.toBe(true);

    expect(issue).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 1_000, controller.signal);
    expect(wait).toHaveBeenNthCalledWith(2, 5_000, controller.signal);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({
      ownerId,
      installationId,
      credential: issuedCredential.credential,
      expiresAt: issuedCredential.expiresAt,
    });
  });

  it('stops retrying when its companion session is replaced', async () => {
    const controller = new AbortController();
    const issue = vi.fn().mockResolvedValue(null);
    const wait = vi.fn().mockImplementation(async () => {
      controller.abort();
    });

    await expect(maintainTaskNativeWidgetCredential({
      ownerId,
      installationId,
      signal: controller.signal,
      issue,
      publish: vi.fn(),
      wait,
    })).resolves.toBe(false);
    expect(issue).toHaveBeenCalledOnce();
  });
});

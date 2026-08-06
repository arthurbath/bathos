import { describe, expect, it, vi } from 'vitest';

import {
  maintainTaskNativeQuickEntryCredential,
  maintainTaskNativeWidgetCredential,
  parseTaskNativeQuickEntryCredential,
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
const issuedQuickEntryCredential = {
  outcome: 'issued',
  type: 'nativeQuickEntryCredential',
  payloadSchemaVersion: 1,
  contractFingerprint:
    '5ea30f93f4269dcb3423c4a5ca3c8c9e3b505a545e2052e584d7b56cc653cfe1',
  capability: 'native_quick_entry_v1',
  ownerId,
  installationId,
  credential: `tqe_${'B'.repeat(43)}`,
  expiresAt: '2026-09-04T12:00:00.000Z',
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

describe('native Quick Entry credential provisioning', () => {
  it('requires the exact contract, owner, installation, and token shape', () => {
    expect(parseTaskNativeQuickEntryCredential(
      issuedQuickEntryCredential,
      ownerId,
      installationId,
    )).toEqual({
      payloadSchemaVersion: 1,
      contractFingerprint: issuedQuickEntryCredential.contractFingerprint,
      capability: 'native_quick_entry_v1',
      ownerId,
      installationId,
      credential: issuedQuickEntryCredential.credential,
      expiresAt: issuedQuickEntryCredential.expiresAt,
    });
    expect(parseTaskNativeQuickEntryCredential(
      { ...issuedQuickEntryCredential, contractFingerprint: 'stale' },
      ownerId,
      installationId,
    )).toBeNull();
    expect(parseTaskNativeQuickEntryCredential(
      { ...issuedQuickEntryCredential, credential: 'twc_wrong-capability' },
      ownerId,
      installationId,
    )).toBeNull();
  });

  it('retries issuance until the native host receives the Quick Entry credential', async () => {
    const controller = new AbortController();
    const issue = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(issuedQuickEntryCredential);
    const publish = vi.fn().mockReturnValue(true);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(maintainTaskNativeQuickEntryCredential({
      ownerId,
      installationId,
      signal: controller.signal,
      issue,
      publish,
      wait,
    })).resolves.toBe(true);

    expect(issue).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1_000, controller.signal);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      credential: issuedQuickEntryCredential.credential,
      contractFingerprint: issuedQuickEntryCredential.contractFingerprint,
    }));
  });
});

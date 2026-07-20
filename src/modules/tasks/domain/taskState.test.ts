import { describe, expect, it } from 'vitest';

import {
  applyTaskStateTransition,
  assertValidTaskState,
  InvalidTaskStateError,
  InvalidTaskStateTransitionError,
  type TaskState,
} from './taskState';

const occurredAt = '2026-07-20T03:00:00.000Z';

const openTask: TaskState = {
  lifecycle: 'open',
  completedAt: null,
  canceledAt: null,
  disposition: 'present',
  deletedAt: null,
};

describe('task state invariants', () => {
  it('accepts each valid lifecycle and disposition combination', () => {
    expect(() => assertValidTaskState(openTask)).not.toThrow();
    expect(() =>
      assertValidTaskState({ ...openTask, lifecycle: 'completed', completedAt: occurredAt }),
    ).not.toThrow();
    expect(() =>
      assertValidTaskState({ ...openTask, lifecycle: 'canceled', canceledAt: occurredAt }),
    ).not.toThrow();
    expect(() =>
      assertValidTaskState({ ...openTask, disposition: 'deleted', deletedAt: occurredAt }),
    ).not.toThrow();
  });

  it('rejects contradictory lifecycle timestamps', () => {
    expect(() => assertValidTaskState({ ...openTask, completedAt: occurredAt })).toThrow(
      InvalidTaskStateError,
    );
    expect(() =>
      assertValidTaskState({ ...openTask, lifecycle: 'completed', completedAt: null }),
    ).toThrow(InvalidTaskStateError);
    expect(() =>
      assertValidTaskState({
        ...openTask,
        lifecycle: 'canceled',
        canceledAt: occurredAt,
        completedAt: occurredAt,
      }),
    ).toThrow(InvalidTaskStateError);
  });

  it('rejects contradictory deletion timestamps', () => {
    expect(() => assertValidTaskState({ ...openTask, deletedAt: occurredAt })).toThrow(
      InvalidTaskStateError,
    );
    expect(() =>
      assertValidTaskState({ ...openTask, disposition: 'deleted', deletedAt: null }),
    ).toThrow(InvalidTaskStateError);
  });
});

describe('task state transitions', () => {
  it('completes open work', () => {
    expect(applyTaskStateTransition(openTask, 'complete', occurredAt)).toEqual({
      outcome: 'applied',
      state: { ...openTask, lifecycle: 'completed', completedAt: occurredAt },
    });
  });

  it('cancels open work', () => {
    expect(applyTaskStateTransition(openTask, 'cancel', occurredAt)).toEqual({
      outcome: 'applied',
      state: { ...openTask, lifecycle: 'canceled', canceledAt: occurredAt },
    });
  });

  it('reopens completed and canceled work without changing disposition', () => {
    const completed = { ...openTask, lifecycle: 'completed' as const, completedAt: occurredAt };
    const canceled = { ...openTask, lifecycle: 'canceled' as const, canceledAt: occurredAt };

    expect(applyTaskStateTransition(completed, 'reopen', occurredAt)).toEqual({
      outcome: 'applied',
      state: openTask,
    });
    expect(applyTaskStateTransition(canceled, 'reopen', occurredAt)).toEqual({
      outcome: 'applied',
      state: openTask,
    });
  });

  it('treats repeated target transitions as no-ops', () => {
    const completed = { ...openTask, lifecycle: 'completed' as const, completedAt: occurredAt };
    const deleted = { ...openTask, disposition: 'deleted' as const, deletedAt: occurredAt };

    expect(applyTaskStateTransition(completed, 'complete', occurredAt)).toEqual({
      outcome: 'noop',
      state: completed,
    });
    expect(applyTaskStateTransition(openTask, 'reopen', occurredAt)).toEqual({
      outcome: 'noop',
      state: openTask,
    });
    expect(applyTaskStateTransition(deleted, 'delete', occurredAt)).toEqual({
      outcome: 'noop',
      state: deleted,
    });
    expect(applyTaskStateTransition(openTask, 'restore', occurredAt)).toEqual({
      outcome: 'noop',
      state: openTask,
    });
  });

  it('requires reopening before changing one terminal lifecycle to the other', () => {
    const completed = { ...openTask, lifecycle: 'completed' as const, completedAt: occurredAt };
    const canceled = { ...openTask, lifecycle: 'canceled' as const, canceledAt: occurredAt };

    expect(() => applyTaskStateTransition(completed, 'cancel', occurredAt)).toThrow(
      InvalidTaskStateTransitionError,
    );
    expect(() => applyTaskStateTransition(canceled, 'complete', occurredAt)).toThrow(
      InvalidTaskStateTransitionError,
    );
  });

  it('deletes and restores without rewriting lifecycle', () => {
    const completed = { ...openTask, lifecycle: 'completed' as const, completedAt: occurredAt };
    const deleted = applyTaskStateTransition(completed, 'delete', occurredAt);

    expect(deleted).toEqual({
      outcome: 'applied',
      state: { ...completed, disposition: 'deleted', deletedAt: occurredAt },
    });
    expect(applyTaskStateTransition(deleted.state, 'restore', occurredAt)).toEqual({
      outcome: 'applied',
      state: completed,
    });
  });

  it('requires restoration before another lifecycle change', () => {
    const deleted = { ...openTask, disposition: 'deleted' as const, deletedAt: occurredAt };

    expect(() => applyTaskStateTransition(deleted, 'complete', occurredAt)).toThrow(
      InvalidTaskStateTransitionError,
    );
  });

  it('requires a valid transition timestamp', () => {
    expect(() => applyTaskStateTransition(openTask, 'complete', 'not-a-date')).toThrow(
      InvalidTaskStateTransitionError,
    );
  });
});

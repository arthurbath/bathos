export const taskLifecycles = ['open', 'completed', 'canceled'] as const;
export const taskDispositions = ['present', 'deleted'] as const;

export type TaskLifecycle = (typeof taskLifecycles)[number];
export type TaskDisposition = (typeof taskDispositions)[number];
export type TaskStateTransition = 'complete' | 'cancel' | 'reopen' | 'delete' | 'restore';

export type TaskState = {
  lifecycle: TaskLifecycle;
  completedAt: string | null;
  canceledAt: string | null;
  disposition: TaskDisposition;
  deletedAt: string | null;
};

export type TaskStateTransitionResult = {
  outcome: 'applied' | 'noop';
  state: TaskState;
};

export class InvalidTaskStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskStateError';
  }
}

export class InvalidTaskStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTaskStateTransitionError';
  }
}

export function assertValidTaskState(state: TaskState): void {
  if (state.lifecycle === 'open' && (state.completedAt !== null || state.canceledAt !== null)) {
    throw new InvalidTaskStateError('Open tasks cannot have terminal timestamps');
  }

  if (state.lifecycle === 'completed' && (state.completedAt === null || state.canceledAt !== null)) {
    throw new InvalidTaskStateError('Completed tasks require only a completion timestamp');
  }

  if (state.lifecycle === 'canceled' && (state.canceledAt === null || state.completedAt !== null)) {
    throw new InvalidTaskStateError('Canceled tasks require only a cancellation timestamp');
  }

  if (state.disposition === 'present' && state.deletedAt !== null) {
    throw new InvalidTaskStateError('Present tasks cannot have a deletion timestamp');
  }

  if (state.disposition === 'deleted' && state.deletedAt === null) {
    throw new InvalidTaskStateError('Deleted tasks require a deletion timestamp');
  }
}

export function applyTaskStateTransition(
  state: TaskState,
  transition: TaskStateTransition,
  occurredAt: string,
): TaskStateTransitionResult {
  assertValidTaskState(state);
  assertValidInstant(occurredAt);

  if (transition === 'delete') {
    if (state.disposition === 'deleted') {
      return { outcome: 'noop', state };
    }

    return applied({ ...state, disposition: 'deleted', deletedAt: occurredAt });
  }

  if (transition === 'restore') {
    if (state.disposition === 'present') {
      return { outcome: 'noop', state };
    }

    return applied({ ...state, disposition: 'present', deletedAt: null });
  }

  if (state.disposition === 'deleted') {
    throw new InvalidTaskStateTransitionError('Deleted tasks must be restored before changing lifecycle');
  }

  if (transition === 'complete') {
    if (state.lifecycle === 'completed') {
      return { outcome: 'noop', state };
    }
    if (state.lifecycle !== 'open') {
      throw new InvalidTaskStateTransitionError('Canceled tasks must be reopened before completion');
    }

    return applied({
      ...state,
      lifecycle: 'completed',
      completedAt: occurredAt,
      canceledAt: null,
    });
  }

  if (transition === 'cancel') {
    if (state.lifecycle === 'canceled') {
      return { outcome: 'noop', state };
    }
    if (state.lifecycle !== 'open') {
      throw new InvalidTaskStateTransitionError('Completed tasks must be reopened before cancellation');
    }

    return applied({
      ...state,
      lifecycle: 'canceled',
      completedAt: null,
      canceledAt: occurredAt,
    });
  }

  if (state.lifecycle === 'open') {
    return { outcome: 'noop', state };
  }

  return applied({
    ...state,
    lifecycle: 'open',
    completedAt: null,
    canceledAt: null,
  });
}

function applied(state: TaskState): TaskStateTransitionResult {
  assertValidTaskState(state);
  return { outcome: 'applied', state };
}

function assertValidInstant(value: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new InvalidTaskStateTransitionError('Task transitions require a valid timestamp');
  }
}

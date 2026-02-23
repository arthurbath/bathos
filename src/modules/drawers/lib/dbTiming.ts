const SLOW_OPERATION_THRESHOLD_MS = 800;

export async function withDrawersDbTiming<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();

  try {
    return await run();
  } finally {
    const durationMs = performance.now() - start;
    if (!import.meta.env.DEV && durationMs < SLOW_OPERATION_THRESHOLD_MS) return;

    const durationText = `${Math.round(durationMs)}ms`;
    const message = `[drawers][db] ${operation} completed in ${durationText}`;

    if (durationMs >= SLOW_OPERATION_THRESHOLD_MS) {
      console.warn(message);
    } else {
      console.debug(message);
    }
  }
}

export type ProductionTopologyCleanupDatabase = {
  disconnectAndClear: () => Promise<void>;
  close: () => Promise<void>;
};

export type ProductionTopologyCleanupClient = {
  auth: {
    signOut: (options: { scope: 'local' }) => Promise<{ error: Error | null }>;
  };
};

export type ProductionTopologyCleanupAdmin = {
  auth: {
    admin: {
      deleteUser: (userId: string) => Promise<{ error: Error | null }>;
    };
  };
};

type ProductionTopologyCleanupOptions = {
  databases: Iterable<ProductionTopologyCleanupDatabase>;
  signedInClients: Iterable<ProductionTopologyCleanupClient>;
  syntheticUserIds: Set<string>;
  admin: ProductionTopologyCleanupAdmin | null;
  testDirectory: string | null;
  removeTestDirectory: (directory: string) => Promise<void>;
};

export async function cleanupProductionTopology({
  databases,
  signedInClients,
  syntheticUserIds,
  admin,
  testDirectory,
  removeTestDirectory,
}: ProductionTopologyCleanupOptions): Promise<void> {
  const errors: Error[] = [];

  for (const database of databases) {
    await captureCleanupError('clear a local PowerSync database', errors, () => (
      database.disconnectAndClear()
    ));
    await captureCleanupError('close a local PowerSync database', errors, () => (
      database.close()
    ));
  }

  for (const client of signedInClients) {
    await captureCleanupError('sign out a synthetic client', errors, async () => {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error !== null) throw error;
    });
  }

  if (admin !== null) {
    for (const userId of syntheticUserIds) {
      await captureCleanupError(`delete synthetic user ${userId}`, errors, async () => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error !== null) throw error;
        syntheticUserIds.delete(userId);
      });
    }
  }

  if (testDirectory !== null) {
    await captureCleanupError('remove the local topology test directory', errors, () => (
      removeTestDirectory(testDirectory)
    ));
  }

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Tasks production-topology cleanup failed in ${errors.length} step${errors.length === 1 ? '' : 's'}`,
    );
  }
}

async function captureCleanupError(
  label: string,
  errors: Error[],
  cleanup: () => Promise<void>,
): Promise<void> {
  try {
    await cleanup();
  } catch (error) {
    errors.push(new Error(`${label}: ${errorMessage(error)}`));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

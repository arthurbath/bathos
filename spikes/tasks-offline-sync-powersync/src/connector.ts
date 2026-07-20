import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
  type PowerSyncCredentials
} from '@powersync/web';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

import { CONFLICTS_TABLE, TASKS_TABLE } from './schema';

const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  powersyncUrl: import.meta.env.VITE_POWERSYNC_URL
};

type SessionListener = (session: Session | null) => void;

type RemoteRevision = {
  id: string;
  revision: number;
};

const fatalResponseCodes = [/^22...$/, /^23...$/, /^42501$/];

export class SupabaseConnector implements PowerSyncBackendConnector {
  readonly client: SupabaseClient;
  currentSession: Session | null = null;
  private readonly listeners = new Set<SessionListener>();

  constructor() {
    this.client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: true }
    });
  }

  async init() {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw error;
    }
    this.setSession(data.session);
  }

  subscribe(listener: SessionListener) {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => this.listeners.delete(listener);
  }

  async register(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
    this.setSession(data.session);
  }

  async login(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    this.setSession(data.session);
  }

  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
    this.setSession(null);
  }

  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) {
      throw error ?? new Error('No Supabase session is available');
    }

    return {
      endpoint: config.powersyncUrl,
      token: data.session.access_token
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    let activeOperation: CrudEntry | null = null;
    try {
      for (const operation of transaction.crud) {
        activeOperation = operation;
        if (operation.table !== TASKS_TABLE) {
          throw new Error(`Unexpected queued table: ${operation.table}`);
        }

        if (operation.op === UpdateType.PUT) {
          const result = await this.client
            .from(TASKS_TABLE)
            .upsert({ ...operation.opData, id: operation.id }, { onConflict: 'id' });
          if (result.error) {
            throw result.error;
          }
          continue;
        }

        if (operation.op === UpdateType.PATCH) {
          const nextRevision = Number(operation.opData?.revision);
          if (!Number.isInteger(nextRevision) || nextRevision < 2) {
            throw new Error('Every task patch must increment revision');
          }

          const result = await this.client
            .from(TASKS_TABLE)
            .update(operation.opData ?? {})
            .eq('id', operation.id)
            .eq('revision', nextRevision - 1)
            .select('id, revision')
            .maybeSingle<RemoteRevision>();

          if (result.error) {
            throw result.error;
          }

          if (!result.data) {
            const remote = await this.client
              .from(TASKS_TABLE)
              .select('id, revision')
              .eq('id', operation.id)
              .maybeSingle<RemoteRevision>();
            if (remote.error) {
              throw remote.error;
            }
            await recordIssue(database, operation, 'revision_conflict', remote.data?.revision ?? null);
          }
          continue;
        }

        if (operation.op === UpdateType.DELETE) {
          const result = await this.client.from(TASKS_TABLE).delete().eq('id', operation.id);
          if (result.error) {
            throw result.error;
          }
        }
      }

      await transaction.complete();
    } catch (error) {
      const code = readErrorCode(error);
      if (activeOperation && code && fatalResponseCodes.some((pattern) => pattern.test(code))) {
        await recordIssue(database, activeOperation, 'fatal_upload_error', null, code);
        await transaction.complete();
        return;
      }
      throw error;
    }
  }

  private setSession(session: Session | null) {
    this.currentSession = session;
    for (const listener of this.listeners) {
      listener(session);
    }
  }
}

async function recordIssue(
  database: AbstractPowerSyncDatabase,
  operation: CrudEntry,
  kind: string,
  remoteRevision: number | null,
  details = ''
) {
  await database.execute(
    `INSERT INTO ${CONFLICTS_TABLE}
      (id, task_id, kind, operation, local_revision, remote_revision, detected_at, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      operation.id,
      kind,
      operation.op,
      Number(operation.opData?.revision ?? 0),
      remoteRevision,
      new Date().toISOString(),
      details
    ]
  );
}

function readErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return null;
}

export const connector = new SupabaseConnector();

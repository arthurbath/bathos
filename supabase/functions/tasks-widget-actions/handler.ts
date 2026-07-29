export type WidgetActionRpcClient = {
  issue: (input: {
    ownerId: string;
    installationId: string;
    rawToken: string;
    expiresAt: string;
  }) => Promise<{ data: unknown; error: unknown | null }>;
  complete: (input: {
    rawToken: string;
    taskId: string;
    clientMutationId: string;
    operationId: string;
  }) => Promise<{ data: unknown; error: unknown | null }>;
  snapshot: (rawToken: string) => Promise<{ data: unknown; error: unknown | null }>;
  revoke: (rawToken: string) => Promise<{ data: unknown; error: unknown | null }>;
};

type HandlerDependencies = {
  getEnvironment: (name: string) => string | null;
  authenticateUser: (
    supabaseUrl: string,
    publishableKey: string,
    accessToken: string,
  ) => Promise<string | null>;
  createRpcClient: (supabaseUrl: string, serviceKey: string) => WidgetActionRpcClient;
  randomBytes?: (length: number) => Uint8Array;
  now?: () => Date;
  logError?: (message: string) => void;
};

type JsonRecord = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const widgetTokenPattern = /^twc_[A-Za-z0-9_-]{43}$/;
const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

function response(status: number, body: JsonRecord, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...headers },
  });
}

function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

function parseWidgetCredential(header: string | null): string | null {
  const match = header?.match(/^Widget (twc_[A-Za-z0-9_-]{43})$/);
  return match?.[1] ?? null;
}

async function parseBody(request: Request): Promise<JsonRecord | null> {
  try {
    const serialized = await request.text();
    if (new TextEncoder().encode(serialized).byteLength > 4096) return null;
    const value = JSON.parse(serialized) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as JsonRecord
      : null;
  } catch {
    return null;
  }
}

function parseRpcData(value: unknown): JsonRecord | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : null;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

export function resolveSupabaseSecretKey(
  getEnvironment: (name: string) => string | null,
): string | null {
  const serialized = getEnvironment('SUPABASE_SECRET_KEYS');
  if (serialized) {
    try {
      const values = JSON.parse(serialized) as Record<string, unknown>;
      const key = [values.default, ...Object.values(values)].find(
        (value): value is string => typeof value === 'string' && value.length > 0,
      );
      if (key) return key;
    } catch {
      // Continue to the single-key environment fallbacks.
    }
  }
  return getEnvironment('SUPABASE_SECRET_KEY')
    ?? getEnvironment('SUPABASE_SERVICE_ROLE_KEY');
}

export function createTasksWidgetActionsHandler(dependencies: HandlerDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const randomBytes = dependencies.randomBytes ?? ((length) => crypto.getRandomValues(
    new Uint8Array(length),
  ));
  const logError = dependencies.logError ?? console.error;

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...jsonHeaders,
          'Access-Control-Allow-Headers': 'authorization, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }
    if (request.method !== 'POST') {
      return response(405, { error: 'Method not allowed' }, { Allow: 'POST' });
    }

    const body = await parseBody(request);
    const action = body?.action;
    if (!body || !['issue', 'complete', 'snapshot', 'revoke'].includes(String(action))) {
      return response(400, { error: 'Invalid request' });
    }

    const supabaseUrl = dependencies.getEnvironment('SUPABASE_URL');
    const serviceKey = resolveSupabaseSecretKey(dependencies.getEnvironment);
    const publishableKey = dependencies.getEnvironment('SUPABASE_PUBLISHABLE_KEY')
      ?? dependencies.getEnvironment('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !publishableKey) {
      return response(503, { error: 'Widget actions are unavailable' });
    }

    let rpc: WidgetActionRpcClient;
    try {
      rpc = dependencies.createRpcClient(supabaseUrl, serviceKey);
    } catch {
      logError('Widget action service client could not be created');
      return response(503, { error: 'Widget actions are unavailable' });
    }

    if (action === 'issue') {
      const accessToken = parseBearer(request.headers.get('authorization'));
      const installationId = body.installationId;
      if (
        !accessToken
        || typeof installationId !== 'string'
        || !uuidPattern.test(installationId)
      ) {
        return response(401, { error: 'Unauthorized' });
      }

      let ownerId: string | null = null;
      try {
        ownerId = await dependencies.authenticateUser(
          supabaseUrl,
          publishableKey,
          accessToken,
        );
      } catch {
        ownerId = null;
      }
      if (!ownerId || !uuidPattern.test(ownerId)) {
        return response(401, { error: 'Unauthorized' });
      }

      const rawToken = `twc_${toBase64Url(randomBytes(32))}`;
      if (!widgetTokenPattern.test(rawToken)) {
        return response(500, { error: 'Credential could not be issued' });
      }
      const expiresAt = new Date(now().getTime() + 90 * 86_400_000).toISOString();
      const result = await rpc.issue({ ownerId, installationId, rawToken, expiresAt });
      if (result.error) {
        logError('Widget credential issue failed');
        return response(500, { error: 'Credential could not be issued' });
      }
      return response(200, {
        outcome: 'issued',
        credential: rawToken,
        ownerId,
        installationId,
        expiresAt,
      });
    }

    const rawToken = parseWidgetCredential(request.headers.get('authorization'));
    if (!rawToken) {
      return response(401, { error: 'Unauthorized' });
    }

    if (action === 'revoke') {
      const result = await rpc.revoke(rawToken);
      if (result.error) {
        logError('Widget credential revoke failed');
        return response(500, { error: 'Credential could not be revoked' });
      }
      return response(200, parseRpcData(result.data) ?? { outcome: 'revoked' });
    }

    if (action === 'snapshot') {
      const result = await rpc.snapshot(rawToken);
      if (result.error) {
        logError('Widget snapshot read failed');
        return response(500, { error: 'Widget could not be refreshed' });
      }
      const snapshot = parseRpcData(result.data);
      if (!snapshot) {
        return response(500, { error: 'Widget could not be refreshed' });
      }
      if (snapshot.outcome === 'rejected') {
        return response(401, {
          error: 'Widget could not be refreshed',
          code: snapshot.code,
        });
      }
      if (
        snapshot.type !== 'snapshot'
        || snapshot.schemaVersion !== 2
        || typeof snapshot.ownerId !== 'string'
        || !uuidPattern.test(snapshot.ownerId)
        || !Array.isArray(snapshot.lists)
        || snapshot.lists.length !== 5
      ) {
        return response(500, { error: 'Widget could not be refreshed' });
      }
      const serialized = JSON.stringify(snapshot);
      if (new TextEncoder().encode(serialized).byteLength > 512 * 1024) {
        logError('Widget snapshot response exceeded the bounded payload size');
        return response(500, { error: 'Widget could not be refreshed' });
      }
      return response(200, snapshot);
    }

    const taskId = body.taskId;
    const clientMutationId = body.clientMutationId;
    const operationId = body.operationId;
    if (
      typeof taskId !== 'string'
      || typeof clientMutationId !== 'string'
      || typeof operationId !== 'string'
      || !uuidPattern.test(taskId)
      || !uuidPattern.test(clientMutationId)
      || !uuidPattern.test(operationId)
    ) {
      return response(400, { error: 'Invalid request' });
    }

    const result = await rpc.complete({
      rawToken,
      taskId,
      clientMutationId,
      operationId,
    });
    if (result.error) {
      logError('Widget task completion failed');
      return response(500, { error: 'Task could not be completed' });
    }
    const outcome = parseRpcData(result.data);
    if (!outcome) {
      return response(500, { error: 'Task could not be completed' });
    }
    if (outcome.outcome === 'rejected') {
      return response(
        outcome.code === 'invalid_credential' ? 401 : 409,
        { error: 'Task could not be completed', code: outcome.code },
      );
    }
    return response(200, outcome);
  };
}

import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

type SupabaseForUser = ReturnType<typeof supabaseForUser>;

export interface AuthenticatedMcpContext {
  userId: string;
  email: string | null;
  supabase: SupabaseForUser;
}

export function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function requireAuthenticated(ctx: ToolContext): AuthenticatedMcpContext {
  if (!ctx.isAuthenticated()) {
    throw new Error("Not authenticated");
  }

  return {
    userId: ctx.getUserId(),
    email: ctx.getUserEmail() ?? null,
    supabase: supabaseForUser(ctx),
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function toJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: { data } as Record<string, unknown>,
  };
}

export function toError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function toMcpResult(promise: Promise<unknown>) {
  return promise.then(toJson).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected MCP error";
    return toError(message);
  });
}

export async function resolveBudgetHousehold(
  auth: AuthenticatedMcpContext,
  requestedHouseholdId?: string,
) {
  let query = auth.supabase
    .from("budget_household_members")
    .select("household_id")
    .eq("user_id", auth.userId)
    .limit(1);

  if (requestedHouseholdId) {
    query = query.eq("household_id", requestedHouseholdId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.household_id) {
    throw new Error(requestedHouseholdId ? "Budget household is not accessible." : "No Budget household found.");
  }
  return data.household_id;
}

export async function resolveSnakeHousehold(
  auth: AuthenticatedMcpContext,
  requestedHouseholdId?: string,
) {
  let query = auth.supabase
    .from("snake_household_members")
    .select("household_id")
    .eq("user_id", auth.userId)
    .limit(1);

  if (requestedHouseholdId) {
    query = query.eq("household_id", requestedHouseholdId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.household_id) {
    throw new Error(requestedHouseholdId ? "Snake household is not accessible." : "No Snake household found.");
  }
  return data.household_id;
}

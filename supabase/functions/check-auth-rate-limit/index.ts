import { createClient } from "npm:@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limit configuration per action type
const RATE_LIMITS: Record<string, { maxAttempts: number; windowMinutes: number }> = {
  sign_in: { maxAttempts: 10, windowMinutes: 1 },
  sign_up: { maxAttempts: 5, windowMinutes: 1 },
  forgot_password: { maxAttempts: 3, windowMinutes: 1 },
};

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = getClientIp(req);
    const { actionType } = (await req.json()) as { actionType?: string };

    if (!actionType || !(actionType in RATE_LIMITS)) {
      return new Response(
        JSON.stringify({ error: "Invalid action type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = RATE_LIMITS[actionType];
    const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000).toISOString();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Count recent attempts by this IP for this action
    const { count, error: countError } = await supabaseAdmin
      .from("bathos_auth_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIp)
      .eq("action_type", actionType)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("Error checking rate limit:", countError);
      // Fail open — don't block users on DB errors
      return new Response(
        JSON.stringify({ rateLimited: false, retryAfterSeconds: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currentCount = count || 0;

    if (currentCount >= config.maxAttempts) {
      // Find the oldest record in the current window to calculate retry time
      const { data: oldest } = await supabaseAdmin
        .from("bathos_auth_rate_limits")
        .select("created_at")
        .eq("ip_address", clientIp)
        .eq("action_type", actionType)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .limit(1);

      let retryAfterSeconds = config.windowMinutes * 60;
      if (oldest?.[0]?.created_at) {
        const oldestTime = new Date(oldest[0].created_at).getTime();
        const expiresAt = oldestTime + config.windowMinutes * 60 * 1000;
        retryAfterSeconds = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
      }

      console.log(
        `Rate limited IP ${clientIp} for ${actionType} (${currentCount}/${config.maxAttempts})`,
      );

      return new Response(
        JSON.stringify({ rateLimited: true, retryAfterSeconds }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Record this attempt
    const { error: insertError } = await supabaseAdmin
      .from("bathos_auth_rate_limits")
      .insert({ ip_address: clientIp, action_type: actionType });

    if (insertError) {
      console.error("Error recording rate limit:", insertError);
    }

    return new Response(
      JSON.stringify({ rateLimited: false, retryAfterSeconds: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing rate limit check:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

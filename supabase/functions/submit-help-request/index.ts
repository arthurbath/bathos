import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEEDBACK_TIME_ZONE = "America/Los_Angeles";

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function prettifyContext(context: string): string {
  const contextLabels: Record<string, string> = {
    gateway: "Gateway Help Form",
  };

  return contextLabels[context] ?? toTitleCase(context.replaceAll("_", " "));
}

function prettifySubmittedAt(value: unknown): string {
  const parsed = typeof value === "string" || value instanceof Date
    ? new Date(value)
    : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FEEDBACK_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(parsed);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${lookup("month")} ${lookup("day")}, ${lookup("year")} at ${lookup("hour")}:${lookup("minute")} ${lookup("dayPeriod")} ${lookup("timeZoneName")}`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestOrigin = req.headers.get("Origin") ?? "";
  const shouldExposeDetailedError =
    requestOrigin.startsWith("http://localhost:") ||
    requestOrigin.startsWith("http://127.0.0.1:");

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, message } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Message must be at least 5 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.length > 200) {
      return new Response(JSON.stringify({ error: "Message exceeds 200 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record to bathos_feedback table (unauthenticated, so use service role)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let submittedAt: string | undefined;
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: insertedFeedback, error: insertError } = await supabase
        .from("bathos_feedback")
        .insert({
          email: email.toLowerCase().trim(),
          message: message.trim(),
          context: "gateway",
          user_id: null,
        })
        .select("created_at")
        .single();
      if (insertError) {
        console.error("Feedback insert error:", JSON.stringify(insertError));
        throw new Error(`Feedback insert failed: ${insertError.message}`);
      }
      submittedAt = insertedFeedback.created_at;
    }

    // Send email via Resend
    const body = [
      `Email: ${email.toLowerCase().trim()}`,
      `Context: ${prettifyContext("gateway")}`,
      `Submitted: ${prettifySubmittedAt(submittedAt)}`,
      "",
      "Feedback:",
      message.trim(),
    ].join("\n");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BathOS <webmaster@bath.garden>",
        to: ["webmaster@bath.garden"],
        reply_to: email,
        subject: "BathOS Feedback",
        text: body,
      }),
    });

    if (!resendRes.ok) {
      const resendText = await resendRes.text();
      console.error("Resend API error:", resendText);
      throw new Error(`Resend API failed [${resendRes.status}]: ${resendText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending help request:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send message";
    return new Response(JSON.stringify({
      error: shouldExposeDetailedError ? errorMessage : "Failed to send message",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

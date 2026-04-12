import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function prettifyContext(context: unknown): string {
  if (typeof context !== "string" || context.length === 0) return "General";

  const contextLabels: Record<string, string> = {
    gateway: "Gateway Help Form",
    terms_update: "Terms Update",
    in_app_switcher: "In-App Module Switcher",
    in_app_account: "In-App Account",
    in_app_feedback_bug: "In-App Budget",
  };

  if (contextLabels[context]) return contextLabels[context];
  if (context.startsWith("in_app_")) {
    return `In-App ${toTitleCase(context.slice("in_app_".length).replaceAll("_", " "))}`;
  }
  return toTitleCase(context.replaceAll("_", " "));
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

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;
    let claimedEmail: string | null = null;

    if (token) {
      try {
        const authClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: claimsData } = await authClient.auth.getClaims(token);
        const rawClaimedEmail = claimsData?.claims?.email;
        claimedEmail = typeof rawClaimedEmail === "string" && rawClaimedEmail.trim().length > 0
          ? rawClaimedEmail.trim().toLowerCase()
          : null;
      } catch (error) {
        console.warn("Unable to resolve feedback sender email from auth token:", error);
      }
    }

    const { message, context, submitted_at, file_url, email } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: "Message exceeds 2000 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedEmail = typeof email === "string" && email.trim().length > 0
      ? email.trim().toLowerCase()
      : null;
    const senderEmail = claimedEmail ?? providedEmail;
    const prettyContext = prettifyContext(context);
    const prettySubmittedAt = prettifySubmittedAt(submitted_at);

    // If a file path was provided, generate a signed URL using the service role client
    let attachmentUrl: string | undefined;
    if (file_url && typeof file_url === "string") {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: signedData, error: signedErr } = await serviceClient.storage
        .from("feedback-attachments")
        .createSignedUrl(file_url, 60 * 60 * 24 * 7); // 7-day link
      if (!signedErr && signedData?.signedUrl) {
        attachmentUrl = signedData.signedUrl;
      }
    }

    // Build email body
    let body = [
      `Email: ${senderEmail ?? "Anonymous"}`,
      `Context: ${prettyContext}`,
      `Submitted: ${prettySubmittedAt}`,
      "",
      "Feedback:",
      message.trim(),
    ].join("\n");
    if (attachmentUrl) {
      body += `\n\nAttachment (expires in 7 days): ${attachmentUrl}`;
    }

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BathOS <webmaster@bath.garden>",
        to: ["webmaster@bath.garden"],
        ...(senderEmail ? { reply_to: senderEmail } : {}),
        subject: "BathOS Feedback",
        text: body,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", JSON.stringify(resendData));
      throw new Error(`Resend API failed [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending feedback email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

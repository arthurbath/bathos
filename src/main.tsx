import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installClientConsoleMirror } from "./platform/dev/clientConsoleMirror";
import { isIgnorableBrowserAbort, shouldEnableSentry } from "./platform/sentry";
import "./index.css";

if (import.meta.env.DEV) {
  installClientConsoleMirror();
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const shouldInitSentry = shouldEnableSentry(sentryDsn, window.location.hostname);

function showSentryTestStatus(message: string, tone: "pending" | "success" | "error") {
  const existing = document.getElementById("sentry-test-status");
  const status = existing ?? document.createElement("div");
  status.id = "sentry-test-status";
  status.textContent = message;
  status.setAttribute("role", "status");
  status.style.position = "fixed";
  status.style.left = "16px";
  status.style.right = "16px";
  status.style.bottom = "16px";
  status.style.zIndex = "2147483647";
  status.style.padding = "12px 14px";
  status.style.borderRadius = "8px";
  status.style.border = "1px solid";
  status.style.fontFamily = "Inter, system-ui, sans-serif";
  status.style.fontSize = "14px";
  status.style.lineHeight = "1.4";
  status.style.boxShadow = "none";

  if (tone === "success") {
    status.style.background = "#ecfdf3";
    status.style.borderColor = "#15803d";
    status.style.color = "#14532d";
  } else if (tone === "error") {
    status.style.background = "#fef2f2";
    status.style.borderColor = "#dc2626";
    status.style.color = "#7f1d1d";
  } else {
    status.style.background = "#f8fafc";
    status.style.borderColor = "#475569";
    status.style.color = "#0f172a";
  }

  if (!existing) {
    document.body.appendChild(status);
  }
}

if (shouldInitSentry) {
  Sentry.init({
    dsn: sentryDsn,
    environment: "production",
    sendDefaultPii: false,
    debug: import.meta.env.DEV,
    beforeSend(event, hint) {
      if (isIgnorableBrowserAbort(event, hint)) return null;
      return event;
    },
  });

  const shouldTriggerSentryTest = new URLSearchParams(window.location.search).get("sentry_test") === "1";
  if (shouldTriggerSentryTest) {
    const eventId = Sentry.captureException(new Error("Sentry test error: manual trigger via ?sentry_test=1"));
    showSentryTestStatus(`Sending Sentry test event ${eventId}...`, "pending");
    void Sentry.flush(3000).then((sent) => {
      showSentryTestStatus(
        sent
          ? `Sentry test event sent. Event ID: ${eventId}`
          : `Sentry test event queued but delivery was not confirmed. Event ID: ${eventId}`,
        sent ? "success" : "error",
      );
    });
  }
} else if (new URLSearchParams(window.location.search).get("sentry_test") === "1") {
  showSentryTestStatus(
    sentryDsn
      ? `Sentry test not sent because ${window.location.hostname} is not a production Sentry host.`
      : "Sentry test not sent because VITE_SENTRY_DSN is not configured.",
    "error",
  );
}

createRoot(document.getElementById("root")!).render(<App />);

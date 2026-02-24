import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installClientConsoleMirror } from "./platform/dev/clientConsoleMirror";
import "./index.css";

document.documentElement.classList.add("dark");

if (import.meta.env.DEV) {
  installClientConsoleMirror();
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const isLocalhost = /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);

if (sentryDsn && !isLocalhost) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    debug: import.meta.env.DEV,
  });

  const shouldTriggerSentryTest = new URLSearchParams(window.location.search).get("sentry_test") === "1";
  if (shouldTriggerSentryTest) {
    Sentry.captureException(new Error("Sentry test error: manual trigger via ?sentry_test=1"));
  }
}

createRoot(document.getElementById("root")!).render(<App />);

import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
  });

  const shouldTriggerSentryTest = new URLSearchParams(window.location.search).get("sentry_test") === "1";
  if (shouldTriggerSentryTest) {
    Sentry.captureException(new Error("Sentry test error: manual trigger via ?sentry_test=1"));
  }
}

createRoot(document.getElementById("root")!).render(<App />);
